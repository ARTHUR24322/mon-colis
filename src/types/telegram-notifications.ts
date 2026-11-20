/**
 * Moncolis — Types et Définitions du Système de Notifications Telegram
 * Destiné exclusivement au Super Admin et aux utilisateurs de l'espace Agence (/agence)
 */

import { AgencyRole } from '@/lib/agencyPermissions';

export type SuperAdminEventType =
  | 'ECART_VERSEMENT_SUPERADMIN'
  | 'CONNEXION_SUSPECTE'
  | 'PIN_RELAIS_REINITIALISE'
  | 'CREDIT_RELAIS_BAS'
  | 'COLIS_SANS_MOUVEMENT'
  | 'RECLAMATION_VENDEUR'
  | 'DEMANDE_ADHESION_AGENCE'
  | 'PAIEMENT_ECHEC';

export type AgencyEventType =
  | 'NOUVEAU_COLIS_AGENCE'
  | 'COLIS_A_RECUPERER_RELAIS'
  | 'VERSEMENT_EN_ATTENTE'
  | 'ECART_CAISSE_AGENCE'
  | 'DEMANDE_STOCKAGE_FULFILLMENT'
  | 'COLIS_REFUSE_RELAIS';

export type NotificationEventType = SuperAdminEventType | AgencyEventType;

export interface NotificationChannel {
  id: string;
  user_id: string;
  channel: 'telegram';
  address: string; // chat_id
  verified_at: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: NotificationEventType;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TelegramLinkToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface NotificationOutboxItem {
  id: string;
  user_id: string;
  channel: 'telegram';
  event_type: NotificationEventType;
  payload: Record<string, unknown>;
  dedupe_key: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  next_try_at: string;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Métadonnées d'affichage et rôles autorisés pour chaque type d'événement
 */
export interface EventDefinition {
  type: NotificationEventType;
  label: string;
  description: string;
  target: 'superadmin' | 'agence';
  allowedRoles?: AgencyRole[];
  defaultEnabled: boolean;
}

export const SUPERADMIN_EVENTS: Record<SuperAdminEventType, EventDefinition> = {
  ECART_VERSEMENT_SUPERADMIN: {
    type: 'ECART_VERSEMENT_SUPERADMIN',
    label: 'Écart de versement au-dessus du seuil',
    description: 'Alerte lorsqu’un écart de versement dépasse le seuil paramétré.',
    target: 'superadmin',
    defaultEnabled: true,
  },
  CONNEXION_SUSPECTE: {
    type: 'CONNEXION_SUSPECTE',
    label: 'Tentatives de connexion suspectes',
    description: 'Alerte en cas d’échecs répétés ou connexion d’une IP inconnue.',
    target: 'superadmin',
    defaultEnabled: true,
  },
  PIN_RELAIS_REINITIALISE: {
    type: 'PIN_RELAIS_REINITIALISE',
    label: 'Sécurité Point Relais (PIN / Blocage)',
    description: 'Alerte lors de la réinitialisation d’un PIN ou verrouillage agent.',
    target: 'superadmin',
    defaultEnabled: true,
  },
  CREDIT_RELAIS_BAS: {
    type: 'CREDIT_RELAIS_BAS',
    label: 'Crédits Point Relais sous le seuil',
    description: 'Alerte lorsqu’un point relais passe sous le seuil de crédits.',
    target: 'superadmin',
    defaultEnabled: true,
  },
  COLIS_SANS_MOUVEMENT: {
    type: 'COLIS_SANS_MOUVEMENT',
    label: 'Colis sans mouvement prolongé',
    description: 'Alerte pour les colis immobiles depuis plus de X heures.',
    target: 'superadmin',
    defaultEnabled: true,
  },
  RECLAMATION_VENDEUR: {
    type: 'RECLAMATION_VENDEUR',
    label: 'Réclamation vendeur ouverte',
    description: 'Alerte dès qu’un vendeur signale un litige sur un colis.',
    target: 'superadmin',
    defaultEnabled: true,
  },
  DEMANDE_ADHESION_AGENCE: {
    type: 'DEMANDE_ADHESION_AGENCE',
    label: 'Nouvelle demande d’adhésion agence',
    description: 'Alerte lorsqu’une nouvelle agence soumet son dossier.',
    target: 'superadmin',
    defaultEnabled: true,
  },
  PAIEMENT_ECHEC: {
    type: 'PAIEMENT_ECHEC',
    label: 'Échec de paiement ou versement',
    description: 'Alerte lorsqu’un paiement ou un versement financier échoue.',
    target: 'superadmin',
    defaultEnabled: true,
  },
};

export const AGENCY_EVENTS: Record<AgencyEventType, EventDefinition> = {
  NOUVEAU_COLIS_AGENCE: {
    type: 'NOUVEAU_COLIS_AGENCE',
    label: 'Nouveau colis à prendre en charge',
    description: 'Alerte lorsqu’un nouveau colis est assigné à votre agence.',
    target: 'agence',
    allowedRoles: ['directeur', 'gestionnaire'],
    defaultEnabled: true,
  },
  COLIS_A_RECUPERER_RELAIS: {
    type: 'COLIS_A_RECUPERER_RELAIS',
    label: 'Colis déposé en point relais',
    description: 'Alerte lorsqu’un colis attend la collecte au point relais.',
    target: 'agence',
    allowedRoles: ['directeur', 'gestionnaire'],
    defaultEnabled: true,
  },
  VERSEMENT_EN_ATTENTE: {
    type: 'VERSEMENT_EN_ATTENTE',
    label: 'Versement livreur en attente',
    description: 'Alerte lorsqu’un livreur effectue un versement au guichet.',
    target: 'agence',
    allowedRoles: ['directeur', 'gestionnaire', 'agent_comptoir', 'comptable'],
    defaultEnabled: true,
  },
  ECART_CAISSE_AGENCE: {
    type: 'ECART_CAISSE_AGENCE',
    label: 'Écart de caisse ou clôture',
    description: 'Alerte en cas d’écart détecté lors de la session de caisse.',
    target: 'agence',
    allowedRoles: ['directeur', 'gestionnaire', 'comptable'],
    defaultEnabled: true,
  },
  DEMANDE_STOCKAGE_FULFILLMENT: {
    type: 'DEMANDE_STOCKAGE_FULFILLMENT',
    label: 'Demande de location stockage',
    description: 'Alerte lorsqu’un vendeur réserve un emplacement entrepôt.',
    target: 'agence',
    allowedRoles: ['directeur', 'gestionnaire'],
    defaultEnabled: true,
  },
  COLIS_REFUSE_RELAIS: {
    type: 'COLIS_REFUSE_RELAIS',
    label: 'Colis refusé par un point relais',
    description: 'Alerte lorsqu’un point relais refuse la réception d’un colis.',
    target: 'agence',
    allowedRoles: ['directeur', 'gestionnaire'],
    defaultEnabled: true,
  },
};

/**
 * Retourne la liste des événements autorisés pour un utilisateur selon son type / rôle.
 */
export function getAllowedEventsForUser(params: {
  isSuperAdmin?: boolean;
  agencyRole?: AgencyRole | string | null;
}): EventDefinition[] {
  if (params.isSuperAdmin) {
    return Object.values(SUPERADMIN_EVENTS);
  }

  const role = (params.agencyRole || 'directeur') as AgencyRole;
  return Object.values(AGENCY_EVENTS).filter(evt =>
    evt.allowedRoles ? evt.allowedRoles.includes(role) : false
  );
}
