/**
 * POST /api/telegram/webhook
 * Réceptionne les mises à jour envoyées par Telegram vers notre bot.
 *
 * SÉCURITÉ :
 * - Vérifie le header x-telegram-bot-api-secret-token (TELEGRAM_WEBHOOK_SECRET)
 *   sur CHAQUE requête → 403 immédiat si absent ou incorrect
 * - N'accepte que les messages privés (chat.type === 'private')
 * - Déduplique par update_id (cache en mémoire, suffisant pour Vercel serverless)
 * - Les tokens de liaison sont hachés SHA-256, à usage unique, expiration 10 min
 * - Aucune donnée personnelle ni token n'est journalisé
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/utils/supabase/admin';

// ---------------------------------------------------------------------------
// Déduplification des update_id (cache en mémoire, TTL 1 heure)
// ---------------------------------------------------------------------------

const processedUpdates = new Map<number, number>(); // update_id → timestamp
const UPDATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

function isAlreadyProcessed(updateId: number): boolean {
  const ts = processedUpdates.get(updateId);
  if (!ts) return false;
  if (Date.now() - ts > UPDATE_CACHE_TTL_MS) {
    processedUpdates.delete(updateId);
    return false;
  }
  return true;
}

function markProcessed(updateId: number) {
  processedUpdates.set(updateId, Date.now());
  // Nettoyage léger si trop d'entrées
  if (processedUpdates.size > 1000) {
    const cutoff = Date.now() - UPDATE_CACHE_TTL_MS;
    for (const [id, ts] of processedUpdates.entries()) {
      if (ts < cutoff) processedUpdates.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calcule le SHA-256 d'un token (hex). */
function sha256(token: string): string {
  return crypto.createHash('sha256').update(token, 'hex').digest('hex');
}

/** Envoie un message simple via l'API Telegram Bot. */
async function sendBotMessage(chatId: number | string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Réponse de confirmation non critique — ne pas bloquer
  }
}

// ---------------------------------------------------------------------------
// Types Telegram (champs utilisés uniquement)
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  is_bot: boolean;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // ── 1. Vérification du secret webhook (OBLIGATOIRE sur chaque appel) ──────
  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret || !incomingSecret || incomingSecret !== expectedSecret) {
    // Réponse 403 sans détail (ne pas révéler si le secret est absent ou incorrect)
    return new NextResponse(null, { status: 403 });
  }

  // ── 2. Parsing du corps ───────────────────────────────────────────────────
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // ── 3. Déduplification ────────────────────────────────────────────────────
  if (typeof update.update_id !== 'number' || isAlreadyProcessed(update.update_id)) {
    return new NextResponse(null, { status: 200 }); // Toujours 200 pour Telegram
  }
  markProcessed(update.update_id);

  // ── 4. On ne traite que les messages privés ───────────────────────────────
  const message = update.message;
  if (!message || message.chat.type !== 'private') {
    return new NextResponse(null, { status: 200 });
  }

  const chatId = message.chat.id;
  const text = (message.text ?? '').trim();

  // ── 5. Commande /stop — délier le compte ─────────────────────────────────
  if (text === '/stop' || text.startsWith('/stop ')) {
    await supabaseAdmin
      .from('notification_channels')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('channel', 'telegram')
      .eq('address', String(chatId));

    await sendBotMessage(
      chatId,
      '🔕 Vous ne recevrez plus de notifications Moncolis sur ce Telegram.\n\n' +
      'Pour relinkez, connectez-vous à l\'application Moncolis et cliquez sur « Lier mon Telegram ».'
    );
    return new NextResponse(null, { status: 200 });
  }

  // ── 6. Commande /start <token> — lier le compte ───────────────────────────
  if (text.startsWith('/start ')) {
    const rawToken = text.slice('/start '.length).trim();

    // Validation basique du format (64 hex chars)
    if (!/^[0-9a-f]{64}$/.test(rawToken)) {
      await sendBotMessage(
        chatId,
        '⚠️ Ce lien est invalide ou a expiré. Générez un nouveau lien depuis l\'application Moncolis.'
      );
      return new NextResponse(null, { status: 200 });
    }

    const tokenHash = sha256(rawToken);

    // Recherche du token en base (par hash uniquement)
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      // Réponse neutre — ne pas indiquer si le token existe
      await sendBotMessage(
        chatId,
        '⚠️ Ce lien est invalide ou a expiré. Générez un nouveau lien depuis l\'application Moncolis.'
      );
      return new NextResponse(null, { status: 200 });
    }

    // Vérification expiration
    if (new Date(tokenRow.expires_at) < new Date()) {
      await sendBotMessage(
        chatId,
        '⏳ Ce lien a expiré (validité 10 minutes). Générez un nouveau lien depuis l\'application Moncolis.'
      );
      return new NextResponse(null, { status: 200 });
    }

    // Vérification usage unique
    if (tokenRow.used_at !== null) {
      await sendBotMessage(
        chatId,
        '⚠️ Ce lien a déjà été utilisé. Générez un nouveau lien depuis l\'application Moncolis.'
      );
      return new NextResponse(null, { status: 200 });
    }

    const userId = tokenRow.user_id;
    const chatIdStr = String(chatId);
    const now = new Date().toISOString();

    // Upsert du canal Telegram (liaison ou réactivation)
    // 1. Déconnecter si ce chatId était déjà associé à un autre compte (sécurité)
    await supabaseAdmin
      .from('notification_channels')
      .delete()
      .eq('channel', 'telegram')
      .eq('address', chatIdStr);

    // 2. Vérifier si l'utilisateur a déjà un canal existant
    const { data: existingChannel } = await supabaseAdmin
      .from('notification_channels')
      .select('id')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .maybeSingle();

    let channelError;
    if (existingChannel) {
      const { error } = await supabaseAdmin
        .from('notification_channels')
        .update({
          address: chatIdStr,
          verified_at: now,
          enabled: true,
          updated_at: now,
        })
        .eq('id', existingChannel.id);
      channelError = error;
    } else {
      const { error } = await supabaseAdmin
        .from('notification_channels')
        .insert({
          user_id: userId,
          channel: 'telegram',
          address: chatIdStr,
          verified_at: now,
          enabled: true,
          updated_at: now,
        });
      channelError = error;
    }

    if (channelError) {
      console.error('[Telegram Webhook] Erreur sauvegarde canal:', channelError);
      await sendBotMessage(
        chatId,
        '❌ Une erreur est survenue lors de la liaison. Réessayez dans quelques instants.'
      );
      return new NextResponse(null, { status: 200 });
    }

    // Marquer le token comme utilisé
    await supabaseAdmin
      .from('telegram_link_tokens')
      .update({ used_at: now })
      .eq('id', tokenRow.id);

    // Insertion des préférences par défaut si elles n'existent pas encore
    await _insertDefaultPreferences(userId);

    // Log d'audit (sans le chat_id ni le token)
    await supabaseAdmin.from('financial_audit_logs').insert({
      action: 'TELEGRAM_LINKED',
      performed_by: userId,
      details: { channel: 'telegram', linked_at: now },
    }).then(() => {/* non bloquant */});

    // Réponse de confirmation
    await sendBotMessage(
      chatId,
      '✅ <b>Votre compte Moncolis est maintenant lié à ce Telegram.</b>\n\n' +
      'Vous recevrez ici les alertes importantes de la plateforme.\n\n' +
      '💡 Pour arrêter les notifications, envoyez /stop à ce bot ou déliez votre compte depuis l\'application Moncolis.'
    );

    return new NextResponse(null, { status: 200 });
  }

  // ── 7. Commande /start seule (sans token) ─────────────────────────────────
  if (text === '/start') {
    await sendBotMessage(
      chatId,
      '👋 Bienvenue sur le bot Moncolis.\n\n' +
      'Pour lier votre compte, connectez-vous à l\'application Moncolis et cliquez sur « Lier mon Telegram » dans les paramètres.'
    );
    return new NextResponse(null, { status: 200 });
  }

  // ── 8. Tout autre message — réponse neutre ────────────────────────────────
  // Ne pas répondre pour éviter les boucles ou révéler des informations
  return new NextResponse(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// Préférences par défaut (insérées si absentes après liaison)
// ---------------------------------------------------------------------------

async function _insertDefaultPreferences(userId: string): Promise<void> {
  // Déterminer les types d'événements selon l'ID utilisateur
  const isSuperAdmin = userId === 'superadmin-master-id';

  const superAdminEvents = [
    'ECART_VERSEMENT_SUPERADMIN',
    'CONNEXION_SUSPECTE',
    'PIN_RELAIS_REINITIALISE',
    'CREDIT_RELAIS_BAS',
    'COLIS_SANS_MOUVEMENT',
    'RECLAMATION_VENDEUR',
    'DEMANDE_ADHESION_AGENCE',
    'PAIEMENT_ECHEC',
  ];

  const agencyEvents = [
    'NOUVEAU_COLIS_AGENCE',
    'COLIS_A_RECUPERER_RELAIS',
    'VERSEMENT_EN_ATTENTE',
    'ECART_CAISSE_AGENCE',
    'DEMANDE_STOCKAGE_FULFILLMENT',
    'COLIS_REFUSE_RELAIS',
  ];

  const eventTypes = isSuperAdmin ? superAdminEvents : agencyEvents;

  const rows = eventTypes.map((event_type) => ({
    user_id: userId,
    event_type,
    enabled: true,
  }));

  // ON CONFLICT DO NOTHING — ne remplace pas les préférences existantes
  await supabaseAdmin
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'user_id,event_type', ignoreDuplicates: true });
}
