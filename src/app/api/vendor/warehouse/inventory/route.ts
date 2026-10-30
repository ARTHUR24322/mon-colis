/**
 * API /api/vendor/warehouse/inventory
 * Gestion des articles et niveaux de stock en entrepôt pour le vendeur.
 * Correction Bug 2.2 :
 * - Nom de colonne Postgres exact : low_stock_threshold (snake_case)
 * - Rattachement obligatoire à une souscription de stockage acceptée (ACTIVE)
 * - Détection et propositions en cas de SKU existant
 * - Générateur de SKU unique (PRÉFIXE-NOM-0001)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import { fulfillmentService } from '@/lib/fulfillment-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : req.nextUrl.searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const action = req.nextUrl.searchParams.get('action');

    // 1. Action : Génération automatique de SKU unique
    if (action === 'generate_sku') {
      const prodName = req.nextUrl.searchParams.get('name') || 'PROD';
      const sku = await fulfillmentService.generateUniqueSku(vendorId, prodName);
      return NextResponse.json({ sku });
    }

    // 2. Action : Vérification d'existence d'un SKU
    if (action === 'check_sku') {
      const skuQuery = req.nextUrl.searchParams.get('sku') || '';
      const existing = await fulfillmentService.checkSkuExists(vendorId, skuQuery);
      return NextResponse.json({ exists: !!existing, item: existing });
    }

    // 3. Récupération normale de l'inventaire
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
      console.error('[GET /api/vendor/warehouse/inventory] Erreur SQL:', error.message);
      return NextResponse.json({
        items: [],
        error: error.message,
        stats: { totalItems: 0, totalStock: 0, lowStockCount: 0, totalValuationUSD: 0 }
      }, { status: 500 });
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
      const threshold = Number(item.low_stock_threshold ?? 5);
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
        subscriptionId: item.subscription_id,
        productName: item.product_name,
        sku: item.sku || '',
        barcode: item.barcode || '',
        photoUrl: item.photo_url || '',
        category: item.category || 'Général',
        variant: item.variant || '',
        dimensions: item.dimensions || '',
        unitPrice: Number(item.unit_price || 0),
        unitCurrency: item.unit_currency || 'USD',
        quantityInStock: inStock,
        quantityReserved: reserved,
        quantityAvailable: available,
        shelfLocation: item.shelf_location || 'Rayon A',
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
    if (!session || (session.role !== 'vendeur' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Accès réservé aux vendeurs.' }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide.' }, { status: 400 });
    }

    const vendorId = session.role === 'vendeur' ? session.userId : (body.vendorId || session.userId);

    const {
      agencyId,
      productName,
      sku,
      barcode,
      photoUrl,
      category,
      variant,
      dimensions,
      unitPrice,
      unitCurrency,
      initialQuantity,
      shelfLocation,
      lowStockThreshold,
      weightKg,
      storageSpaceId,
      subscriptionId,
    } = body;

    if (!agencyId || !productName?.trim()) {
      return NextResponse.json({ error: 'L’agence et le nom du produit sont obligatoires.' }, { status: 400 });
    }

    const result = await fulfillmentService.createInventoryItem({
      vendorId,
      agencyId,
      productName: productName.trim(),
      sku: sku?.trim() || undefined,
      barcode: barcode?.trim() || undefined,
      photoUrl: photoUrl?.trim() || undefined,
      category: category?.trim() || 'Général',
      variant: variant?.trim() || undefined,
      dimensions: dimensions?.trim() || undefined,
      unitPrice: parseFloat(unitPrice) || 0,
      unitCurrency: unitCurrency === 'CDF' ? 'CDF' : 'USD',
      initialQuantity: parseInt(initialQuantity, 10) || 0,
      lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
      weightKg: parseFloat(weightKg) || undefined,
      shelfLocation: shelfLocation?.trim() || 'Rayon A',
      storageSpaceId,
      subscriptionId,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.skuExists ? 409 : 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/vendor/warehouse/inventory]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
