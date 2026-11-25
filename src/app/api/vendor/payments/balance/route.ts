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

    // 1. Lire les soldes existants dans la table balances (si elle existe/est peuplée)
    const { data: dbBalances, error: balErr } = await supabase
      .from('balances')
      .select('agency_id, amount_owed_to_vendor, amount_owed_by_vendor, total_delivered, last_updated')
      .eq('vendor_id', session.userId);

    if (balErr) {
      console.warn('Balance fetch warning:', balErr);
    }

    // 2. Calcul dynamique basé sur les colis livrés réels (source de vérité)
    const { data: deliveredPackages, error: pkgErr } = await supabase
      .from('packages')
      .select('id, agency_id, package_price, status, is_prepaid, vendor_paid')
      .eq('vendeur_id', session.userId)
      .in('status', ['DELIVERED', 'Livré']);

    if (pkgErr) {
      console.warn('Delivered packages fetch warning:', pkgErr);
    }

    const agencyBalanceMap = new Map<string, {
      agency_id: string;
      amount_owed_to_vendor: number;
      amount_owed_by_vendor: number;
      total_delivered: number;
      last_updated: string;
    }>();

    // Initialiser avec la table balances si dispo
    (dbBalances || []).forEach(b => {
      if (b.agency_id) {
        agencyBalanceMap.set(b.agency_id, {
          agency_id: b.agency_id,
          amount_owed_to_vendor: Number(b.amount_owed_to_vendor) || 0,
          amount_owed_by_vendor: Number(b.amount_owed_by_vendor) || 0,
          total_delivered: Number(b.total_delivered) || 0,
          last_updated: b.last_updated || new Date().toISOString(),
        });
      }
    });

    // Compléter avec les colis réels livrés non encore reversés
    (deliveredPackages || []).forEach(pkg => {
      if (!pkg.agency_id) return;
      if (!agencyBalanceMap.has(pkg.agency_id)) {
        agencyBalanceMap.set(pkg.agency_id, {
          agency_id: pkg.agency_id,
          amount_owed_to_vendor: 0,
          amount_owed_by_vendor: 0,
          total_delivered: 0,
          last_updated: new Date().toISOString(),
        });
      }
      const item = agencyBalanceMap.get(pkg.agency_id)!;
      item.total_delivered += 1;
      if (!pkg.is_prepaid && !pkg.vendor_paid) {
        item.amount_owed_to_vendor += Number(pkg.package_price) || 0;
      }
    });

    const enrichedBalancesRaw = Array.from(agencyBalanceMap.values()).sort(
      (a, b) => b.amount_owed_to_vendor - a.amount_owed_to_vendor
    );

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
    const balancesList = enrichedBalancesRaw;
    const rawPending = pending ?? [];
    const allAgencyIds = [...new Set([
      ...balancesList.map(b => b.agency_id),
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

    const enrichedBalances = balancesList.map(b => ({
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
