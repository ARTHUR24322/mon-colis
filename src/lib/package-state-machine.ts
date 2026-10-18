/**
 * Moncolis — Machine à états stricte pour le cycle de vie des colis
 * Côté serveur : garantit l'intégrité, les rôles, l'appartenance, l'idempotence et l'audit.
 */

import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

export type PackageDbStatus =
  | 'CREATED'
  | 'PENDING_AGENCY'
  | 'ACCEPTED_BY_AGENCY'
  | 'REJECTED_BY_AGENCY'
  | 'ASSIGNED_TO_DRIVER'
  | 'IN_TRANSIT'
  | 'DEPOSITED_AT_DROP_POINT'
  | 'AVAILABLE_AT_PICKUP_POINT'
  | 'WAITING_FOR_AGENCY_PICKUP'
  | 'REFUSED_BY_DROP_POINT'
  | 'IN_DISPUTE'
  | 'DELIVERED'
  | 'CANCELLED';

export type UserRole = 'vendeur' | 'agence' | 'livreur' | 'point_relais' | 'superadmin';

export interface TransitionActor {
  userId: string;
  role: UserRole;
  name: string;
  agencyId?: string;
  driverId?: string;
  dropPointId?: string;
}

export interface TransitionRequest {
  packageId: string;
  targetStatus: PackageDbStatus;
  action: string;
  actor: TransitionActor;
  reason?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  success: boolean;
  message: string;
  previousStatus?: PackageDbStatus;
  newStatus?: PackageDbStatus;
  package?: any;
}

// Liste officielle des motifs de refus par un point relais
export const DROP_POINT_REFUSAL_REASONS = [
  { code: 'DAMAGED_PARCEL', label: 'Colis endommagé ou reconditionné' },
  { code: 'OVERSIZED', label: 'Hors gabarit (trop volumineux ou trop lourd)' },
  { code: 'CAPACITY_REACHED', label: 'Capacité de stockage du point relais atteinte' },
  { code: 'SUSPICIOUS_CONTENT', label: 'Colis suspect ou non conforme' },
  { code: 'MISSING_LABEL', label: 'Absence de code ou étiquetage illisible' },
  { code: 'OTHER', label: 'Autre motif spécifique' },
] as const;

export type DropPointRefusalReasonCode = typeof DROP_POINT_REFUSAL_REASONS[number]['code'];

// Matrice des transitions permises par rôle
interface TransitionRule {
  allowedRoles: UserRole[];
  description: string;
}

const TRANSITIONS_RULES: Partial<Record<PackageDbStatus, Partial<Record<PackageDbStatus, TransitionRule>>>> = {
  CREATED: {
    PENDING_AGENCY: { allowedRoles: ['vendeur', 'superadmin'], description: 'Attribution à une agence' },
    ACCEPTED_BY_AGENCY: { allowedRoles: ['agence', 'superadmin'], description: 'Acceptation directe par agence' },
    DEPOSITED_AT_DROP_POINT: { allowedRoles: ['vendeur', 'superadmin'], description: 'Dépôt premier kilomètre au relais' },
    CANCELLED: { allowedRoles: ['vendeur', 'superadmin'], description: 'Annulation du colis' },
  },
  PENDING_AGENCY: {
    ACCEPTED_BY_AGENCY: { allowedRoles: ['agence', 'superadmin'], description: 'Acceptation par agence' },
    REJECTED_BY_AGENCY: { allowedRoles: ['agence', 'superadmin'], description: 'Refus par agence' },
    CANCELLED: { allowedRoles: ['vendeur', 'superadmin'], description: 'Annulation du colis' },
  },
  ACCEPTED_BY_AGENCY: {
    ASSIGNED_TO_DRIVER: { allowedRoles: ['agence', 'superadmin'], description: 'Assignation à un livreur' },
    IN_TRANSIT: { allowedRoles: ['livreur', 'agence', 'superadmin'], description: 'Prise en charge par le livreur' },
    CANCELLED: { allowedRoles: ['agence', 'superadmin'], description: 'Annulation' },
  },
  ASSIGNED_TO_DRIVER: {
    IN_TRANSIT: { allowedRoles: ['livreur', 'agence', 'superadmin'], description: 'Livreur démarre la course' },
    CANCELLED: { allowedRoles: ['agence', 'superadmin'], description: 'Annulation' },
  },
  IN_TRANSIT: {
    DEPOSITED_AT_DROP_POINT: { allowedRoles: ['livreur', 'superadmin'], description: 'Livreur dépose au point relais (zone inaccessible)' },
    DELIVERED: { allowedRoles: ['livreur', 'superadmin'], description: 'Livraison directe au client (OTP validé)' },
    CANCELLED: { allowedRoles: ['agence', 'superadmin'], description: 'Annulation en cours de route' },
  },
  DEPOSITED_AT_DROP_POINT: {
    AVAILABLE_AT_PICKUP_POINT: { allowedRoles: ['point_relais', 'superadmin'], description: 'Relais accepte le colis déposé par le livreur' },
    WAITING_FOR_AGENCY_PICKUP: { allowedRoles: ['point_relais', 'superadmin'], description: 'Relais accepte le colis déposé par le vendeur' },
    REFUSED_BY_DROP_POINT: { allowedRoles: ['point_relais', 'superadmin'], description: 'Relais refuse le colis avec motif' },
    IN_DISPUTE: { allowedRoles: ['vendeur', 'superadmin'], description: 'Réclamation vendeur sur colis déposé' },
  },
  WAITING_FOR_AGENCY_PICKUP: {
    IN_TRANSIT: { allowedRoles: ['livreur', 'superadmin'], description: 'Livreur récupère le colis au point relais (code de collecte validé)' },
    CANCELLED: { allowedRoles: ['vendeur', 'superadmin'], description: 'Annulation avant collecte' },
  },
  AVAILABLE_AT_PICKUP_POINT: {
    DELIVERED: { allowedRoles: ['point_relais', 'superadmin'], description: 'Client retire son colis au relais avec OTP' },
    IN_DISPUTE: { allowedRoles: ['vendeur', 'superadmin'], description: 'Réclamation vendeur (bloque le retrait)' },
  },
  REFUSED_BY_DROP_POINT: {
    IN_TRANSIT: { allowedRoles: ['livreur', 'superadmin'], description: 'Le livreur récupère le colis refusé pour retour' },
    CANCELLED: { allowedRoles: ['agence', 'superadmin'], description: 'Annulation après refus relais' },
  },
  IN_DISPUTE: {
    // Règle 4.1.a : Le Super Admin uniquement peut lever une réclamation
    AVAILABLE_AT_PICKUP_POINT: { allowedRoles: ['superadmin'], description: 'Super Admin lève la réclamation : remis à disposition' },
    REFUSED_BY_DROP_POINT: { allowedRoles: ['superadmin'], description: 'Super Admin renvoie le colis vers le livreur' },
    CANCELLED: { allowedRoles: ['superadmin'], description: 'Super Admin annule définitivement le colis pour retour' },
  },
  DELIVERED: {
    // État final : aucune transition autorisée
  },
  CANCELLED: {
    // État final
  },
};

/**
 * Enregistre une entrée dans le journal d'audit immuable des colis
 */
export async function logPackageAudit(data: {
  packageId: string;
  packageCode?: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  reason?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { error } = await supabase.from('package_audit_logs').insert({
      package_id: data.packageId,
      package_code: data.packageCode || null,
      actor_id: data.actorId || null,
      actor_name: data.actorName,
      actor_role: data.actorRole,
      from_status: data.fromStatus,
      to_status: data.toStatus,
      action: data.action,
      reason: data.reason || null,
      idempotency_key: data.idempotencyKey || null,
      metadata: data.metadata || {},
    });
    if (error) {
      console.warn('[logPackageAudit] Erreur insertion audit:', error.message);
    }
  } catch (err) {
    console.warn('[logPackageAudit] Exception audit log:', err);
  }
}

/**
 * Envoie une notification in-app à un utilisateur
 */
export async function notifyUser(userId: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT', message: string) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      message,
    });
  } catch (err) {
    console.warn('[notifyUser] Notification non envoyée:', err);
  }
}

/**
 * Exécute une transition d'état avec vérification d'idempotence, de rôle et d'appartenance
 */
export async function executePackageTransition(req: TransitionRequest): Promise<TransitionResult> {
  const { packageId, targetStatus, action, actor, reason, idempotencyKey, metadata } = req;

  // 1. Idempotence : si une clé d'idempotence est fournie et déjà traitée, retourner succès immédiat
  if (idempotencyKey) {
    const { data: existingAudit } = await supabase
      .from('package_audit_logs')
      .select('id, to_status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingAudit) {
      return {
        success: true,
        message: 'Action déjà exécutée (idempotence respectée).',
        newStatus: existingAudit.to_status as PackageDbStatus,
      };
    }
  }

  // 2. Charger le colis
  const { data: pkg, error: pkgErr } = await supabase
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .single();

  if (pkgErr || !pkg) {
    return { success: false, message: 'Colis introuvable.' };
  }

  const currentStatus = pkg.status as PackageDbStatus;

  // Si le statut actuel est déjà le statut cible, éviter une fausse transition
  if (currentStatus === targetStatus) {
    return {
      success: true,
      message: 'Le colis est déjà dans ce statut.',
      previousStatus: currentStatus,
      newStatus: targetStatus,
      package: pkg,
    };
  }

  // 3. Vérification de l'appartenance selon le rôle
  if (actor.role === 'vendeur') {
    if (pkg.vendeur_id !== actor.userId) {
      return { success: false, message: 'Non autorisé : ce colis n\'appartient pas à votre compte vendeur.' };
    }
  } else if (actor.role === 'agence') {
    const agencyId = actor.agencyId || actor.userId;
    if (pkg.agency_id && pkg.agency_id !== agencyId) {
      return { success: false, message: 'Non autorisé : ce colis n\'est pas attribué à votre agence.' };
    }
  } else if (actor.role === 'livreur') {
    const driverId = actor.driverId || actor.userId;
    if (pkg.driver_id && pkg.driver_id !== driverId) {
      return { success: false, message: 'Non autorisé : cette course ne vous est pas assignée.' };
    }
  } else if (actor.role === 'point_relais') {
    const dpId = actor.dropPointId;
    if (!dpId) {
      return { success: false, message: 'Point relais non identifié.' };
    }
    const isDest = pkg.dest_drop_point_id === dpId;
    const isOrigin = pkg.origin_drop_point_id === dpId;
    if (!isDest && !isOrigin) {
      return { success: false, message: 'Non autorisé : ce colis n\'est pas rattaché à votre point relais.' };
    }
  }

  // 4. Blocage strict par réclamation
  if (currentStatus === 'IN_DISPUTE' && targetStatus === 'DELIVERED') {
    return {
      success: false,
      message: "Retrait strictement bloqué : ce colis fait l'objet d'une réclamation en cours par le vendeur.",
    };
  }

  // 5. Vérification de la transition dans la matrice
  const allowedFromCurrent = TRANSITIONS_RULES[currentStatus];
  if (!allowedFromCurrent) {
    return { success: false, message: `Aucune transition permise depuis le statut ${currentStatus}.` };
  }

  const rule = allowedFromCurrent[targetStatus];
  if (!rule) {
    return {
      success: false,
      message: `Transition illégale : passage impossible de ${currentStatus} vers ${targetStatus}.`,
    };
  }

  if (actor.role !== 'superadmin' && !rule.allowedRoles.includes(actor.role)) {
    return {
      success: false,
      message: `Rôle ${actor.role} non autorisé pour cette action (${rule.description}).`,
    };
  }

  // 6. Préparer les modifications sur la table `packages`
  const updateData: Record<string, unknown> = {
    status: targetStatus,
    updated_at: new Date().toISOString(),
  };

  // Traitement spécifique selon le statut cible
  if (targetStatus === 'REFUSED_BY_DROP_POINT') {
    updateData.refusal_comment = reason || 'Colis refusé par le point relais';
    updateData.refused_at = new Date().toISOString();
  } else if (targetStatus === 'IN_DISPUTE') {
    updateData.claim_reason = reason || 'Réclamation signalée par le vendeur';
    updateData.claimed_at = new Date().toISOString();
    updateData.claim_status = 'OPEN';
  } else if (pkg.claim_status === 'OPEN') {
    updateData.claim_status = 'RESOLVED';
    updateData.resolved_at = new Date().toISOString();
    updateData.resolved_by = actor.userId;
    updateData.resolution_note = reason || 'Réclamation levée par le Super Admin';
  }

  // 7. Appliquer l'update en base
  const { data: updatedPkg, error: updateErr } = await supabase
    .from('packages')
    .update(updateData)
    .eq('id', packageId)
    .select()
    .single();

  if (updateErr) {
    return { success: false, message: `Échec mise à jour en base : ${updateErr.message}` };
  }

  // 8. Enregistrer dans package_audit_logs
  await logPackageAudit({
    packageId,
    packageCode: pkg.tracking_code || pkg.short_code,
    actorId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: currentStatus,
    toStatus: targetStatus,
    action,
    reason,
    idempotencyKey,
    metadata: {
      ...metadata,
      rule_description: rule.description,
    },
  });

  // 9. Dispatch des notifications pertinentes
  const pkgCode = pkg.tracking_code || pkg.short_code || `#${packageId.slice(0, 8)}`;

  if (targetStatus === 'REFUSED_BY_DROP_POINT') {
    // Notifier le livreur (qui doit récupérer le colis selon la règle 4.2)
    if (pkg.driver_id) {
      await notifyUser(
        pkg.driver_id,
        'WARNING',
        `Le point relais a refusé le colis ${pkgCode}. Motif : "${reason}". Veuillez récupérer le colis.`
      );
    }
    // Notifier le vendeur
    if (pkg.vendeur_id) {
      await notifyUser(
        pkg.vendeur_id,
        'ALERT',
        `Votre colis ${pkgCode} a été refusé par le point relais. Motif : "${reason}". Le livreur le prend en charge.`
      );
    }
  } else if (targetStatus === 'IN_DISPUTE') {
    // Notifier le livreur et l'agence
    if (pkg.driver_id) {
      await notifyUser(
        pkg.driver_id,
        'ALERT',
        `Une réclamation vendeur bloque le colis ${pkgCode}. Le retrait par le client est suspendu.`
      );
    }
    if (pkg.agency_id) {
      await notifyUser(
        pkg.agency_id,
        'WARNING',
        `Réclamation vendeur ouverte sur le colis ${pkgCode} : "${reason}".`
      );
    }
  } else if (targetStatus === 'AVAILABLE_AT_PICKUP_POINT' && currentStatus === 'IN_DISPUTE') {
    // Réclamation levée par le Super Admin
    if (pkg.vendeur_id) {
      await notifyUser(
        pkg.vendeur_id,
        'INFO',
        `La réclamation sur le colis ${pkgCode} a été levée par le Super Admin. Le colis est à nouveau disponible.`
      );
    }
  }

  return {
    success: true,
    message: 'Transition effectuée avec succès.',
    previousStatus: currentStatus,
    newStatus: targetStatus,
    package: updatedPkg,
  };
}
