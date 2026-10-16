/**
 * POST /api/packages/[id]/drop-point-decision
 * Body: { decision: 'ACCEPT' | 'REFUSE' }
 * L'agent point relais accepte ou refuse un colis déposé par un livreur.
 * Migré de Prisma → Supabase + dataService
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

const decisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'REFUSE']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'point_relais') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { id: colisId } = await params;
    const body = await request.json();
    const resultZod = decisionSchema.safeParse(body);

    if (!colisId || !resultZod.success) {
      return NextResponse.json(
        { error: 'colisId et decision (ACCEPT ou REFUSE) sont requis.' },
        { status: 400 }
      );
    }
    const { decision } = resultZod.data;

    // Vérifier que le colis existe
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, tracking_code, vendeur_id, driver_id, dest_drop_point_id')
      .eq('id', colisId)
      .maybeSingle();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    if (decision === 'ACCEPT') {
      // Confirmer la réception au point relais
      const result = await dataService.confirmDropPointReception(colisId, session.userId);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Colis accepté par le point relais. Il est maintenant disponible pour le client.',
      });
    }

    if (decision === 'REFUSE') {
      // Remettre le colis en transit
      const { error } = await supabase
        .from('packages')
        .update({
          status: 'IN_TRANSIT',
          dest_drop_point_id: null,
        })
        .eq('id', colisId);

      if (error) throw error;

      // Notifier le livreur que le colis a été refusé
      if (pkg.driver_id) {
        const dp = session.agencyId ? dataService.getDropPointById(session.agencyId) : null;
        await supabase.from('notifications').insert({
          user_id: pkg.driver_id,
          type: 'WARNING',
          message: `Le point relais ${dp?.name || ''} a refusé le colis (${pkg.tracking_code}). Veuillez récupérer le colis.`,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Colis refusé. Il est remis en transit.',
      });
    }

    return NextResponse.json({ error: 'Décision invalide. Utilisez ACCEPT ou REFUSE.' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/packages/[id]/drop-point-decision]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
