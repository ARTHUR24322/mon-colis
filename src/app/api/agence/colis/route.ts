/**
 * GET /api/agence/colis
 * Retourne les colis de l'agence connectée avec pagination côté serveur.
 * Query params: limit, offset, status, search
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('packages')
      .select(`
        id,
        tracking_code,
        client_name,
        client_commune,
        client_phone,
        status,
        package_price,
        delivery_price,
        paid_by_client,
        is_prepaid,
        vendor_paid,
        created_at,
        driver_id,
        origin_drop_point_id,
        vendeur:profiles!vendeur_id(name, phone),
        driver:drivers!driver_id(id, phone, profile:profiles(name)),
        origin_drop_point:drop_points!origin_drop_point_id(id, name, commune, address, phone, opening_hours)
      `, { count: 'exact' })
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      if (status === 'TO_PICKUP_AT_RELAY') {
        // Filtre spécifique : colis déposés en point relais à récupérer par l'agence
        query = query.in('status', ['WAITING_FOR_AGENCY_PICKUP', 'ACCEPTED_BY_AGENCY']).not('origin_drop_point_id', 'is', null);
      } else {
        query = query.eq('status', status);
      }
    }

    if (search) {
      query = query.or(`tracking_code.ilike.%${search}%,client_name.ilike.%${search}%,client_commune.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[GET /api/agence/colis]', error);
      return NextResponse.json({ error: 'Erreur base de données.' }, { status: 500 });
    }

    const colis = (data || []).map((p: any) => {
      const vendeur = Array.isArray(p.vendeur) ? p.vendeur[0] : p.vendeur;
      const driver = Array.isArray(p.driver) ? p.driver[0] : p.driver;
      const driverProfile = Array.isArray(driver?.profile) ? driver?.profile[0] : driver?.profile;
      const relay = Array.isArray(p.origin_drop_point) ? p.origin_drop_point[0] : p.origin_drop_point;

      return {
        id: p.id,
        trackingCode: p.tracking_code || ('MC-' + p.id.slice(0, 8).toUpperCase()),
        clientName: p.client_name,
        clientCommune: p.client_commune || '—',
        clientPhone: p.client_phone || '',
        vendeurName: vendeur?.name || '—',
        vendeurPhone: vendeur?.phone || '',
        status: p.status,
        prixColis: p.package_price || 0,
        prixLivraison: p.delivery_price ? (p.delivery_price > 50 ? parseFloat((p.delivery_price / 2400).toFixed(2)) : p.delivery_price) : null,
        driverId: p.driver_id || driver?.id || null,
        driverName: driverProfile?.name || null,
        driverPhone: driver?.phone || null,
        originDropPoint: relay ? {
          id: relay.id,
          name: relay.name,
          commune: relay.commune || '—',
          address: relay.address || '—',
          phone: relay.phone || '—',
          openingHours: relay.opening_hours || '8h - 18h',
        } : null,
        isToPickupAtRelay: !!p.origin_drop_point_id && (p.status === 'WAITING_FOR_AGENCY_PICKUP' || p.status === 'ACCEPTED_BY_AGENCY'),
        date: p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—',
        paidByClient: p.paid_by_client !== false,
        isPrepaid: p.is_prepaid || false,
        vendorPaid: p.vendor_paid || false,
      };
    });

    return NextResponse.json({ colis, total: count || 0 });
  } catch (err) {
    console.error('[GET /api/agence/colis]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
