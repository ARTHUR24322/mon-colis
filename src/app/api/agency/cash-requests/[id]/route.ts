/**
 * PATCH /api/agency/cash-requests/[id]
 * L'agence marque une demande comme PAID ou REJECTED.
 * Body: { action: 'PAID' | 'REJECTED', rejectReason?: string, mobileMoneyRef?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import { logFinancialAudit } from '@/utils/auditLogger';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { action, rejectReason, mobileMoneyRef } = await request.json();
    if (!['PAID', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
    }

    // Vérifier que la demande appartient à cette agence
    const { data: req, error: fetchErr } = await supabase
      .from('driver_cash_requests')
      .select('id, agency_id, status, amount, driver_id')
      .eq('id', id)
      .single();

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    }
    if (req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }
    if (req.status !== 'PENDING') {
      return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 409 });
    }

    // Récupérer le nom réel du livreur
    const { data: driverProfile } = await supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', req.driver_id)
      .maybeSingle();

    const realDriverName = driverProfile?.name || 'Livreur';

    // Taux de change actuel
    let currentRate = 2800;
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('exchange_rate')
        .eq('id', 'global')
        .single();
      if (settings?.exchange_rate) currentRate = Number(settings.exchange_rate);
    } catch {/* fallback 2800 */}

    const updateData: Record<string, unknown> = {
      status: action,
      resolved_at: new Date().toISOString(),
    };
    if (action === 'REJECTED' && rejectReason) {
      updateData.reject_reason = rejectReason;
    }

    const { error: updateErr } = await supabase
      .from('driver_cash_requests')
      .update(updateData)
      .eq('id', id);

    if (updateErr) {
      console.error('Cash request update error:', updateErr);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
    }

    const idempotencyKey = `IDEM-PAY-CR-${id}-${action}`;
    const amountUsd = Math.round((req.amount / currentRate) * 100) / 100;

    // Log the transaction in the financial audit journal
    await logFinancialAudit({
      action_type: action === 'PAID' ? 'PAYMENT_DRIVER_TO_AGENCY' : 'REJECT_DRIVER_PAYMENT',
      idempotency_key: idempotencyKey,
      amount_cdf: req.amount,
      amount_usd: amountUsd,
      exchange_rate_applied: currentRate,
      actor_id: session.agencyId,
      actor_name: session.name || 'Agence',
      target_id: req.driver_id,
      target_name: realDriverName,
      target_role: 'livreur',
      status: action === 'PAID' ? 'COMPLETED' : 'REJECTED',
      reference: req.id,
      mobile_money_ref: mobileMoneyRef || null,
      notes: action === 'REJECTED'
        ? `Motif: ${rejectReason}`
        : `Versement de ${req.amount.toLocaleString('fr-FR')} FC (~${amountUsd} USD) du livreur ${realDriverName} reçu par l'agence.`
    });

    return NextResponse.json({ success: true, action, requestId: id });
  } catch (err) {
    console.error('[PATCH /api/agency/cash-requests/[id]]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
