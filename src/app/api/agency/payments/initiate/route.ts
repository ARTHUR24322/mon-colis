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
    const { vendorId, amount: inputAmount, notes, requestId, currency: inputCurrency } = body;

    if (!vendorId || !inputAmount || Number(inputAmount) <= 0) {
      return NextResponse.json({ error: 'Vendeur et montant requis.' }, { status: 400 });
    }

    // Déterminer le taux de conversion réel
    let effectiveRate = 2400;
    try {
      const { data: ag } = await supabase
        .from('agencies')
        .select('taux_fc')
        .eq('id', session.agencyId)
        .maybeSingle();

      if (ag?.taux_fc) {
        effectiveRate = Number(ag.taux_fc);
      } else {
        const { data: sys } = await supabase
          .from('system_settings')
          .select('exchange_rate')
          .eq('id', 'global')
          .maybeSingle();
        if (sys?.exchange_rate) effectiveRate = Number(sys.exchange_rate);
      }
    } catch {}

    // Conversion : uniquement si la devise est explicitement 'USD', ou si le montant est clairement
    // une valeur en dollars (< 10 sans devise précisée). Si currency === 'CDF' ou si le montant
    // est déjà en FC (>= 500), on ne reconvertit PAS pour éviter la double conversion.
    let amount = Number(inputAmount);
    if (inputCurrency === 'CDF') {
      // Montant déjà en CDF : pas de conversion
      amount = Math.round(amount);
    } else if (inputCurrency === 'USD') {
      // Montant en USD explicite : convertir en CDF
      amount = Math.round(amount * effectiveRate);
    } else {
      // Pas de devise précisée : heuristique de sécurité
      // Si le montant est clairement un montant USD (< 100), convertir. Sinon (>= 100), déjà en CDF.
      if (amount < 100) {
        amount = Math.round(amount * effectiveRate);
      } else {
        amount = Math.round(amount);
      }
    }

    // Invalider les anciens codes OTP non utilisés pour ce vendeur auprès de cette agence
    await supabase
      .from('payment_otps')
      .update({ used: true })
      .eq('vendor_id', vendorId)
      .eq('agency_id', session.agencyId)
      .eq('used', false);

    // Générer le code OTP à 6 chiffres (valable 60 min pour laisser le temps au vendeur)
    const otpPlain = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpPlain, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 min

    // Si une demande de versement spécifique est liée ou existe, enregistrer le code & expiration
    let targetRequestId = requestId;
    if (!targetRequestId) {
      const { data: openReq } = await supabase
        .from('vendor_payment_requests')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('agency_id', session.agencyId)
        .in('status', ['PENDING', 'SEEN'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openReq) targetRequestId = openReq.id;
    }

    if (targetRequestId) {
      await supabase
        .from('vendor_payment_requests')
        .update({
          status: 'SEEN',
          message: JSON.stringify({ code: otpPlain, expiresAt }),
        })
        .eq('id', targetRequestId);
    } else {
      // Si aucune demande existante, créer l'enregistrement pour qu'il apparaisse chez le vendeur
      const { data: createdReq } = await supabase
        .from('vendor_payment_requests')
        .insert({
          vendor_id: vendorId,
          agency_id: session.agencyId,
          amount,
          status: 'SEEN',
          message: JSON.stringify({ code: otpPlain, expiresAt }),
        })
        .select('id')
        .maybeSingle();
      if (createdReq) targetRequestId = createdReq.id;
    }

    // Construire la note avec le requestId si présent
    const formattedNotes = targetRequestId
      ? `REQUEST_ID:${targetRequestId} OTP:${otpPlain}${notes ? ' - ' + notes : ''}`
      : `OTP:${otpPlain}${notes ? ' - ' + notes : ''}`;

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
