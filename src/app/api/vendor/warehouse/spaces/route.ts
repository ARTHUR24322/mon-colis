/**
 * API /api/vendor/warehouse/spaces
 * Consultation des offres de stockage des agences et gestion des abonnements vendeurs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : req.nextUrl.searchParams.get('vendorId');

    // 1. Offres actives d'espaces de stockage
    const { data: spaces, error: spacesErr } = await supabase
      .from('agency_storage_spaces')
      .select('*')
      .eq('is_active', true)
      .order('price_per_month', { ascending: true });

    if (spacesErr) {
      console.warn('Storage spaces fetch warning:', spacesErr.message);
      return NextResponse.json({ spaces: [], subscriptions: [] });
    }

    const rawSpaces = spaces || [];

    // Récupérer les informations des agences
    const agencyIds = [...new Set(rawSpaces.map(s => s.agency_id).filter(Boolean))];
    const agencyMap = new Map<string, { name: string; phone: string; address: string }>();

    if (agencyIds.length > 0) {
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, name, phone, address')
        .in('id', agencyIds);
      (agencies || []).forEach(a => agencyMap.set(a.id, {
        name: a.name || 'Agence Partenaire',
        phone: a.phone || '',
        address: a.address || ''
      }));
    }

    const enrichedSpaces = rawSpaces.map(s => {
      const ag = agencyMap.get(s.agency_id);
      return {
        id: s.id,
        agencyId: s.agency_id,
        agencyName: ag?.name || 'Agence',
        agencyPhone: ag?.phone || '',
        agencyAddress: ag?.address || '',
        name: s.name,
        description: s.description || '',
        totalSlots: s.total_slots,
        availableSlots: s.available_slots,
        pricePerMonth: Number(s.price_per_month || 0),
        currency: s.currency || 'USD',
        maxWeightPerSlot: Number(s.max_weight_per_slot || 0),
        dimensions: s.dimensions || '',
        isActive: s.is_active
      };
    });

    // 2. Abonnements existants du vendeur
    let subscriptions: any[] = [];
    if (vendorId) {
      const { data: subs } = await supabase
        .from('vendor_storage_subscriptions')
        .select('*')
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
