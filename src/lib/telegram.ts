/**
 * Moncolis – Module Telegram
 * Envoie des messages via l'API Bot Telegram pour le super admin et les agences.
 *
 * SÉCURITÉ :
 * - Le token bot (TELEGRAM_BOT_TOKEN) ne doit JAMAIS apparaître dans les journaux.
 * - Le contenu des messages (payload) n'est jamais journalisé.
 * - Aucune donnée personnelle complète (OTP, PIN, téléphone, adresse) dans les messages.
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Helpers d'échappement HTML (obligatoire pour parse_mode: 'HTML')
// ---------------------------------------------------------------------------

/**
 * Échappe les caractères spéciaux HTML dans une valeur dynamique.
 * À appeler sur TOUTES les valeurs insérées dans le texte HTML Telegram.
 */
export function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

export interface TelegramButton {
  label: string;
  url: string;
}

export interface SendTelegramOptions {
  chatId: string;
  html: string;
  button?: TelegramButton;
}

/** Réponse brute de l'API Telegram (champs pertinents uniquement) */
interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
}

/** Erreur structurée renvoyée par ce module */
export class TelegramError extends Error {
  constructor(
    message: string,
    public readonly code: 'RATE_LIMITED' | 'CHAT_NOT_FOUND' | 'CHANNEL_DISABLED' | 'NETWORK' | 'API_ERROR',
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'TelegramError';
  }
}

// ---------------------------------------------------------------------------
// Accès base de données (pour désactiver le canal en cas de 403/400)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Désactive le canal Telegram d'un utilisateur (ex. après 403 du bot).
 * Appelé côté serveur uniquement.
 */
async function disableChannelByChatId(chatId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('notification_channels')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('channel', 'telegram')
      .eq('address', chatId);
  } catch {
    // Ne jamais faire remonter une erreur secondaire lors de la désactivation
  }
}

// ---------------------------------------------------------------------------
// Fonction principale d'envoi
// ---------------------------------------------------------------------------

/**
 * Envoie un message HTML à un chat Telegram via l'API Bot.
 *
 * @param chatId   – Identifiant numérique du chat Telegram (string)
 * @param html     – Texte du message en HTML (tous les &, < et > doivent être échappés via escapeHtml)
 * @param button   – Bouton inline optionnel (label + URL vers l'application)
 *
 * @throws TelegramError('RATE_LIMITED')      → l'appelant doit attendre retryAfter secondes
 * @throws TelegramError('CHAT_NOT_FOUND')    → canal désactivé automatiquement
 * @throws TelegramError('CHANNEL_DISABLED')  → canal désactivé automatiquement
 * @throws TelegramError('NETWORK')           → erreur réseau transitoire, réessai possible
 * @throws TelegramError('API_ERROR')         → autre erreur API
 */
export async function sendTelegram(
  chatId: string,
  html: string,
  button?: TelegramButton
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new TelegramError(
      'TELEGRAM_BOT_TOKEN manquant – vérifiez les variables d\'environnement',
      'API_ERROR'
    );
  }

  // Construction du corps de la requête
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (button) {
    body.reply_markup = {
      inline_keyboard: [[{ text: button.label, url: button.url }]],
    };
  }

  // Appel à l'API Telegram – le token n'apparaît jamais dans les journaux
  let response: Response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
  } catch (networkError) {
    // Erreur réseau (DNS, timeout, connexion refusée…)
    throw new TelegramError(
      'Erreur réseau lors de l\'envoi Telegram – réessai ultérieur',
      'NETWORK'
    );
  }

  // Traitement HTTP 429 – Rate limit
  if (response.status === 429) {
    let retryAfter = 30; // valeur par défaut
    try {
      const data: TelegramApiResponse = await response.json();
      if (data.parameters?.retry_after && data.parameters.retry_after > 0) {
        retryAfter = data.parameters.retry_after;
      }
    } catch {
      // Réponse non parseable, on garde la valeur par défaut
    }
    throw new TelegramError(
      `Rate limit Telegram – réessayer dans ${retryAfter}s`,
      'RATE_LIMITED',
      retryAfter
    );
  }

  // Traitement HTTP 403 – Bot bloqué par l'utilisateur
  if (response.status === 403) {
    await disableChannelByChatId(chatId);
    throw new TelegramError(
      'Bot Telegram bloqué par l\'utilisateur – canal désactivé',
      'CHANNEL_DISABLED'
    );
  }

  // Traitement HTTP 400 – Chat introuvable ou autre erreur de paramètre
  if (response.status === 400) {
    let description = 'Requête invalide';
    try {
      const data: TelegramApiResponse = await response.json();
      description = data.description ?? description;
    } catch {
      // Pas de corps JSON
    }
    const isChatNotFound =
      description.toLowerCase().includes('chat not found') ||
      description.toLowerCase().includes('user not found') ||
      description.toLowerCase().includes('bot was kicked');

    if (isChatNotFound) {
      await disableChannelByChatId(chatId);
      throw new TelegramError(
        'Chat Telegram introuvable – canal désactivé',
        'CHAT_NOT_FOUND'
      );
    }
    throw new TelegramError(
      `Erreur API Telegram 400`,
      'API_ERROR'
    );
  }

  // Autres erreurs HTTP non-OK
  if (!response.ok) {
    throw new TelegramError(
      `Erreur API Telegram HTTP ${response.status}`,
      'API_ERROR'
    );
  }

  // Vérification du corps JSON (Telegram peut renvoyer ok:false avec HTTP 200)
  let result: TelegramApiResponse;
  try {
    result = await response.json();
  } catch {
    throw new TelegramError('Réponse Telegram non parseable', 'API_ERROR');
  }

  if (!result.ok) {
    throw new TelegramError(
      `Telegram ok:false`,
      'API_ERROR'
    );
  }

  // Succès – aucun log du contenu du message
}

// ---------------------------------------------------------------------------
// Helpers de formatage des messages (français, HTML sécurisé)
// ---------------------------------------------------------------------------

/**
 * Construit un message HTML prêt à l'envoi pour un événement donné.
 * Toutes les valeurs dynamiques passent par escapeHtml().
 */
export function buildMessageHtml(params: {
  emoji: string;
  title: string;
  lines: Array<{ label: string; value: string | number | null | undefined }>;
}): string {
  const { emoji, title, lines } = params;

  const body = lines
    .filter((l) => l.value !== null && l.value !== undefined && l.value !== '')
    .map((l) => `• <b>${escapeHtml(l.label)}</b> : ${escapeHtml(l.value)}`)
    .join('\n');

  return `${emoji} <b>${escapeHtml(title)}</b>\n\n${body}`;
}
