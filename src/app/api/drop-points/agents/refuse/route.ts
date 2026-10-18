import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { executePackageTransition, DROP_POINT_REFUSAL_REASONS } from '@/lib/package-state-machine';
import { z } from 'zod';

/**
 * POST /api/drop-points/agents/refuse
 * Permet à un agent de point relais de refuser la réception d'un colis.
 * Exige un motif obligatoire (code standardisé + commentaire libre).
 * Notifie le vendeur et le livreur concernés.
 * Le colis passe en REFUSED_BY_DROP_POINT pour reprise en charge par le livreur.
 */

const refuseSchema = z.object({
  colisId: z.string().min(1, 'L\'identifiant du colis est requis.'),
  refusalReasonCode: z.string().min(1, 'Le code du motif de refus est obligatoire.'),
  comment: z.string().optional(),
  dropPointId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const parsed = refuseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données de requête invalides.' },
        { status: 400 }
      );
    }

    const { colisId, refusalReasonCode, comment, dropPointId, idempotencyKey } = parsed.data;

    // Trouver le libellé officiel du motif
    const matchedReason = DROP_POINT_REFUSAL_REASONS.find(r => r.code === refusalReasonCode);
    const reasonLabel = matchedReason ? matchedReason.label : refusalReasonCode;
    const fullReason = comment ? `${reasonLabel} — Commentaire: ${comment}` : reasonLabel;

    const effectiveDropPointId = session?.dropPointId || dropPointId;

    const result = await executePackageTransition({
      packageId: colisId,
      targetStatus: 'REFUSED_BY_DROP_POINT',
      action: 'DROP_POINT_REFUSE_PARCEL',
      actor: {
        userId: session?.userId || 'agent-relais',
        role: session?.role === 'point_relais' ? 'point_relais' : (session?.role || 'point_relais'),
        name: session?.name || `Point Relais ${effectiveDropPointId || ''}`,
        dropPointId: effectiveDropPointId,
      },
      reason: fullReason,
      idempotencyKey,
      metadata: {
        refusal_reason_code: refusalReasonCode,
        comment: comment || null,
        drop_point_id: effectiveDropPointId,
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Colis refusé avec succès. Le livreur et le vendeur ont été notifiés.',
      package: result.package,
    });
  } catch (err: any) {
    console.error('[POST /api/drop-points/agents/refuse] error:', err);
    return NextResponse.json({ error: err.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}
