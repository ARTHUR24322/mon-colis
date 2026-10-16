/**
 * PATCH /api/agency/vendor-requests/[id]
 * L'agence traite une demande vendeur : PAID ou REJECTED.
 * Body: { action: 'PAID' | 'REJECTED', rejectReason?: string }
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

    const { action, rejectReason } = await request.json();
    if (!['PAID', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
    }

    const { data: req, error: fetchErr } = await supabase
      .from('vendor_payment_requests')
      .select('id, agency_id, status, amount, vendor_id')
      .eq('id', id)
      .single();

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    }
    if (req.agency_id !== session.agencyId) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }
    if (!['PENDING', 'SEEN'].includes(req.status)) {
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
      .from('vendor_payment_requests')
      .update(updateData)
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
    }

    // Log the transaction in the financial audit journal
    await logFinancialAudit({
      action_type: action === 'PAID' ? 'PAYMENT_AGENCY_TO_VENDOR' : 'REJECT_VENDOR_PAYMENT',
      amount_cdf: req.amount,
      amount_usd: 0,
      actor_id: session.agencyId,
      actor_name: session.name || 'Agence',
      target_id: req.vendor_id,
      target_name: 'Vendeur',
      target_role: 'vendeur',
      status: action === 'PAID' ? 'COMPLETED' : 'REJECTED',
      reference: req.id,
      notes: action === 'REJECTED' ? `Motif: ${rejectReason}` : 'Reversement de l\'agence au vendeur effectué'
    });

    return NextResponse.json({ success: true, action, requestId: id, vendorId: req.vendor_id, amount: req.amount });
  } catch (err) {
    console.error('[PATCH /api/agency/vendor-requests/[id]]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
