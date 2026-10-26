/**
 * POST /api/vendor/payments/confirm
 * Le vendeur confirme la réception d'un paiement via le code OTP.
 * Body: { otpCode }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import { logFinancialAudit } from '@/utils/auditLogger';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { otpCode } = await request.json();
    if (!otpCode || String(otpCode).trim().length !== 6) {
      return NextResponse.json({ error: 'Code OTP invalide (6 chiffres requis).' }, { status: 400 });
    }

    const cleanOtp = String(otpCode).trim();

    // Chercher les OTPs valides pour ce vendeur (non utilisés, avec 30 min de grâce après expiration formelle)
    const graceCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: otps, error: otpErr } = await supabase
      .from('payment_otps')
      .select('id, ledger_entry_id, agency_id, amount, otp_hash, expires_at')
      .eq('vendor_id', session.userId)
      .eq('used', false)
      .gte('expires_at', graceCutoff)
      .order('created_at', { ascending: false });

    if (otpErr) {
      console.error('[POST /api/vendor/payments/confirm] Erreur lecture payment_otps:', otpErr);
      return NextResponse.json({ error: 'Erreur lors de la vérification du code.' }, { status: 500 });
    }

    if (!otps || otps.length === 0) {
      return NextResponse.json({
        error: 'Aucun paiement en attente ou code expiré. Demandez à votre agence de générer un nouveau code.'
      }, { status: 404 });
    }

    // Vérifier le code OTP contre chaque entrée valide
    let matchedOtp: typeof otps[0] | null = null;
    for (const otp of otps) {
      const valid = await bcrypt.compare(cleanOtp, otp.otp_hash);
      if (valid) {
        matchedOtp = otp;
        break;
      }
    }

    if (!matchedOtp) {
      return NextResponse.json({ error: 'Code incorrect. Vérifiez le code auprès de votre agence.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Marquer l'OTP comme utilisé
    await supabase
      .from('payment_otps')
      .update({ used: true })
      .eq('id', matchedOtp.id);

    // Confirmer la transaction dans le ledger
    const { data: updatedLedger, error: confirmErr } = await supabase
      .from('ledger_entries')
      .update({
        status: 'CONFIRMED',
        type: 'VENDOR_PAYMENT_CONFIRMED',
        confirmed_by_vendor_at: now,
        confirmed_by_agency_at: now,
      })
      .eq('id', matchedOtp.ledger_entry_id)
      .select('id, notes')
      .single();

    if (confirmErr) {
      console.error('Ledger confirm error:', confirmErr);
      return NextResponse.json({ error: 'Erreur lors de la confirmation.' }, { status: 500 });
    }

    // Mettre à jour la demande de virement correspondante dans vendor_payment_requests (passage à PAID)
    let matchedRequestId: string | null = null;
    if (updatedLedger?.notes && updatedLedger.notes.includes('REQUEST_ID:')) {
      const match = updatedLedger.notes.match(/REQUEST_ID:([a-f0-9-]+)/i);
      if (match) {
        matchedRequestId = match[1];
      }
    }

    if (matchedRequestId) {
      await supabase
        .from('vendor_payment_requests')
        .update({
          status: 'PAID',
          resolved_at: now,
        })
        .eq('id', matchedRequestId);
    } else {
      // Fallback : marquer la demande en cours la plus récente de ce vendeur auprès de cette agence
      const { data: openReq } = await supabase
        .from('vendor_payment_requests')
        .select('id')
        .eq('vendor_id', session.userId)
        .eq('agency_id', matchedOtp.agency_id)
        .in('status', ['PENDING', 'SEEN'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openReq) {
        await supabase
          .from('vendor_payment_requests')
          .update({
            status: 'PAID',
            resolved_at: now,
          })
          .eq('id', openReq.id);
      }
    }

    // ✅ Marquer tous les colis livrés de ce vendeur auprès de cette agence comme versés
    // Ceci recalcule le solde côté vendeur (vendor_paid = true → le colis sort du solde en attente)
    await supabase
      .from('packages')
      .update({ vendor_paid: true })
      .eq('agency_id', matchedOtp.agency_id)
      .eq('vendeur_id', session.userId)
      .eq('status', 'DELIVERED')
      .eq('is_prepaid', false)
      .eq('vendor_paid', false);

    // Journal d'audit financier
    try {
      const { data: agencyProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', matchedOtp.agency_id)
        .maybeSingle();

      let currentRate = 2800;
      try {
        const { data: settings } = await supabase
          .from('system_settings')
          .select('exchange_rate')
          .eq('id', 'global')
          .single();
        if (settings?.exchange_rate) currentRate = Number(settings.exchange_rate);
      } catch {/* fallback 2800 */}

      const amountUsd = Math.round((matchedOtp.amount / currentRate) * 100) / 100;

      await logFinancialAudit({
        action_type: 'PAYMENT_AGENCY_TO_VENDOR',
        idempotency_key: `IDEM-PAY-CONFIRM-${matchedOtp.id}`,
        amount_cdf: matchedOtp.amount,
        amount_usd: amountUsd,
        exchange_rate_applied: currentRate,
        actor_id: matchedOtp.agency_id,
        actor_name: agencyProfile?.name || 'Agence',
        target_id: session.userId,
        target_name: session.name || 'Vendeur',
        target_role: 'vendeur',
        status: 'COMPLETED',
        reference: matchedOtp.ledger_entry_id,
        notes: `Paiement de ${matchedOtp.amount.toLocaleString('fr-FR')} FC (~${amountUsd} USD) confirmé par le vendeur via validation OTP.`
      });
    } catch (auditErr) {
      console.warn('[confirm/route] Erreur enregistrement audit financier:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Paiement de ${matchedOtp.amount.toLocaleString('fr-FR')} CDF confirmé avec succès !`,
      amount: matchedOtp.amount,
      confirmedAt: now,
    });
  } catch (err) {
    console.error('[POST /api/vendor/payments/confirm]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
