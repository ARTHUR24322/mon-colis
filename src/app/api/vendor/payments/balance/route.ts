/**
 * GET /api/vendor/payments/balance
 * Retourne les soldes du vendeur connecté avec chaque agence.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    // Soldes par agence
    const { data: balances, error: balErr } = await supabase
      .from('balances')
      .select('agency_id, amount_owed_to_vendor, amount_owed_by_vendor, total_delivered, last_updated')
      .eq('vendor_id', session.userId)
      .order('amount_owed_to_vendor', { ascending: false });

    if (balErr) {
      console.error('Balance fetch error:', balErr);
      return NextResponse.json({ error: 'Erreur lors du chargement des soldes.' }, { status: 500 });
    }

    // Paiements en attente de confirmation (OTP reçu, pas encore confirmé)
    const { data: pending, error: pendingErr } = await supabase
      .from('payment_otps')
      .select('id, ledger_entry_id, agency_id, amount, expires_at, created_at')
      .eq('vendor_id', session.userId)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (pendingErr) {
      console.warn('Pending OTPs fetch warning:', pendingErr);
    }

    // Récupérer les profils des agences pour les soldes et OTPs
    const rawBalances = balances ?? [];
    const rawPending = pending ?? [];
    const allAgencyIds = [...new Set([
      ...rawBalances.map(b => b.agency_id),
      ...rawPending.map(p => p.agency_id),
    ].filter(Boolean))];

    const agencyMap = new Map<string, { name: string; phone: string }>();
    if (allAgencyIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', allAgencyIds);
      (profiles ?? []).forEach(p => agencyMap.set(p.id, { name: p.name || 'Agence', phone: p.phone || '' }));
    }

    const enrichedBalances = rawBalances.map(b => ({
      ...b,
      agency: {
        profile: agencyMap.get(b.agency_id) || { name: 'Agence', phone: '' }
      }
    }));

    const enrichedPending = rawPending.map(p => ({
      ...p,
      agency: {
        profile: agencyMap.get(p.agency_id) || { name: 'Agence', phone: '' }
      }
    }));

    // Historique des 20 dernières transactions confirmées
    const { data: history } = await supabase
      .from('ledger_entries')
      .select('id, type, amount, status, created_at, confirmed_by_vendor_at, notes')
      .eq('vendor_id', session.userId)
      .in('status', ['CONFIRMED', 'DISPUTED'])
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      balances: enrichedBalances,
      pendingConfirmations: enrichedPending,
      history: history ?? [],
    });
  } catch (err) {
    console.error('[GET /api/vendor/payments/balance]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
