/**
 * POST /api/agency/confirm-deposit-qr
 * L'agence confirme la réception du cash via le token QR ou le code OTP à 6 chiffres du livreur.
 * Body: { qrToken: string } ou { otpCode: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

async function findCashRequest(tokenOrOtp: string) {
  const clean = tokenOrOtp.trim();

  // 1. Si 6 chiffres -> recherche par code OTP dans note ou qr_token
  if (/^\d{6}$/.test(clean)) {
    // Essai 1 : note contient le code OTP
    const { data: byNote, error: errNote } = await supabase
      .from('driver_cash_requests')
      .select('id, driver_id, agency_id, amount, status, type, qr_token, qr_expires_at, note, created_at')
      .eq('type', 'QR_DEPOSIT')
      .ilike('note', `%OTP:${clean}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!errNote && byNote) return byNote;

    // Essai 2 : qr_token égal au code
    const { data: byToken, error: errToken } = await supabase
      .from('driver_cash_requests')
      .select('id, driver_id, agency_id, amount, status, type, qr_token, qr_expires_at, note, created_at')
      .eq('type', 'QR_DEPOSIT')
      .eq('qr_token', clean)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!errToken && byToken) return byToken;
  }

  // 2. Recherche par token QR standard
  const { data: byQr, error: errQr } = await supabase
    .from('driver_cash_requests')
    .select('id, driver_id, agency_id, amount, status, type, qr_token, qr_expires_at, note, created_at')
    .eq('type', 'QR_DEPOSIT')
    .eq('qr_token', clean)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!errQr && byQr) return byQr;

  return null;
}

async function getDriverInfo(driverId: string) {
  try {
    const [{ data: prof }, { data: driv }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', driverId).maybeSingle(),
      supabase.from('drivers').select('phone').eq('id', driverId).maybeSingle(),
    ]);

    return {
      name: prof?.name || 'Livreur',
      phone: driv?.phone || '',
    };
  } catch {
    return { name: 'Livreur', phone: '' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const tokenOrOtp = (body.qrToken || body.otpCode || '').trim();
    if (!tokenOrOtp) {
      return NextResponse.json({ error: 'Token QR ou code OTP manquant.' }, { status: 400 });
    }

    const req = await findCashRequest(tokenOrOtp);

    if (!req) {
      return NextResponse.json({ error: 'Code OTP ou QR invalide ou introuvable.' }, { status: 404 });
    }

    // Vérifier que ce QR appartient à l'agence connectée
    if (req.agency_id && req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: "Ce code appartient à une autre agence." }, { status: 403 });
    }

    // Vérifier le statut
    if (req.status === 'PAID') {
      return NextResponse.json({ error: 'Ce versement a déjà été confirmé.' }, { status: 409 });
    }
    if (req.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Ce code a été annulé par une nouvelle génération.' }, { status: 410 });
    }
    if (req.status !== 'PENDING') {
      return NextResponse.json({ error: 'Demande déjà traitée.' }, { status: 409 });
    }

    // Vérifier l'expiration du token QR
    if (req.qr_expires_at && new Date(req.qr_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code OTP ou QR expiré. Le livreur doit en générer un nouveau.' }, { status: 410 });
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

    // Marquer les courses livrées du livreur comme déchargées pour cette agence
    try {
      await supabase
        .from('packages')
        .update({ vendor_paid: true })
        .eq('driver_id', req.driver_id)
        .eq('agency_id', session.agencyId)
        .eq('status', 'DELIVERED');
    } catch {
      // non-bloquant
    }

    const driverInfo = await getDriverInfo(req.driver_id);

    return NextResponse.json({
      success: true,
      requestId: req.id,
      amount: req.amount,
      driverName: driverInfo.name,
      driverPhone: driverInfo.phone,
      confirmedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[POST /api/agency/confirm-deposit-qr]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tokenOrOtp = (searchParams.get('token') || searchParams.get('otp') || '').trim();
    if (!tokenOrOtp) {
      return NextResponse.json({ error: 'Token ou code OTP manquant.' }, { status: 400 });
    }

    const req = await findCashRequest(tokenOrOtp);

    if (!req) {
      return NextResponse.json({ error: 'Code OTP ou QR introuvable.' }, { status: 404 });
    }

    if (req.agency_id && req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: "Ce code appartient à une autre agence." }, { status: 403 });
    }

    const driverInfo = await getDriverInfo(req.driver_id);
    const isExpired = req.qr_expires_at ? new Date(req.qr_expires_at) < new Date() : false;

    return NextResponse.json({
      requestId: req.id,
      amount: req.amount,
      status: req.status,
      isExpired,
      expiresAt: req.qr_expires_at,
      driverName: driverInfo.name,
      driverPhone: driverInfo.phone,
    });
  } catch (err) {
    console.error('[GET /api/agency/confirm-deposit-qr]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
