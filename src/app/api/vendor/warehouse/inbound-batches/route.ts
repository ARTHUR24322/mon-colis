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
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, name')
        .in('id', agencyIds);
      (agencies || []).forEach(a => agencyMap.set(a.id, a.name));
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
        agencyName: agencyMap.get(b.agency_id) || 'Agence Partenaire',
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

    const { agencyId, items, notes } = body;

    if (!agencyId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        error: 'Veuillez sélectionner une agence et au moins un produit à déposer.'
      }, { status: 400 });
    }

    // Calculer le total d'unités
    const totalCount = items.reduce((sum: number, it: any) => sum + (parseInt(it.expectedQuantity, 10) || 0), 0);
    if (totalCount <= 0) {
      return NextResponse.json({ error: 'La quantité totale d’articles doit être supérieure à 0.' }, { status: 400 });
    }

    // Générer un numéro de bon unique INB-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const batchNumber = `INB-${dateStr}-${randPart}`;

    // Token QR sécurisé
    const qrToken = `INB_QR_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const formattedItems = items.map((it: any) => ({
      productName: it.productName.trim(),
      sku: it.sku?.trim() || '',
      expectedQuantity: parseInt(it.expectedQuantity, 10) || 1,
      receivedQuantity: 0,
      unitPrice: parseFloat(it.unitPrice) || 0
    }));

    const { data: created, error } = await supabase
      .from('warehouse_inbound_batches')
      .insert({
        batch_number: batchNumber,
        vendor_id: vendorId,
        agency_id: agencyId,
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
