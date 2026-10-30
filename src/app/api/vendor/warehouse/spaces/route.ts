/**
 * API /api/vendor/warehouse/spaces
 * Consultation des offres de stockage des agences et gestion des abonnements vendeurs.
 * Règle Bug 2.1 : Offre retirée dès que l'emplacement n'est plus disponible (available_slots <= 0 ou status != 'disponible').
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import { fulfillmentService } from '@/lib/fulfillment-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : req.nextUrl.searchParams.get('vendorId');

    // Expirer automatiquement les réservations en attente dépassées
    await fulfillmentService.expireOldReservations();

    // 1. Offres actives et DISPONIBLES uniquement
    const { data: spaces, error: spacesErr } = await supabase
      .from('agency_storage_spaces')
      .select('*')
      .eq('is_active', true)
      .gt('available_slots', 0)
      .neq('status', 'loue')
      .neq('status', 'reserve')
      .neq('status', 'retire')
      .order('price_per_month', { ascending: true });

    if (spacesErr) {
      console.warn('Storage spaces fetch warning:', spacesErr.message);
      return NextResponse.json({ spaces: [], subscriptions: [] });
    }

    const rawSpaces = spaces || [];

    // Récupérer les informations des agences
    const agencyIds = [...new Set(rawSpaces.map(s => s.agency_id).filter(Boolean))];
    const agencyMap = new Map<string, { name: string; phone: string; address: string; commune: string }>();

    if (agencyIds.length > 0) {
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, name, phone, address')
        .in('id', agencyIds);

      (agencies || []).forEach(a => {
        // Extraire la commune de l'adresse si possible, sinon Kinshasa
        const addr = a.address || '';
        const parts = addr.split(',').map((p: string) => p.trim());
        const commune = parts.length > 1 ? parts[parts.length - 2] : (parts[0] || 'Kinshasa');
        agencyMap.set(a.id, {
          name: a.name || 'Agence',
          phone: a.phone || '',
          address: addr,
          commune: commune || 'Kinshasa',
        });
      });
    }

    const enrichedSpaces = rawSpaces.map(s => {
      const ag = agencyMap.get(s.agency_id);
      const surface = s.surface_m2 ? `${s.surface_m2} m²` : '1 m²';
      const agencyName = ag?.name || 'Agence';
      const commune = ag?.commune || 'Kinshasa';
      return {
        id: s.id,
        agencyId: s.agency_id,
        agencyName,
        agencyPhone: ag?.phone || '',
        agencyAddress: ag?.address || '',
        agencyCommune: commune,
        formattedAgencyLabel: `${agencyName} · ${surface} · ${commune}`,
        name: s.name,
        description: s.description || '',
        totalSlots: s.total_slots,
        availableSlots: s.available_slots,
        pricePerMonth: Number(s.price_per_month || 0),
        currency: s.currency || 'USD',
        maxWeightPerSlot: Number(s.max_weight_per_slot || 0),
        surfaceM2: Number(s.surface_m2 || 1),
        dimensions: s.dimensions || '',
        status: s.status || 'disponible',
        isActive: s.is_active
      };
    });

    // 2. Abonnements existants du vendeur
    let subscriptions: any[] = [];
    if (vendorId) {
      const { data: subs } = await supabase
        .from('vendor_storage_subscriptions')
        .select('*, agency_storage_spaces(*)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      subscriptions = subs || [];
    }

    return NextResponse.json({
      spaces: enrichedSpaces,
      subscriptions
    });
  } catch (err: any) {
    console.error('[GET /api/vendor/warehouse/spaces]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
