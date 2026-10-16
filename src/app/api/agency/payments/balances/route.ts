/**
 * GET /api/agency/payments/balances
 * Retourne les soldes de tous les vendeurs pour l'agence connectée.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    // Soldes par vendeur
    const { data: balances, error: balErr } = await supabase
      .from('balances')
      .select(`
        vendor_id,
        amount_owed_to_vendor,
        amount_owed_by_vendor,
        total_delivered,
        last_updated,
        vendor:profiles!balances_vendor_id_fkey(name, phone)
      `)
      .eq('agency_id', session.agencyId)
      .order('amount_owed_to_vendor', { ascending: false });

    if (balErr) {
      console.error('Balance fetch error:', balErr);
      return NextResponse.json({ error: 'Erreur lors du chargement des soldes.' }, { status: 500 });
    }

    // Transactions récentes en attente de confirmation vendeur
    const { data: pending } = await supabase
      .from('ledger_entries')
      .select('id, vendor_id, amount, type, created_at, notes')
      .eq('agency_id', session.agencyId)
      .eq('status', 'PENDING')
      .eq('type', 'VENDOR_PAYMENT_INITIATED')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      balances: balances ?? [],
      pendingPayments: pending ?? [],
    });
  } catch (err) {
    console.error('[GET /api/agency/payments/balances]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
