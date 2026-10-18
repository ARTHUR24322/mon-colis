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
        vendeur:profiles!vendeur_id(name, phone),
        driver:drivers(phone, profile:profiles(name))
      `, { count: 'exact' })
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
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
        prixLivraison: p.delivery_price || null,
        driverName: driverProfile?.name || null,
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
