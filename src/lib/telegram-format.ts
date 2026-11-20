/**
 * Helper de formatage des messages d'alertes Telegram
 * Utilisé à la fois pour le dispatch instantané et par le cron de rattrapage.
 */

import { escapeHtml } from '@/lib/telegram';
import { NotificationEventType } from '@/types/telegram-notifications';

export function buildNotificationHtml(
  eventType: NotificationEventType,
  payload: Record<string, unknown>
): {
  html: string;
  buttonUrl?: string;
  buttonLabel?: string;
} {
  const appUrl = (process.env.APP_URL ?? 'https://moncolis.com').replace(/\/$/, '');
  const ref = escapeHtml(payload.reference as string ?? payload.id as string ?? '—');
  const amount = payload.amount ? escapeHtml(String(payload.amount)) : null;
  const agencyId = payload.agency_id as string | undefined;

  // ── Super Admin Events ──────────────────────────────────────────────────
  if (eventType === 'ECART_VERSEMENT_SUPERADMIN') {
    return {
      html:
        `⚠️ <b>Écart de versement détecté</b>\n\n` +
        `• <b>Réf. session</b> : ${ref}\n` +
        (amount ? `• <b>Écart</b> : ${amount}\n` : '') +
        `• <b>Agence</b> : ${escapeHtml(payload.agency_name as string ?? '—')}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=versements`,
      buttonLabel: '📊 Voir les versements',
    };
  }

  if (eventType === 'CONNEXION_SUSPECTE') {
    return {
      html:
        `🚨 <b>Connexion suspecte détectée</b>\n\n` +
        `• <b>Utilisateur</b> : ${escapeHtml(payload.identifier as string ?? '—')}\n` +
        `• <b>Tentatives</b> : ${escapeHtml(payload.attempts as string ?? '—')}\n` +
        `• <b>IP</b> : ${escapeHtml(payload.ip as string ?? 'inconnue')}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=securite`,
      buttonLabel: '🔒 Voir la sécurité',
    };
  }

  if (eventType === 'PIN_RELAIS_REINITIALISE') {
    return {
      html:
        `🔑 <b>PIN point relais modifié</b>\n\n` +
        `• <b>Point relais</b> : ${ref}\n` +
        `• <b>Action</b> : ${escapeHtml(payload.action as string ?? 'réinitialisation')}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=relais`,
      buttonLabel: '📍 Voir les relais',
    };
  }

  if (eventType === 'CREDIT_RELAIS_BAS') {
    return {
      html:
        `💳 <b>Crédits point relais bas</b>\n\n` +
        `• <b>Point relais</b> : ${ref}\n` +
        (amount ? `• <b>Crédits restants</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=relais`,
      buttonLabel: '📍 Recharger les crédits',
    };
  }

  if (eventType === 'COLIS_SANS_MOUVEMENT') {
    return {
      html:
        `📦 <b>Colis sans mouvement</b>\n\n` +
        `• <b>Nombre de colis</b> : ${escapeHtml(payload.count as string ?? ref)}\n` +
        `• <b>Depuis</b> : ${escapeHtml(payload.hours as string ?? '?')}h sans mise à jour`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=colis`,
      buttonLabel: '📦 Voir les colis',
    };
  }

  if (eventType === 'RECLAMATION_VENDEUR') {
    return {
      html:
        `🚩 <b>Réclamation vendeur ouverte</b>\n\n` +
        `• <b>Réf. colis</b> : ${ref}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=reclamations`,
      buttonLabel: '🚩 Voir la réclamation',
    };
  }

  if (eventType === 'DEMANDE_ADHESION_AGENCE') {
    return {
      html:
        `🏢 <b>Nouvelle demande d'adhésion agence</b>\n\n` +
        `• <b>Réf. demande</b> : ${ref}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=agences`,
      buttonLabel: '🏢 Examiner la demande',
    };
  }

  if (eventType === 'PAIEMENT_ECHEC') {
    return {
      html:
        `❌ <b>Échec de paiement</b>\n\n` +
        `• <b>Réf.</b> : ${ref}\n` +
        (amount ? `• <b>Montant</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=paiements`,
      buttonLabel: '💰 Voir les paiements',
    };
  }

  // ── Agency Events ───────────────────────────────────────────────────────
  const agencePath = agencyId ? `/agence` : `/agence`;

  if (eventType === 'NOUVEAU_COLIS_AGENCE') {
    return {
      html:
        `📦 <b>Nouveau colis à prendre en charge</b>\n\n` +
        `• <b>Réf.</b> : ${ref}`,
      buttonUrl: `${appUrl}${agencePath}/colis`,
      buttonLabel: '📦 Voir le colis',
    };
  }

  if (eventType === 'COLIS_A_RECUPERER_RELAIS') {
    return {
      html:
        `🏪 <b>Colis à récupérer au point relais</b>\n\n` +
        `• <b>Réf.</b> : ${ref}\n` +
        `• <b>Relais</b> : ${escapeHtml(payload.drop_point_name as string ?? '—')}`,
      buttonUrl: `${appUrl}${agencePath}/colis`,
      buttonLabel: '🏪 Voir le colis',
    };
  }

  if (eventType === 'VERSEMENT_EN_ATTENTE') {
    return {
      html:
        `💵 <b>Versement livreur en attente</b>\n\n` +
        `• <b>Session</b> : ${ref}\n` +
        (amount ? `• <b>Montant</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}${agencePath}/versements-caisse`,
      buttonLabel: '💵 Valider le versement',
    };
  }

  if (eventType === 'ECART_CAISSE_AGENCE') {
    return {
      html:
        `⚠️ <b>Écart de caisse détecté</b>\n\n` +
        `• <b>Session</b> : ${ref}\n` +
        (amount ? `• <b>Écart</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}${agencePath}/versements-caisse`,
      buttonLabel: '📊 Voir la session',
    };
  }

  if (eventType === 'DEMANDE_STOCKAGE_FULFILLMENT') {
    return {
      html:
        `🏭 <b>Demande de location stockage</b>\n\n` +
        `• <b>Réf.</b> : ${ref}`,
      buttonUrl: `${appUrl}${agencePath}/entrepot`,
      buttonLabel: '🏭 Voir la demande',
    };
  }

  if (eventType === 'COLIS_REFUSE_RELAIS') {
    return {
      html:
        `🚫 <b>Colis refusé par un point relais</b>\n\n` +
        `• <b>Réf.</b> : ${ref}\n` +
        `• <b>Relais</b> : ${escapeHtml(payload.drop_point_name as string ?? '—')}`,
      buttonUrl: `${appUrl}${agencePath}/colis`,
      buttonLabel: '🚫 Voir le colis',
    };
  }

  // Fallback
  return {
    html: `🔔 <b>Notification Moncolis</b>\n\n• <b>Réf.</b> : ${ref}`,
    buttonUrl: appUrl,
    buttonLabel: '🏠 Moncolis',
  };
}
