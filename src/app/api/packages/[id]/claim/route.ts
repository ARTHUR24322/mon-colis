/**
 * POST /api/packages/[id]/claim
 * Permet au vendeur d'ouvrir une réclamation sur son colis déposé en point relais.
 * Bloque immédiatement le retrait par le client tant que la réclamation n'est pas traitée.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { executePackageTransition } from '@/lib/package-state-machine';
import { z } from 'zod';

const claimSchema = z.object({
  reason: z.string().min(5, 'Le motif de la réclamation doit comporter au moins 5 caractères.'),
  idempotencyKey: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'vendeur' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }

    const { id: packageId } = await params;
    const body = await request.json();
    const parsed = claimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Données invalides.' }, { status: 400 });
    }

    const result = await executePackageTransition({
      packageId,
      targetStatus: 'IN_DISPUTE',
      action: 'OPEN_VENDOR_CLAIM',
      actor: {
        userId: session.userId,
        role: session.role,
        name: session.name || 'Vendeur',
      },
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Réclamation enregistrée. Le retrait du colis par le client est bloqué.',
      package: result.package,
    });
  } catch (err: any) {
    console.error('[POST /api/packages/[id]/claim]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
