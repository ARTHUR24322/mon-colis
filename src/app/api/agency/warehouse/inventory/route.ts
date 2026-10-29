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

    return NextResponse.json({ items: enriched });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/inventory]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
