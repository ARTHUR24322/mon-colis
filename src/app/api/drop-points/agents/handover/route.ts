/**
 * POST /api/drop-points/agents/handover
 * Body: { pickupCode, dropPointId }
 * Hands over a package to a driver using the pickup code.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const { pickupCode, dropPointId } = await request.json() as { pickupCode: string; dropPointId: string };

    if (!pickupCode || !dropPointId) {
      return NextResponse.json({ error: 'pickupCode et dropPointId sont requis.' }, { status: 400 });
    }

    const { data: pkg, error } = await supabase
      .from('packages')
      .select('id, status, origin_drop_point_id')
      .eq('pickup_code', pickupCode)
      .eq('origin_drop_point_id', dropPointId)
      .single();

    if (error || !pkg) {
      return NextResponse.json({ error: 'Code de collecte invalide ou colis introuvable.' }, { status: 404 });
    }

    if (pkg.status !== 'WAITING_FOR_AGENCY_PICKUP') {
      return NextResponse.json({ error: 'Ce colis n\'est pas en attente de collecte.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('packages')
      .update({ status: 'IN_TRANSIT' })
      .eq('id', pkg.id);

    if (updateError) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Colis remis au livreur avec succès.' });
  } catch (err) {
    console.error('[POST /api/drop-points/agents/handover]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
