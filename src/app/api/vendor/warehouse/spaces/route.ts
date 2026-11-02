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

    // Expirer automatiquement les réservations en attente dépassées (sécurisé pour ne jamais bloquer)
    try {
      await fulfillmentService.expireOldReservations();
    } catch (e) {
      // Ignorer si la table n'a pas encore de colonne expires_at
    }

    // 1. Offres actives et DISPONIBLES uniquement
    const { data: spaces, error: spacesErr } = await supabase
      .from('agency_storage_spaces')
      .select('*')
      .eq('is_active', true)
      .gt('available_slots', 0)
      .order('price_per_month', { ascending: true });

    if (spacesErr) {
      console.warn('Storage spaces fetch warning:', spacesErr.message);
      return NextResponse.json({ spaces: [], subscriptions: [] });
    }

    // Filtrer en mémoire pour supporter les environnements avec ou sans colonne status
    const rawSpaces = (spaces || []).filter((s: any) => {
      if (!s.status) return true;
      return s.status !== 'loue' && s.status !== 'reserve' && s.status !== 'retire';
    });

    // Récupérer les informations des agences
    const agencyIds = [...new Set(rawSpaces.map(s => s.agency_id).filter(Boolean))];
    const agencyMap = new Map<string, { name: string; phone: string; address: string; commune: string }>();

    if (agencyIds.length > 0) {
      const [{ data: profs }, { data: agencies }] = await Promise.all([
        supabase.from('profiles').select('id, name, phone, address').in('id', agencyIds),
        supabase.from('agencies').select('id, phone, address').in('id', agencyIds),
      ]);
      const profMap = new Map((profs || []).map(p => [p.id, p]));
      const agMap = new Map((agencies || []).map(a => [a.id, a]));

      agencyIds.forEach(id => {
        const p = profMap.get(id);
        const a = agMap.get(id);
        const addr = a?.address || p?.address || '';
        const parts = addr.split(',').map((part: string) => part.trim());
        const commune = parts.length > 1 ? parts[parts.length - 2] : (parts[0] || 'Kinshasa');
        agencyMap.set(id, {
          name: p?.name || 'Agence',
          phone: p?.phone || a?.phone || '',
          address: addr,
          commune: commune || 'Kinshasa',
        });
      });
    }

    const enrichedSpaces = rawSpaces.map(s => {
      const ag = agencyMap.get(s.agency_id);
      const surface = s.surface_m2 ? `${s.surface_m2} m²` : '1 m²';
      const agencyName = ag?.name || 'Agence inconnue';
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
