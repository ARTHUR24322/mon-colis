/**
 * POST /api/livreur/deposit-qr
 * Le livreur génère un QR code de dépôt à présenter à l'agence.
 * Crée une demande de versement avec un token QR unique.
 * Body: { amount: number }
 *
 * GET /api/livreur/deposit-qr
 * Retourne la demande QR PENDING active du livreur (si existante).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

/** Génère un token aléatoire URL-safe de 32 caractères */
function generateQrToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'livreur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { amount: rawAmount } = await request.json();
    if (!rawAmount || rawAmount <= 0) {
      return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
    }
    // Arrondir en entier (la colonne DB est de type integer)
    const amount = Math.round(rawAmount);

    // Récupérer le driver pour obtenir l'agency_id
    const driverId = session.driverId || session.userId;
    const { data: driver, error: driverErr } = await supabase
      .from('drivers')
      .select('id, agency_id')
      .eq('id', driverId)
      .single();

    if (driverErr || !driver) {
      return NextResponse.json({ error: 'Livreur introuvable.' }, { status: 404 });
    }

    // Annuler tout token QR PENDING existant (renouvellement)
    await supabase
      .from('driver_cash_requests')
      .update({ status: 'CANCELLED' })
      .eq('driver_id', driver.id)
      .eq('status', 'PENDING')
      .eq('type', 'QR_DEPOSIT');

    // Créer une nouvelle demande avec token QR
    const qrToken = generateQrToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // expire dans 30 min

    const { data: cashRequest, error: insertErr } = await supabase
      .from('driver_cash_requests')
      .insert({
        driver_id: driver.id,
        agency_id: driver.agency_id,
        amount,
        note: null,
        status: 'PENDING',
        type: 'QR_DEPOSIT',
        qr_token: qrToken,
        qr_expires_at: expiresAt,
      })
      .select('id, qr_token, qr_expires_at, amount, created_at')
      .single();

    if (insertErr || !cashRequest) {
      console.error('Deposit QR insert error:', insertErr);
      // Si l'erreur indique que la colonne n'existe pas, suggérer la migration
      const hint = insertErr?.code === '42703' || insertErr?.message?.includes('column')
        ? 'Veuillez exécuter la migration SQL (migration_qr_deposit.sql) dans Supabase.'
        : insertErr?.message || 'Erreur lors de la création du QR.';
      return NextResponse.json({ error: hint }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requestId: cashRequest.id,
      qrToken: cashRequest.qr_token,
      amount: cashRequest.amount,
      expiresAt: cashRequest.qr_expires_at,
    });
  } catch (err) {
    console.error('[POST /api/livreur/deposit-qr]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'livreur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const driverId = session.driverId || session.userId;

    // Chercher la demande QR PENDING non expirée
    const { data: existing } = await supabase
      .from('driver_cash_requests')
      .select('id, qr_token, qr_expires_at, amount, status, created_at')
      .eq('driver_id', driverId)
      .eq('type', 'QR_DEPOSIT')
      .eq('status', 'PENDING')
      .gt('qr_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ pending: existing || null });
  } catch (err) {
    console.error('[GET /api/livreur/deposit-qr]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
