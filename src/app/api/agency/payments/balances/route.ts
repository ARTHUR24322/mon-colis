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

    // 1. Lire les soldes existants dans la table balances (si elle existe/est peuplée)
    const { data: rawBalances } = await supabase
      .from('balances')
      .select(`
        vendor_id,
        amount_owed_to_vendor,
        amount_owed_by_vendor,
        total_delivered,
        last_updated
      `)
      .eq('agency_id', session.agencyId);

    // 2. Calcul dynamique basé sur les colis livrés (source de vérité dans Moncolis)
    const { data: deliveredPackages } = await supabase
      .from('packages')
      .select('id, vendeur_id, package_price, status, is_prepaid, vendor_paid')
      .eq('agency_id', session.agencyId)
      .eq('status', 'DELIVERED');

    const vendorMap = new Map<string, {
      vendor_id: string;
      amount_owed_to_vendor: number;
      amount_owed_by_vendor: number;
      total_delivered: number;
    }>();

    // Initialiser avec la table balances si dispo
    (rawBalances || []).forEach((b: any) => {
      if (b.vendor_id) {
        vendorMap.set(b.vendor_id, {
          vendor_id: b.vendor_id,
          amount_owed_to_vendor: Number(b.amount_owed_to_vendor) || 0,
          amount_owed_by_vendor: Number(b.amount_owed_by_vendor) || 0,
          total_delivered: Number(b.total_delivered) || 0,
        });
      }
    });

    // Compléter/Calculer via les colis réels livrés
    (deliveredPackages || []).forEach((pkg: any) => {
      if (!pkg.vendeur_id) return;
      if (!vendorMap.has(pkg.vendeur_id)) {
        vendorMap.set(pkg.vendeur_id, {
          vendor_id: pkg.vendeur_id,
          amount_owed_to_vendor: 0,
          amount_owed_by_vendor: 0,
          total_delivered: 0,
        });
      }
      const v = vendorMap.get(pkg.vendeur_id)!;
      v.total_delivered += 1;
      // Si la marchandise n'était pas prépayée par le client et n'a pas encore été reversée au vendeur
      if (!pkg.is_prepaid && !pkg.vendor_paid) {
        v.amount_owed_to_vendor += Number(pkg.package_price) || 0;
      }
    });

    // 3. Récupérer l'historique complet des versements aux vendeurs (ledger_entries)
    const { data: ledgerHistory } = await supabase
      .from('ledger_entries')
      .select('id, vendor_id, amount, currency, type, status, created_at, confirmed_by_vendor_at, notes')
      .eq('agency_id', session.agencyId)
      .not('vendor_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    // Récupérer les OTPs générés pour cette agence
    const { data: paymentOtps } = await supabase
      .from('payment_otps')
      .select('id, ledger_entry_id, vendor_id, amount, expires_at, created_at, used')
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: false })
      .limit(50);

    const otpMap = new Map((paymentOtps || []).map((o: any) => [o.ledger_entry_id, o]));

    // 4. Résoudre les profils vendeurs pour balances et historique
    const allVendorIds = new Set<string>();
    vendorMap.forEach((_, id) => allVendorIds.add(id));
    (ledgerHistory || []).forEach((h: any) => { if (h.vendor_id) allVendorIds.add(h.vendor_id); });

    const profilesMap = new Map<string, { name: string; phone: string }>();
    if (allVendorIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', Array.from(allVendorIds));

      (profiles || []).forEach((p: any) => {
        profilesMap.set(p.id, {
          name: p.name || 'Vendeur Partenaire',
          phone: p.phone || '',
        });
      });
    }

    // Enrichir balances
    const enrichedBalances = Array.from(vendorMap.values()).map(vb => ({
      ...vb,
      vendor: profilesMap.get(vb.vendor_id) || { name: 'Vendeur', phone: '' },
    })).sort((a, b) => b.amount_owed_to_vendor - a.amount_owed_to_vendor);

    // Enrichir historique
    const enrichedHistory = (ledgerHistory || []).map((h: any) => ({
      ...h,
      vendor: profilesMap.get(h.vendor_id) || { name: 'Vendeur', phone: '' },
      otpInfo: otpMap.get(h.id) || null,
    }));

    const pendingPayments = enrichedHistory.filter((h: any) => h.status === 'PENDING');

    return NextResponse.json({
      balances: enrichedBalances,
      history: enrichedHistory,
      pendingPayments,
    });
  } catch (err) {
    console.error('[GET /api/agency/payments/balances]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
