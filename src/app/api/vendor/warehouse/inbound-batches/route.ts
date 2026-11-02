/**
 * API /api/vendor/warehouse/inbound-batches
 * Création et consultation des bons de dépôt physique en entrepôt (Inbound avec QR Code).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : req.nextUrl.searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data: batches, error } = await supabase
      .from('warehouse_inbound_batches')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Inbound batches fetch warning:', error.message);
      return NextResponse.json({ batches: [] });
    }

    const rawBatches = batches || [];
    const agencyIds = [...new Set(rawBatches.map(b => b.agency_id).filter(Boolean))];
    const agencyMap = new Map<string, string>();

    if (agencyIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', agencyIds);
      (profs || []).forEach(p => agencyMap.set(p.id, p.name || 'Agence'));
    }

    const enrichedBatches = rawBatches.map(b => {
      const qrPayload = JSON.stringify({
        type: 'INBOUND_BATCH',
        batchId: b.id,
        batchNumber: b.batch_number,
        token: b.qr_token
      });

      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrPayload)}`;

      return {
        id: b.id,
        batchNumber: b.batch_number,
        vendorId: b.vendor_id,
        agencyId: b.agency_id,
        agencyName: agencyMap.get(b.agency_id) || 'Agence',
        status: b.status,
        items: b.items || [],
        totalItemsCount: b.total_items_count,
        receivedItemsCount: b.received_items_count,
        qrToken: b.qr_token,
        qrPayload,
        qrImageUrl,
        depositedAt: b.deposited_at,
        receivedAt: b.received_at,
        receivedBy: b.received_by,
        rejectionReason: b.rejection_reason,
        notes: b.notes,
        createdAt: b.created_at
      };
    });

    return NextResponse.json({ batches: enrichedBatches });
  } catch (err: any) {
    console.error('[GET /api/vendor/warehouse/inbound-batches]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();

    const vendorId = session?.role === 'vendeur' ? session.userId : body.vendorId;
    if (!vendorId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { agencyId, storageSpaceId, subscriptionId, items, notes } = body;

    if (!agencyId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        error: 'Veuillez sélectionner une agence et au moins une marchandise à déposer.'
      }, { status: 400 });
    }

    // Récupérer la souscription active pour vérifier la règle : 1 emplacement loué = 1 marchandise max
    let subQuery = supabase
      .from('vendor_storage_subscriptions')
      .select('id, storage_space_id, slots_count, status')
      .eq('vendor_id', vendorId)
      .eq('agency_id', agencyId)
      .eq('status', 'ACTIVE');

    if (subscriptionId) {
      subQuery = subQuery.eq('id', subscriptionId);
    } else if (storageSpaceId) {
      subQuery = subQuery.eq('storage_space_id', storageSpaceId);
    }

    const { data: activeSubs } = await subQuery;

    if (!activeSubs || activeSubs.length === 0) {
      return NextResponse.json({
        error: 'Vous devez disposer d’une location d’espace active auprès de cette agence pour déposer de la marchandise.'
      }, { status: 400 });
    }

    const targetSub = activeSubs[0];
    const resolvedSpaceId = storageSpaceId || targetSub.storage_space_id;
    const totalSlotsAllowed = activeSubs.reduce((sum, s) => sum + (s.slots_count || 1), 0);

    // Calculer le total d'unités et valider nom, quantité et prix
    let totalCount = 0;
    const formattedItems = [];

    for (const it of items) {
      const pName = (it.productName || '').trim();
      const qty = parseInt(it.expectedQuantity, 10) || 0;
      const price = parseFloat(it.unitPrice) || 0;

      if (!pName) {
        return NextResponse.json({ error: 'Chaque marchandise doit avoir un nom valide.' }, { status: 400 });
      }
      if (qty <= 0) {
        return NextResponse.json({ error: `La quantité pour « ${pName} » doit être supérieure à 0.` }, { status: 400 });
      }
      if (price <= 0) {
        return NextResponse.json({ error: `Veuillez indiquer un prix de vente valide pour « ${pName} ».` }, { status: 400 });
      }

      totalCount += qty;
      formattedItems.push({
        productName: pName,
        sku: it.sku?.trim() || '',
        expectedQuantity: qty,
        receivedQuantity: 0,
        unitPrice: price
      });
    }

    // RÈGLE MÉTIER STRICTE : 1 emplacement loué = 1 marchandise (article distinct)
    // Vérifier les marchandises déjà enregistrées en stock sur cet emplacement
    let stockQuery = supabase
      .from('warehouse_inventory')
      .select('product_name')
      .eq('vendor_id', vendorId)
      .eq('agency_id', agencyId)
      .eq('is_active', true);

    if (resolvedSpaceId) {
      stockQuery = stockQuery.eq('storage_space_id', resolvedSpaceId);
    }

    const { data: existingStock } = await stockQuery;

    const distinctProducts = new Set<string>();
    (existingStock || []).forEach(i => {
      if (i.product_name) distinctProducts.add(i.product_name.toLowerCase().trim());
    });

    // Vérifier les bons en attente
    let pendingQuery = supabase
      .from('warehouse_inbound_batches')
      .select('items')
      .eq('vendor_id', vendorId)
      .eq('agency_id', agencyId)
      .in('status', ['PENDING', 'DRAFT']);

    if (resolvedSpaceId) {
      pendingQuery = pendingQuery.eq('storage_space_id', resolvedSpaceId);
    }

    const { data: pendingBatches } = await pendingQuery;
    (pendingBatches || []).forEach(b => {
      (b.items || []).forEach((it: any) => {
        if (it.productName) distinctProducts.add(it.productName.toLowerCase().trim());
      });
    });

    // Ajouter les nouveaux produits déclarés dans ce bon
    formattedItems.forEach(it => {
      distinctProducts.add(it.productName.toLowerCase().trim());
    });

    if (distinctProducts.size > totalSlotsAllowed) {
      return NextResponse.json({
        error: `Cet emplacement autorise au maximum ${totalSlotsAllowed} marchandise(s) (${totalSlotsAllowed} place(s) louée(s)). Vous tentez d'enregistrer ${distinctProducts.size} marchandise(s) différente(s). Veuillez louer un emplacement supplémentaire pour déposer une nouvelle marchandise.`
      }, { status: 400 });
    }

    // Générer un numéro de bon unique INB-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const batchNumber = `INB-${dateStr}-${randPart}`;

    // Token QR sécurisé
    const qrToken = `INB_QR_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const { data: created, error } = await supabase
      .from('warehouse_inbound_batches')
      .insert({
        batch_number: batchNumber,
        vendor_id: vendorId,
        agency_id: agencyId,
        storage_space_id: resolvedSpaceId || null,
        status: 'PENDING',
        items: formattedItems,
        qr_token: qrToken,
        total_items_count: totalCount,
        received_items_count: 0,
        notes: notes?.trim() || null
      })
      .select('*')
      .single();

    if (error) {
      console.error('Inbound batch insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const qrPayload = JSON.stringify({
      type: 'INBOUND_BATCH',
      batchId: created.id,
      batchNumber: created.batch_number,
      token: created.qr_token
    });

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrPayload)}`;

    return NextResponse.json({
      success: true,
      batch: {
        ...created,
        qrPayload,
        qrImageUrl
      }
    });
  } catch (err: any) {
    console.error('[POST /api/vendor/warehouse/inbound-batches]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
