/**
 * API /api/vendor/warehouse/inventory
 * Gestion des articles et niveaux de stock en entrepôt pour le vendeur.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : req.nextUrl.searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const agencyId = req.nextUrl.searchParams.get('agencyId');

    let query = supabase
      .from('warehouse_inventory')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    const { data: items, error } = await query;

    if (error) {
      console.warn('Inventory fetch error (tables might be pending migration):', error.message);
      return NextResponse.json({
        items: [],
        stats: { totalItems: 0, totalStock: 0, lowStockCount: 0, totalValuationUSD: 0 }
      });
    }

    const rawItems = items || [];

    // Récupérer les noms des agences associées
    const agencyIds = [...new Set(rawItems.map(i => i.agency_id).filter(Boolean))];
    const agencyNamesMap = new Map<string, string>();

    if (agencyIds.length > 0) {
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, name')
        .in('id', agencyIds);
      (agencies || []).forEach(a => agencyNamesMap.set(a.id, a.name));
    }

    let totalStock = 0;
    let lowStockCount = 0;
    let totalValuationUSD = 0;

    const enrichedItems = rawItems.map(item => {
      const inStock = Number(item.quantity_in_stock || 0);
      const reserved = Number(item.quantity_reserved || 0);
      const available = Math.max(0, inStock - reserved);
      const threshold = Number(item.low_stock_threshold || 5);
      const isLow = inStock <= threshold;

      totalStock += inStock;
      if (isLow) lowStockCount++;
      if (item.unit_currency === 'USD') {
        totalValuationUSD += inStock * Number(item.unit_price || 0);
      }

      return {
        id: item.id,
        vendorId: item.vendor_id,
        agencyId: item.agency_id,
        agencyName: agencyNamesMap.get(item.agency_id) || 'Agence Partenaire',
        storageSpaceId: item.storage_space_id,
        productName: item.product_name,
        sku: item.sku || '',
        barcode: item.barcode || '',
        photoUrl: item.photo_url || '',
        category: item.category || 'Général',
        unitPrice: Number(item.unit_price || 0),
        unitCurrency: item.unit_currency || 'USD',
        quantityInStock: inStock,
        quantityReserved: reserved,
        quantityAvailable: available,
        shelfLocation: item.shelf_location || 'Non assigné',
        lowStockThreshold: threshold,
        isLowStock: isLow,
        weightKg: Number(item.weight_kg || 0),
        isActive: item.is_active,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };
    });

    return NextResponse.json({
      items: enrichedItems,
      stats: {
        totalItems: enrichedItems.length,
        totalStock,
        lowStockCount,
        totalValuationUSD: Math.round(totalValuationUSD * 100) / 100
      }
    });
  } catch (err: any) {
    console.error('[GET /api/vendor/warehouse/inventory]', err);
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

    const {
      agencyId,
      productName,
      sku,
      barcode,
      photoUrl,
      category,
      unitPrice,
      unitCurrency,
      initialQuantity,
      shelfLocation,
      lowStockThreshold,
      weightKg
    } = body;

    if (!agencyId || !productName) {
      return NextResponse.json({ error: 'L’agence et le nom du produit sont obligatoires.' }, { status: 400 });
    }

    const initialQty = Math.max(0, parseInt(initialQuantity, 10) || 0);

    const { data: created, error } = await supabase
      .from('warehouse_inventory')
      .insert({
        vendor_id: vendorId,
        agency_id: agencyId,
        product_name: productName.trim(),
        sku: sku?.trim() || null,
        barcode: barcode?.trim() || null,
        photo_url: photoUrl?.trim() || null,
        category: category?.trim() || 'Général',
        unit_price: parseFloat(unitPrice) || 0,
        unit_currency: unitCurrency === 'CDF' ? 'CDF' : 'USD',
        quantity_in_stock: initialQty,
        quantity_reserved: 0,
        shelf_location: shelfLocation?.trim() || null,
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
        weight_kg: parseFloat(weightKg) || null,
        is_active: true
      })
      .select('*')
      .single();

    if (error) {
      console.error('Inventory insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Si une quantité initiale a été enregistrée, consigner le mouvement de stock
    if (initialQty > 0 && created) {
      await supabase.from('warehouse_stock_movements').insert({
        inventory_id: created.id,
        agency_id: agencyId,
        vendor_id: vendorId,
        type: 'DEPOSIT',
        quantity: initialQty,
        previous_stock: 0,
        new_stock: initialQty,
        performed_by: session?.name || 'Vendeur',
        notes: 'Initialisation de stock lors de la création du produit'
      });
    }

    return NextResponse.json({ success: true, item: created });
  } catch (err: any) {
    console.error('[POST /api/vendor/warehouse/inventory]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
