/**
 * POST /api/agency/confirm-deposit-qr
 * L'agence confirme la réception du cash via le token QR du livreur.
 * Body: { qrToken: string }
 * - Valide le token et l'expiration
 * - Marque la demande comme PAID
 * - Retourne les infos du livreur pour confirmation
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { qrToken } = await request.json();
    if (!qrToken || typeof qrToken !== 'string') {
      return NextResponse.json({ error: 'Token QR manquant.' }, { status: 400 });
    }

    // Trouver la demande correspondant au token
    const { data: req, error: fetchErr } = await supabase
      .from('driver_cash_requests')
      .select(`
        id,
        driver_id,
        agency_id,
        amount,
        status,
        type,
        qr_token,
        qr_expires_at,
        driver:drivers(
          id,
          phone,
          profile:profiles(name)
        )
      `)
      .eq('qr_token', qrToken)
      .eq('type', 'QR_DEPOSIT')
      .maybeSingle();

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'QR invalide ou introuvable.' }, { status: 404 });
    }

    // Vérifier que ce QR appartient à l'agence connectée
    if (req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: 'Ce QR n\'appartient pas à votre agence.' }, { status: 403 });
    }

    // Vérifier le statut
    if (req.status === 'PAID') {
      return NextResponse.json({ error: 'Ce dépôt a déjà été confirmé.' }, { status: 409 });
    }
    if (req.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Ce QR a été annulé.' }, { status: 410 });
    }
    if (req.status !== 'PENDING') {
      return NextResponse.json({ error: 'Demande déjà traitée.' }, { status: 409 });
    }

    // Vérifier l'expiration du token QR
    if (req.qr_expires_at && new Date(req.qr_expires_at) < new Date()) {
      return NextResponse.json({ error: 'QR expiré. Le livreur doit en générer un nouveau.' }, { status: 410 });
    }

    // Confirmer le dépôt → marquer PAID
    const { error: updateErr } = await supabase
      .from('driver_cash_requests')
      .update({
        status: 'PAID',
        resolved_at: new Date().toISOString(),
        confirmed_by_agency_id: session.agencyId,
      })
      .eq('id', req.id);

    if (updateErr) {
      console.error('Confirm deposit QR update error:', updateErr);
      return NextResponse.json({ error: 'Erreur lors de la confirmation.' }, { status: 500 });
    }

    // Récupérer le nom du livreur
    const driverProfile = req.driver as any;
    const driverName = driverProfile?.profile?.name || 'Livreur';
    const driverPhone = driverProfile?.phone || '';

    return NextResponse.json({
      success: true,
      requestId: req.id,
      amount: req.amount,
      driverName,
      driverPhone,
      confirmedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[POST /api/agency/confirm-deposit-qr]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

/**
 * GET /api/agency/confirm-deposit-qr?token=XXX
 * Prévisualise les infos du QR (sans confirmer) — pour affichage avant confirmation.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const qrToken = searchParams.get('token');
    if (!qrToken) {
      return NextResponse.json({ error: 'Token manquant.' }, { status: 400 });
    }

    const { data: req, error: fetchErr } = await supabase
      .from('driver_cash_requests')
      .select(`
        id,
        driver_id,
        agency_id,
        amount,
        status,
        qr_expires_at,
        driver:drivers(
          phone,
          profile:profiles(name)
        )
      `)
      .eq('qr_token', qrToken)
      .eq('type', 'QR_DEPOSIT')
      .maybeSingle();

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'QR invalide.' }, { status: 404 });
    }

    if (req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: 'QR d\'une autre agence.' }, { status: 403 });
    }

    const driverProfile = req.driver as any;
    const isExpired = req.qr_expires_at && new Date(req.qr_expires_at) < new Date();

    return NextResponse.json({
      requestId: req.id,
      amount: req.amount,
      status: req.status,
      isExpired,
      expiresAt: req.qr_expires_at,
      driverName: driverProfile?.profile?.name || 'Livreur',
      driverPhone: driverProfile?.phone || '',
    });
  } catch (err) {
    console.error('[GET /api/agency/confirm-deposit-qr]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
