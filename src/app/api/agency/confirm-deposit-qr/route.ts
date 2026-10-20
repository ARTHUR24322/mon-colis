/**
 * POST /api/agency/confirm-deposit-qr
 * L'agence confirme la réception du cash via le token QR ou le code OTP à 6 chiffres du livreur.
 * Body: { qrToken?: string, otpCode?: string, phone?: string }
 *
 * GET /api/agency/confirm-deposit-qr
 * Prévisualise la demande avant confirmation.
 * Params: token ou otp, + phone (optionnel mais recommandé)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

/**
 * Résout l'ID du driver à partir de son numéro de téléphone.
 * Cherche d'abord dans la table drivers, puis profiles.
 */
async function resolveDriverIdByPhone(phone: string): Promise<string | null> {
  const cleanPhone = phone.replace(/\s/g, '');

  // Essai 1 : table drivers
  const { data: drv } = await supabase
    .from('drivers')
    .select('id')
    .or(`phone.eq.${cleanPhone},phone.ilike.%${cleanPhone}%`)
    .limit(1)
    .maybeSingle();

  if (drv?.id) return drv.id;

  // Essai 2 : table profiles (par numéro)
  const { data: prof } = await supabase
    .from('profiles')
    .select('id')
    .or(`phone.eq.${cleanPhone},phone.ilike.%${cleanPhone}%`)
    .limit(1)
    .maybeSingle();

  return prof?.id ?? null;
}

/**
 * Trouve la demande de dépôt QR/OTP correspondante.
 * Si driverIdFilter est fourni (résolu depuis le téléphone), on filtre dessus.
 */
async function findCashRequest(tokenOrOtp: string, driverIdFilter?: string | null) {
  const clean = tokenOrOtp.trim();

  const baseSelect = 'id, driver_id, agency_id, amount, status, type, qr_token, qr_expires_at, note, created_at';

  // ─── Cas 1 : code OTP 6 chiffres ────────────────────────────────────────────
  if (/^\d{6}$/.test(clean)) {
    // Chercher par OTP:XXXXXX dans la colonne note
    let qNote = supabase
      .from('driver_cash_requests')
      .select(baseSelect)
      .eq('type', 'QR_DEPOSIT')
      .eq('status', 'PENDING')
      .ilike('note', `%OTP:${clean}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (driverIdFilter) qNote = qNote.eq('driver_id', driverIdFilter);

    const { data: byNote } = await qNote.maybeSingle();
    if (byNote) return byNote;

    // Chercher par qr_token égal au code (cas dégénéré)
    let qTok = supabase
      .from('driver_cash_requests')
      .select(baseSelect)
      .eq('type', 'QR_DEPOSIT')
      .eq('status', 'PENDING')
      .eq('qr_token', clean)
      .order('created_at', { ascending: false })
      .limit(1);

    if (driverIdFilter) qTok = qTok.eq('driver_id', driverIdFilter);

    const { data: byTok } = await qTok.maybeSingle();
    if (byTok) return byTok;
  }

  // ─── Cas 2 : token QR long ───────────────────────────────────────────────────
  let qQr = supabase
    .from('driver_cash_requests')
    .select(baseSelect)
    .eq('type', 'QR_DEPOSIT')
    .eq('status', 'PENDING')
    .eq('qr_token', clean)
    .order('created_at', { ascending: false })
    .limit(1);

  if (driverIdFilter) qQr = qQr.eq('driver_id', driverIdFilter);

  const { data: byQr } = await qQr.maybeSingle();
  return byQr ?? null;
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

// ─────────────────────────────────────────────────────────────────────────────
// GET  — Prévisualisation avant confirmation
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tokenOrOtp = (
      searchParams.get('otp') ||
      searchParams.get('token') ||
      ''
    ).trim();
    const phone = (searchParams.get('phone') || '').trim();

    if (!tokenOrOtp) {
      return NextResponse.json({ error: 'Token ou code OTP manquant.' }, { status: 400 });
    }

    // Résoudre le driverId depuis le téléphone si fourni
    let driverIdFilter: string | null = null;
    if (phone) {
      driverIdFilter = await resolveDriverIdByPhone(phone);
      if (!driverIdFilter) {
        return NextResponse.json(
          { error: 'Aucun livreur trouvé avec ce numéro de téléphone.' },
          { status: 404 }
        );
      }
    }

    const req = await findCashRequest(tokenOrOtp, driverIdFilter);

    if (!req) {
      return NextResponse.json(
        { error: phone
            ? 'Code OTP incorrect pour ce livreur, ou demande introuvable.'
            : 'Code OTP ou QR introuvable.' },
        { status: 404 }
      );
    }

    if (req.agency_id && req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: 'Ce code appartient à une autre agence.' }, { status: 403 });
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

// ─────────────────────────────────────────────────────────────────────────────
// POST — Confirmation définitive du versement
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const tokenOrOtp = (body.qrToken || body.otpCode || '').trim();
    const phone = (body.phone || '').trim();

    if (!tokenOrOtp) {
      return NextResponse.json({ error: 'Token QR ou code OTP manquant.' }, { status: 400 });
    }

    // Résoudre le driverId depuis le téléphone si fourni
    let driverIdFilter: string | null = null;
    if (phone) {
      driverIdFilter = await resolveDriverIdByPhone(phone);
      if (!driverIdFilter) {
        return NextResponse.json(
          { error: 'Aucun livreur trouvé avec ce numéro de téléphone.' },
          { status: 404 }
        );
      }
    }

    const req = await findCashRequest(tokenOrOtp, driverIdFilter);

    if (!req) {
      return NextResponse.json(
        { error: phone
            ? 'Code OTP incorrect pour ce livreur. Vérifiez le numéro et le code.'
            : 'Code OTP ou QR invalide ou introuvable.' },
        { status: 404 }
      );
    }

    // Vérifier que ce QR appartient à l'agence connectée
    if (req.agency_id && req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: 'Ce code appartient à une autre agence.' }, { status: 403 });
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

    // Vérifier l'expiration
    if (req.qr_expires_at && new Date(req.qr_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Code OTP ou QR expiré. Le livreur doit en générer un nouveau.' },
        { status: 410 }
      );
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

    // Marquer les courses du livreur comme déchargées (non-bloquant)
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
