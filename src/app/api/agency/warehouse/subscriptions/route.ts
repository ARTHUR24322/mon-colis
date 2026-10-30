/**
 * API /api/agency/warehouse/subscriptions
 * Suivi et gestion des abonnements de stockage par l'agence.
 * Permet d'accepter ou de décliner les demandes de réservation des vendeurs (Bug 2.1).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import { fulfillmentService } from '@/lib/fulfillment-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : req.nextUrl.searchParams.get('agencyId');

    if (!agencyId) {
      return NextResponse.json({ error: 'Identifiant agence requis.' }, { status: 400 });
    }

    // Expiration automatique des demandes PENDING > 48h
    await fulfillmentService.expireOldReservations();

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
        .select('id, name, phone, email')
        .in('id', vendorIds);
      (profiles || []).forEach(p => vendorMap.set(p.id, {
        name: p.name || 'Vendeur',
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
        spaceName: space?.name || 'Emplacement',
        slotsCount: s.slots_count || 1,
        pricePaid: price,
        currency: s.currency || 'USD',
        status: s.status,
        rejectionReason: s.rejection_reason || null,
        expiresAt: s.expires_at || null,
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
      activeCount: formatted.filter(s => s.status === 'ACTIVE').length,
      pendingCount: formatted.filter(s => s.status === 'PENDING').length,
    });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/subscriptions]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'agence' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Accès réservé aux agences.' }, { status: 403 });
    }

    const agencyId = session.role === 'agence' ? session.agencyId || session.userId : (await req.json().catch(() => ({}))).agencyId;
    const body = await req.json().catch(() => ({}));
    const { subscriptionId, action, reason } = body;

    if (!subscriptionId || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Paramètres invalides. subscriptionId et action ("accept" ou "reject") requis.' },
        { status: 400 }
      );
    }

    const result = await fulfillmentService.reviewSubscription({
      subscriptionId,
      agencyId,
      action,
      reason,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/agency/warehouse/subscriptions]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
