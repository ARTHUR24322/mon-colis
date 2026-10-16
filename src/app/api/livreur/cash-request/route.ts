/**
 * POST /api/livreur/cash-request
 * Le livreur soumet une demande de versement à son agence.
 * Body: { amount, note? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'livreur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { amount, note } = await request.json();
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
    }

    // Récupérer le driver pour obtenir l'agency_id
    const { data: driver, error: driverErr } = await supabase
      .from('drivers')
      .select('id, agency_id, phone')
      .eq('id', session.driverId || session.userId)
      .single();

    if (driverErr || !driver) {
      return NextResponse.json({ error: 'Livreur introuvable.' }, { status: 404 });
    }

    // Vérifier qu'il n'y a pas déjà une demande PENDING
    const { data: existing } = await supabase
      .from('driver_cash_requests')
      .select('id')
      .eq('driver_id', driver.id)
      .eq('status', 'PENDING')
      .single();

    if (existing) {
      return NextResponse.json({
        error: 'Vous avez déjà une demande en attente. Attendez qu\'elle soit traitée.'
      }, { status: 409 });
    }

    // Créer la demande
    const { data: cashRequest, error: insertErr } = await supabase
      .from('driver_cash_requests')
      .insert({
        driver_id: driver.id,
        agency_id: driver.agency_id,
        amount,
        note: note || null,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (insertErr || !cashRequest) {
      console.error('Cash request insert error:', insertErr);
      return NextResponse.json({ error: 'Erreur lors de la création de la demande.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, requestId: cashRequest.id });
  } catch (err) {
    console.error('[POST /api/livreur/cash-request]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

/**
 * GET /api/livreur/cash-request
 * Historique des demandes du livreur connecté.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'livreur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data: requests, error } = await supabase
      .from('driver_cash_requests')
      .select('id, amount, status, note, reject_reason, created_at, resolved_at')
      .eq('driver_id', session.driverId || session.userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
    }

    return NextResponse.json({ requests: requests ?? [] });
  } catch (err) {
    console.error('[GET /api/livreur/cash-request]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
