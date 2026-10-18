/**
 * POST /api/packages/[id]/resolve-claim
 * Permet au Super Admin de lever ou traiter une réclamation vendeur.
 * Options de résolution :
 *   - 'RESTORE_AVAILABLE' : Remet le colis à disposition pour retrait client
 *   - 'RETURN_DRIVER'     : Renvoie le colis en transit / retour vers le livreur
 *   - 'CANCEL'            : Annule définitivement le colis
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { getSession } from '@/lib/session-server';
import { executePackageTransition, PackageDbStatus } from '@/lib/package-state-machine';
import { z } from 'zod';

const resolveSchema = z.object({
  resolution: z.enum(['RESTORE_AVAILABLE', 'RETURN_DRIVER', 'CANCEL']),
  note: z.string().min(3, 'Une note explicative de la résolution est obligatoire.'),
  idempotencyKey: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérification de la session admin (soit cookie admin_session, soit cookie mc_session avec rôle superadmin)
    const adminSession = await requireAdminSession();
    const mcSession = await getSession();

    const isSuperAdmin =
      adminSession?.role === 'superadmin' ||
      mcSession?.role === 'superadmin';

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Action strictement réservée au Super Admin.' },
        { status: 403 }
      );
    }

    const { id: packageId } = await params;
    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Données invalides.' }, { status: 400 });
    }

    const { resolution, note, idempotencyKey } = parsed.data;

    let targetStatus: PackageDbStatus = 'AVAILABLE_AT_PICKUP_POINT';
    let action = 'RESOLVE_CLAIM_RESTORE';

    if (resolution === 'RETURN_DRIVER') {
      targetStatus = 'REFUSED_BY_DROP_POINT';
      action = 'RESOLVE_CLAIM_RETURN_DRIVER';
    } else if (resolution === 'CANCEL') {
      targetStatus = 'CANCELLED';
      action = 'RESOLVE_CLAIM_CANCEL';
    }

    const adminName = adminSession?.email || mcSession?.name || 'Super Admin';
    const adminId = mcSession?.userId || 'admin';

    const result = await executePackageTransition({
      packageId,
      targetStatus,
      action,
      actor: {
        userId: adminId,
        role: 'superadmin',
        name: adminName,
      },
      reason: note,
      idempotencyKey,
      metadata: { resolution },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Réclamation résolue avec succès.',
      package: result.package,
    });
  } catch (err: any) {
    console.error('[POST /api/packages/[id]/resolve-claim]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
