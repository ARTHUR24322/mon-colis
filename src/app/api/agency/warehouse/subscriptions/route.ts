/**
 * API /api/agency/warehouse/subscriptions
 * Suivi et gestion des abonnements de stockage par l'agence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : req.nextUrl.searchParams.get('agencyId');

    if (!agencyId) {
      return NextResponse.json({ error: 'Identifiant agence requis.' }, { status: 400 });
    }

    const { data: subs, error: subsErr } = await supabase
      .from('vendor_storage_subscriptions')
      .select('*, agency_storage_spaces(*)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (subsErr) {
      console.warn('Agency subscriptions fetch warning:', subsErr.message);
      return NextResponse.json({ subscriptions: [], totalRevenueUSD: 0 });
    }

    const rawSubs = subs || [];
    const vendorIds = [...new Set(rawSubs.map(s => s.vendor_id).filter(Boolean))];
    const vendorMap = new Map<string, { name: string; phone: string; email: string }>();

    if (vendorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .in('id', vendorIds);
      (profiles || []).forEach(p => vendorMap.set(p.id, {
        name: p.full_name || 'Vendeur',
        phone: p.phone || '',
        email: p.email || ''
      }));
    }

    let totalRevenueUSD = 0;

    const formatted = rawSubs.map(s => {
      const v = vendorMap.get(s.vendor_id);
      const space = s.agency_storage_spaces;
      const price = Number(s.price_paid || 0);
      if (s.status === 'ACTIVE') {
        totalRevenueUSD += price;
      }

      return {
        id: s.id,
        vendorId: s.vendor_id,
        vendorName: v?.name || 'Vendeur Partenaire',
        vendorPhone: v?.phone || '',
        vendorEmail: v?.email || '',
        spaceId: s.storage_space_id,
        spaceName: space?.name || 'Emplacement Général',
        slotsCount: s.slots_count || 1,
        pricePaid: price,
        currency: s.currency || 'USD',
        status: s.status,
        startDate: s.start_date,
        endDate: s.end_date,
        autoRenew: s.auto_renew,
        notes: s.notes,
        createdAt: s.created_at
      };
    });

    return NextResponse.json({
      subscriptions: formatted,
      totalRevenueUSD,
      activeCount: formatted.filter(s => s.status === 'ACTIVE').length
    });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/subscriptions]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
