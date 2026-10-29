/**
 * API /api/vendor/warehouse/subscriptions
 * Gestion des abonnements de stockage côté vendeur.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : req.nextUrl.searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json({ error: 'Identifiant vendeur requis.' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const vendorId = session.role === 'vendeur' ? session.userId : (await req.json()).vendorId;
    const body = await req.json().catch(() => ({}));
    const { storageSpaceId, slotsCount = 1, months = 1, autoRenew = true } = body;

    if (!storageSpaceId) {
      return NextResponse.json({ error: 'ID de l’espace requis.' }, { status: 400 });
    }

    const count = Math.max(1, parseInt(slotsCount, 10) || 1);
    const numMonths = Math.max(1, parseInt(months, 10) || 1);

    // 1. Vérifier la disponibilité de l'espace
    const { data: space, error: spaceErr } = await supabase
      .from('agency_storage_spaces')
      .select('*')
      .eq('id', storageSpaceId)
      .single();

    if (spaceErr || !space) {
      return NextResponse.json({ error: 'Espace de stockage introuvable.' }, { status: 404 });
    }

    if (space.available_slots < count) {
      return NextResponse.json({
        error: `Capacité insuffisante. Places restantes : ${space.available_slots}`
      }, { status: 400 });
    }

    // Calcul du montant
    const monthlyRate = Number(space.price_per_month || 0);
    const totalPrice = monthlyRate * count * numMonths;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + (numMonths * 30));

    // 2. Créer l'abonnement
    const { data: sub, error: subErr } = await supabase
      .from('vendor_storage_subscriptions')
      .insert({
        vendor_id: vendorId,
        agency_id: space.agency_id,
        storage_space_id: space.id,
        slots_count: count,
        price_paid: totalPrice,
        currency: space.currency || 'USD',
        status: 'ACTIVE',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        auto_renew: !!autoRenew,
        notes: `Souscription pour ${count} emplacement(s) sur ${numMonths} mois.`
      })
      .select('*')
      .single();

    if (subErr) {
      console.error('Subscription insert error:', subErr);
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    // 3. Décrémenter les places disponibles
    const updatedAvailableSlots = Math.max(0, space.available_slots - count);
    await supabase
      .from('agency_storage_spaces')
      .update({ available_slots: updatedAvailableSlots })
      .eq('id', space.id);

    return NextResponse.json({
      success: true,
      message: `Abonnement activé avec succès (${count} slot(s) jusqu'au ${endDate.toLocaleDateString('fr-FR')}).`,
      subscription: sub
    });
  } catch (err: any) {
    console.error('[POST /api/vendor/warehouse/subscriptions]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
