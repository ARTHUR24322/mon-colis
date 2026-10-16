/**
 * PATCH /api/agency/cash-requests/[id]
 * L'agence marque une demande comme PAID ou REJECTED.
 * Body: { action: 'PAID' | 'REJECTED', rejectReason?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
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

    const { action, rejectReason } = await request.json();
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

    // Log the transaction in the financial audit journal
    await logFinancialAudit({
      action_type: action === 'PAID' ? 'PAYMENT_DRIVER_TO_AGENCY' : 'REJECT_DRIVER_PAYMENT',
      amount_cdf: req.amount, // assuming amount is in CDF here
      amount_usd: 0,
      actor_id: session.agencyId,
      actor_name: session.name || 'Agence',
      target_id: req.driver_id,
      target_name: 'Livreur',
      target_role: 'livreur',
      status: action === 'PAID' ? 'COMPLETED' : 'REJECTED',
      reference: req.id,
      notes: action === 'REJECTED' ? `Motif: ${rejectReason}` : 'Versement du livreur reçu par l\'agence'
    });

    return NextResponse.json({ success: true, action, requestId: id });
  } catch (err) {
    console.error('[PATCH /api/agency/cash-requests/[id]]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
