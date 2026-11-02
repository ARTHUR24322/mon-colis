/**
 * GET /api/agency/warehouse/inventory
 * Retourne l'inventaire complet stocké dans l'entrepôt de l'agence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : req.nextUrl.searchParams.get('agencyId');

    if (!agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data: items, error } = await supabase
      .from('warehouse_inventory')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('shelf_location', { ascending: true });

    if (error) {
      console.warn('Agency warehouse inventory warning:', error.message);
      return NextResponse.json({ items: [] });
    }

    const rawItems = items || [];
    const vendorIds = [...new Set(rawItems.map(i => i.vendor_id).filter(Boolean))];
    const vendorMap = new Map<string, { name: string; phone: string }>();

    if (vendorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', vendorIds);
      (profiles || []).forEach(p => vendorMap.set(p.id, {
        name: p.name || 'Vendeur Partenaire',
        phone: p.phone || ''
      }));
    }

    const enriched = rawItems.map(it => {
      const v = vendorMap.get(it.vendor_id);
      return {
        id: it.id,
        vendorId: it.vendor_id,
        vendorName: v?.name || 'Vendeur',
        vendorPhone: v?.phone || '',
        agencyId: it.agency_id,
        productName: it.product_name,
        sku: it.sku || '',
        category: it.category || 'Général',
        unitPrice: Number(it.unit_price || 0),
        unitCurrency: it.unit_currency || 'USD',
        quantityInStock: Number(it.quantity_in_stock || 0),
        quantityReserved: Number(it.quantity_reserved || 0),
        quantityAvailable: Math.max(0, Number(it.quantity_in_stock || 0) - Number(it.quantity_reserved || 0)),
        shelfLocation: it.shelf_location || 'Non assigné',
        lowStockThreshold: Number(it.low_stock_threshold || 5),
        isLowStock: Number(it.quantity_in_stock || 0) <= Number(it.low_stock_threshold || 5),
        createdAt: it.created_at,
        updatedAt: it.updated_at
      };
    });

    // Récupérer également la liste complète des vendeurs pour les dépôts directs au guichet
    const { data: allVendors } = await supabase
      .from('profiles')
      .select('id, name, phone, email')
      .eq('role', 'vendeur')
      .order('name', { ascending: true });

    return NextResponse.json({
      items: enriched,
      vendors: allVendors || []
    });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/inventory]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}

/**
 * POST /api/agency/warehouse/inventory
 * Réception physique directe d'un colis / marchandise au guichet de l'agence.
 * Enregistre l'article, attribue l'étagère/espace et génère l'étiquette QR code à coller.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : null;

    if (!agencyId && session?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      vendorId,
      productName,
      unitPrice,
      unitCurrency,
      quantity,
      shelfLocation,
      storageSpaceId,
      sku,
      category,
      notes
    } = body;

    if (!vendorId) {
      return NextResponse.json({ error: 'Veuillez sélectionner le vendeur propriétaire.' }, { status: 400 });
    }

    if (!productName || !productName.trim()) {
      return NextResponse.json({ error: 'Le nom de l\'article est obligatoire.' }, { status: 400 });
    }

    const parsedPrice = parseFloat(unitPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: 'Le prix unitaire doit être un montant valide (≥ 0).' }, { status: 400 });
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json({ error: 'La quantité reçue doit être d\'au moins 1.' }, { status: 400 });
    }

    // Récupérer le nom et le téléphone du vendeur pour l'étiquette
    const { data: vendorProfile } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .eq('id', vendorId)
      .single();

    const vendorName = vendorProfile?.name || 'Vendeur';
    const vendorPhone = vendorProfile?.phone || '';

    // Générer un code unique / barcode pour le produit
    const barcode = `MCL-ART-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const cleanSku = (sku && sku.trim()) ? sku.trim().toUpperCase() : `SKU-${Date.now().toString(36).toUpperCase()}`;
    const cleanShelf = (shelfLocation && shelfLocation.trim()) ? shelfLocation.trim() : 'Rayon Général';
    const currency = unitCurrency === 'CDF' ? 'CDF' : 'USD';

    // 1. Insérer dans warehouse_inventory
    const { data: insertedItem, error: insertErr } = await supabase
      .from('warehouse_inventory')
      .insert({
        agency_id: agencyId,
        vendor_id: vendorId,
        storage_space_id: storageSpaceId || null,
        product_name: productName.trim(),
        sku: cleanSku,
        barcode: barcode,
        unit_price: parsedPrice,
        unit_currency: currency,
        quantity_in_stock: parsedQty,
        quantity_reserved: 0,
        shelf_location: cleanShelf,
        category: category?.trim() || 'Général',
        low_stock_threshold: 5,
        is_active: true
      })
      .select('*')
      .single();

    if (insertErr || !insertedItem) {
      console.error('Insert inventory item error:', insertErr);
      return NextResponse.json({ error: insertErr?.message || 'Erreur lors de l\'enregistrement.' }, { status: 500 });
    }

    // 2. Journaliser le mouvement de stock
    try {
      await supabase.from('warehouse_stock_movements').insert({
        inventory_id: insertedItem.id,
        agency_id: agencyId,
        vendor_id: vendorId,
        type: 'DEPOSIT',
        quantity: parsedQty,
        previous_stock: 0,
        new_stock: parsedQty,
        reference_type: 'DIRECT_DEPOSIT',
        notes: `Dépôt physique direct au guichet agence${notes ? ` : ${notes.trim()}` : ''}`
      });
    } catch (e) {
      console.warn('Stock movement log warning:', e);
    }

    // 3. Construire le payload QR Code et l'étiquette
    const qrPayload = JSON.stringify({
      app: 'MONCOLIS',
      type: 'INVENTORY_ITEM',
      id: insertedItem.id,
      code: barcode,
      sku: cleanSku,
      product: insertedItem.product_name,
      price: parsedPrice,
      currency: currency,
      vendor: vendorName,
      phone: vendorPhone,
      shelf: cleanShelf,
      date: new Date().toISOString()
    });

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrPayload)}&margin=10`;

    return NextResponse.json({
      success: true,
      message: 'Marchandise enregistrée en rayon avec succès.',
      item: {
        id: insertedItem.id,
        vendorId,
        vendorName,
        vendorPhone,
        agencyId,
        productName: insertedItem.product_name,
        sku: insertedItem.sku,
        barcode: insertedItem.barcode,
        category: insertedItem.category,
        unitPrice: Number(insertedItem.unit_price),
        unitCurrency: insertedItem.unit_currency,
        quantityInStock: Number(insertedItem.quantity_in_stock),
        quantityReserved: 0,
        quantityAvailable: Number(insertedItem.quantity_in_stock),
        shelfLocation: insertedItem.shelf_location,
        createdAt: insertedItem.created_at
      },
      qrPayload,
      qrToken: barcode,
      qrImageUrl,
      labelData: {
        productName: insertedItem.product_name,
        vendorName,
        vendorPhone,
        unitPrice: parsedPrice,
        unitCurrency: currency,
        shelfLocation: cleanShelf,
        sku: cleanSku,
        barcode: barcode,
        createdAt: insertedItem.created_at
      }
    });
  } catch (err: any) {
    console.error('[POST /api/agency/warehouse/inventory]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
