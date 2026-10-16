/**
 * Moncolis — Système de permissions Multi-Admin
 *
 * Hiérarchie :
 *   superadmin      → Tout gérer (plateforme entière + créer des admins)
 *   admin_agences   → Gérer agences + leurs livreurs uniquement
 *   admin_relais    → Gérer points relais + leurs agents uniquement
 */

export type AdminRole = 'superadmin' | 'admin_agences' | 'admin_relais';

export interface AdminPermissions {
  canManageAgences:      boolean;  // voir/suspendre/valider les agences
  canManageRelais:       boolean;  // voir/suspendre les points relais & agents
  canManageVendeurs:     boolean;  // voir/suspendre les vendeurs
  canManageLivreurs:     boolean;  // voir/suspendre les livreurs
  canManageColis:        boolean;  // accès aux colis de la plateforme
  canViewSecurityLogs:   boolean;  // accès au centre de sécurité
  canManageAdmins:       boolean;  // créer/suspendre d'autres admins
  canManageSettings:     boolean;  // paramètres système (taux de change, etc.)
  canViewDiagnostics:    boolean;  // diagnostique système
}

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  superadmin: {
    canManageAgences:    true,
    canManageRelais:     true,
    canManageVendeurs:   true,
    canManageLivreurs:   true,
    canManageColis:      true,
    canViewSecurityLogs: true,
    canManageAdmins:     true,
    canManageSettings:   true,
    canViewDiagnostics:  true,
  },
  admin_agences: {
    canManageAgences:    true,
    canManageRelais:     false,
    canManageVendeurs:   false,
    canManageLivreurs:   true,   // livreurs liés aux agences
    canManageColis:      true,   // colis en transit via agences
    canViewSecurityLogs: false,
    canManageAdmins:     false,
    canManageSettings:   false,
    canViewDiagnostics:  false,
  },
  admin_relais: {
    canManageAgences:    false,
    canManageRelais:     true,
    canManageVendeurs:   false,
    canManageLivreurs:   false,
    canManageColis:      true,   // colis dans les points relais
    canViewSecurityLogs: false,
    canManageAdmins:     false,
    canManageSettings:   false,
    canViewDiagnostics:  false,
  },
};

export const ROLE_LABELS: Record<AdminRole, { label: string; description: string; color: string; bg: string }> = {
  superadmin: {
    label:       'Super Administrateur',
    description: 'Accès total — gestion de la plateforme entière et des admins',
    color:       '#f97316',
    bg:          'rgba(249,115,22,0.12)',
  },
  admin_agences: {
    label:       'Admin Agences',
    description: 'Gestion des agences de livraison et de leurs livreurs',
    color:       '#22c55e',
    bg:          'rgba(34,197,94,0.12)',
  },
  admin_relais: {
    label:       'Admin Points Relais',
    description: 'Gestion des points relais et de leurs agents',
    color:       '#fb923c',
    bg:          'rgba(251,146,60,0.12)',
  },
};

/** Vérifie si un admin a une permission donnée */
export function hasPermission(role: AdminRole, permission: keyof AdminPermissions): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

/** Liste des permissions actives pour un rôle */
export function getActivePermissions(role: AdminRole): (keyof AdminPermissions)[] {
  const perms = ROLE_PERMISSIONS[role];
  return (Object.keys(perms) as (keyof AdminPermissions)[]).filter(k => perms[k]);
}
