/**
 * API /api/vendor/warehouse/subscriptions
 * Gestion des abonnements de stockage côté vendeur.
 * Réservation atomique (Bug 2.1) et parcours demande -> réservé -> acceptation agence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import { fulfillmentService } from '@/lib/fulfillment-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : req.nextUrl.searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json({ error: 'Identifiant vendeur requis.' }, { status: 400 });
    }

    // Expirer automatiquement les demandes PENDING dépassées (48h)
    await fulfillmentService.expireOldReservations();

    const { data: subs, error: subsErr } = await supabase
      .from('vendor_storage_subscriptions')
      .select('*, agency_storage_spaces(*)')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (subsErr) {
      console.warn('Subscriptions fetch warning:', subsErr.message);
      return NextResponse.json({ subscriptions: [] });
    }

    const rawSubs = subs || [];
    const agencyIds = [...new Set(rawSubs.map(s => s.agency_id).filter(Boolean))];
    const agencyMap = new Map<string, { name: string; phone: string; address: string }>();

    if (agencyIds.length > 0) {
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, name, phone, address')
        .in('id', agencyIds);
      (agencies || []).forEach(a => agencyMap.set(a.id, {
        name: a.name || 'Agence',
        phone: a.phone || '',
        address: a.address || ''
      }));
    }

    const formatted = rawSubs.map(s => {
      const ag = agencyMap.get(s.agency_id);
      const space = s.agency_storage_spaces;
      return {
        id: s.id,
        vendorId: s.vendor_id,
        agencyId: s.agency_id,
        agencyName: ag?.name || 'Agence Partenaire',
        agencyPhone: ag?.phone || '',
        agencyAddress: ag?.address || '',
        storageSpaceId: s.storage_space_id,
        spaceName: space?.name || 'Emplacement',
        slotsCount: s.slots_count || 1,
        pricePaid: Number(s.price_paid || 0),
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

    return NextResponse.json({ subscriptions: formatted });
  } catch (err: any) {
    console.error('[GET /api/vendor/warehouse/subscriptions]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'vendeur' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Accès réservé aux vendeurs.' }, { status: 403 });
    }

    // Lecture unique et sécurisée du body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }

    const vendorId = session.role === 'vendeur' ? session.userId : (body.vendorId || session.userId);
    const { storageSpaceId, slotsCount = 1, months = 1, notes } = body;

    if (!storageSpaceId) {
      return NextResponse.json({ error: 'Identifiant de l’espace requis.' }, { status: 400 });
    }

    // Appel au service de réservation atomique
    const result = await fulfillmentService.reserveStorageSpace({
      vendorId,
      storageSpaceId,
      slotsCount: parseInt(slotsCount, 10) || 1,
      months: parseInt(months, 10) || 1,
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/vendor/warehouse/subscriptions]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
