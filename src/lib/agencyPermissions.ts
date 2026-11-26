/**
 * Moncolis — Matrice de Rôles et Permissions Espace Agence (/agence)
 *
 * Rôles disponibles au sein d'une agence :
 * - directeur        : Accès intégral (équipe, paramètres, exploitation, finances, caisse, audits)
 * - gestionnaire     : Exploitation, gestion colis, assignation flotte livreurs, réceptions
 * - agent_comptoir   : Scanner/réception, guichet, remise/dépôt colis, recherche
 * - comptable        : Suivi des versements, sessions de caisse, écarts, réconciliations, exports financiers
 * - lecture_seule    : Consultation uniquement, aucune action de modification
 */

export type AgencyRole = 'directeur' | 'gestionnaire' | 'magasinier' | 'agent_comptoir' | 'comptable' | 'lecture_seule';

export interface AgencyPermissions {
  canManageTeam: boolean;          // inviter des agents, révoquer, changer les rôles
  canManageSettings: boolean;      // horaires, seuils, tarifs des communes, anti-fraude
  canViewPackages: boolean;        // voir la liste et le détail des colis
  canEditPackages: boolean;        // accepter, refuser, modifier statut de livraison
  canScanPackages: boolean;        // scanner QR code, valider OTP, réceptionner
  canManageWarehouse: boolean;     // gérer l'entrepôt, inventaires, réceptions de stock, picking & emplacements
  canManageDrivers: boolean;       // recruter, lier/délier, activer/suspendre des livreurs
  canAssignDrivers: boolean;       // assigner les courses aux livreurs
  canViewFinances: boolean;        // voir les montants collectés, soldes et statistiques
  canManageCashSessions: boolean;  // ouvrir/fermer session de caisse, valider versements, justifier écarts
  canExportReports: boolean;       // exporter CSV, imprimer récapitulatifs & reçus PDF
  canViewAuditLogs: boolean;       // consulter le journal d'activités et d'audit de l'agence
}

export const AGENCY_ROLE_PERMISSIONS: Record<AgencyRole, AgencyPermissions> = {
  directeur: {
    canManageTeam: true,
    canManageSettings: true,
    canViewPackages: true,
    canEditPackages: true,
    canScanPackages: true,
    canManageWarehouse: true,
    canManageDrivers: true,
    canAssignDrivers: true,
    canViewFinances: true,
    canManageCashSessions: true,
    canExportReports: true,
    canViewAuditLogs: true,
  },
  gestionnaire: {
    canManageTeam: false,
    canManageSettings: false,
    canViewPackages: true,
    canEditPackages: true,
    canScanPackages: true,
    canManageWarehouse: true,
    canManageDrivers: true,
    canAssignDrivers: true,
    canViewFinances: true,
    canManageCashSessions: false,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  magasinier: {
    canManageTeam: false,
    canManageSettings: false,
    canViewPackages: true,
    canEditPackages: false,
    canScanPackages: true,
    canManageWarehouse: true,
    canManageDrivers: false,
    canAssignDrivers: false,
    canViewFinances: false,
    canManageCashSessions: false,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  agent_comptoir: {
    canManageTeam: false,
    canManageSettings: false,
    canViewPackages: true,
    canEditPackages: false,
    canScanPackages: true,
    canManageWarehouse: false,
    canManageDrivers: false,
    canAssignDrivers: false,
    canViewFinances: false,
    canManageCashSessions: false,
    canExportReports: false,
    canViewAuditLogs: false,
  },
  comptable: {
    canManageTeam: false,
    canManageSettings: false,
    canViewPackages: true,
    canEditPackages: false,
    canScanPackages: false,
    canManageWarehouse: false,
    canManageDrivers: false,
    canAssignDrivers: false,
    canViewFinances: true,
    canManageCashSessions: true,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  lecture_seule: {
    canManageTeam: false,
    canManageSettings: false,
    canViewPackages: true,
    canEditPackages: false,
    canScanPackages: false,
    canManageWarehouse: false,
    canManageDrivers: false,
    canAssignDrivers: false,
    canViewFinances: false,
    canManageCashSessions: false,
    canExportReports: false,
    canViewAuditLogs: false,
  },
};

export const AGENCY_ROLE_LABELS: Record<AgencyRole, {
  label: string;
  description: string;
  badgeColor: string;
  badgeBg: string;
}> = {
  directeur: {
    label: 'Directeur Agence',
    description: 'Accès total — Direction de l’agence, équipe, finances et exploitation',
    badgeColor: '#d97706',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
  },
  gestionnaire: {
    label: 'Gestionnaire Exploitation',
    description: 'Gestion opérationnelle — Colis, courses, livreurs et entrepôt',
    badgeColor: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.15)',
  },
  magasinier: {
    label: 'Magasinier / Entrepôt',
    description: 'Entrepôt & Stock — Réception de marchandises, inventaire rayons et préparation picking',
    badgeColor: '#0891b2',
    badgeBg: 'rgba(8, 145, 178, 0.15)',
  },
  agent_comptoir: {
    label: 'Agent de Comptoir',
    description: 'Guichet — Réception, scans QR, vérification colis et remises',
    badgeColor: '#059669',
    badgeBg: 'rgba(5, 150, 105, 0.15)',
  },
  comptable: {
    label: 'Comptable / Caisse',
    description: 'Finances — Versements livreurs, sessions de caisse et rapports',
    badgeColor: '#7c3aed',
    badgeBg: 'rgba(124, 58, 237, 0.15)',
  },
  lecture_seule: {
    label: 'Consultant (Lecture)',
    description: 'Observation — Consultation des données et recherches uniquement',
    badgeColor: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.15)',
  },
};

/**
 * Normalise un sous-rôle (fallback sur 'directeur' si ancien compte agence sans sous-rôle explicite)
 */
export function normalizeAgencyRole(role?: string | null): AgencyRole {
  if (!role) return 'directeur';
  if (role in AGENCY_ROLE_PERMISSIONS) {
    return role as AgencyRole;
  }
  return 'directeur';
}

/**
 * Vérifie si le sous-rôle possède une permission spécifique
 */
export function hasAgencyPermission(
  role: AgencyRole | string | undefined | null,
  permission: keyof AgencyPermissions
): boolean {
  const normalized = normalizeAgencyRole(role);
  return AGENCY_ROLE_PERMISSIONS[normalized]?.[permission] ?? false;
}
