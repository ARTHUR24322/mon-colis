/**
 * POST /api/packages/[id]/assign-drop-point
 * Body: { dropPointNumber: string }
 * Livreur dépose un colis à un point relais via le numéro de l'agent.
 * Migré de Prisma → Supabase + dataService
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

const assignSchema = z.object({
  dropPointNumber: z.string().regex(/^\d{9}$/, 'Le numéro agent doit contenir exactement 9 chiffres.'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'livreur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { id: colisId } = await params;
    const body = await request.json();
    const resultZod = assignSchema.safeParse(body);

    if (!colisId || !resultZod.success) {
      return NextResponse.json(
        { error: resultZod.error ? resultZod.error.issues[0].message : 'colisId et dropPointNumber sont requis.' },
        { status: 400 }
      );
    }
    const { dropPointNumber } = resultZod.data;

    // Vérifier que le colis existe et appartient au livreur
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, tracking_code, vendeur_id, status')
      .eq('id', colisId)
      .maybeSingle();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    // Assigner le colis au point relais via l'agent
    const result = await dataService.assignColisToDropPoint(
      colisId,
      dropPointNumber,
      session.driverId || session.userId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    // Notifier le vendeur
    await supabase.from('notifications').insert({
      user_id: pkg.vendeur_id,
      type: 'INFO',
      message: `Votre colis (${pkg.tracking_code}) a été déposé au point relais ${result.agent?.dropPointName || ''} et est en attente de confirmation.`,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      agent: result.agent,
    });
  } catch (err) {
    console.error('[POST /api/packages/[id]/assign-drop-point]', err);
    return NextResponse.json(
      { error: "Erreur interne lors de l'assignation." },
      { status: 500 }
    );
  }
}
