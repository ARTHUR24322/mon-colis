/**
 * POST /api/agency/payments/initiate
 * L'agence initie un paiement vers un vendeur.
 * Génère un code OTP à 6 chiffres valable 15 minutes.
 * Body: { vendorId, amount, notes? }
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const { vendorId, amount, notes, requestId } = body;

    if (!vendorId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Vendeur et montant requis.' }, { status: 400 });
    }

    // Si une demande de versement spécifique est liée, s'assurer qu'elle est en cours (SEEN)
    if (requestId) {
      await supabase
        .from('vendor_payment_requests')
        .update({ status: 'SEEN' })
        .eq('id', requestId)
        .eq('status', 'PENDING');
    }

    // Invalider les anciens codes OTP non utilisés pour ce vendeur auprès de cette agence
    await supabase
      .from('payment_otps')
      .update({ used: true })
      .eq('vendor_id', vendorId)
      .eq('agency_id', session.agencyId)
      .eq('used', false);

    // Générer le code OTP à 6 chiffres
    const otpPlain = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpPlain, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    // Construire la note avec le requestId si présent
    const formattedNotes = requestId
      ? `REQUEST_ID:${requestId}${notes ? ' - ' + notes : ''}`
      : (notes || null);

    // Créer l'entrée dans le ledger (statut PENDING)
    const { data: ledgerEntry, error: ledgerErr } = await supabase
      .from('ledger_entries')
      .insert({
        agency_id: session.agencyId,
        vendor_id: vendorId,
        type: 'VENDOR_PAYMENT_INITIATED',
        amount,
        currency: 'CDF',
        status: 'PENDING',
        notes: formattedNotes,
      })
      .select('id')
      .single();

    if (ledgerErr || !ledgerEntry) {
      console.error('Ledger insert error:', ledgerErr);
      return NextResponse.json({ error: 'Erreur lors de la création de la transaction.' }, { status: 500 });
    }

    // Enregistrer l'OTP
    const { error: otpErr } = await supabase
      .from('payment_otps')
      .insert({
        ledger_entry_id: ledgerEntry.id,
        agency_id: session.agencyId,
        vendor_id: vendorId,
        amount,
        otp_hash: otpHash,
        expires_at: expiresAt,
      });

    if (otpErr) {
      console.error('OTP insert error:', otpErr);
      return NextResponse.json({ error: 'Erreur lors de la génération du code OTP.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ledgerEntryId: ledgerEntry.id,
      otp: otpPlain,           // Affiché UNE SEULE FOIS à l'agence
      amount,
      expiresAt,
    });
  } catch (err) {
    console.error('[POST /api/agency/payments/initiate]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
