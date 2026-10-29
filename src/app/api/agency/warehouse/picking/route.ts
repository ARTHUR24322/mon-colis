/**
 * GET /api/agency/warehouse/picking
 * Liste des commandes de colis à préparer depuis l'entrepôt (Picking).
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

    // Récupérer les mouvements DISPATCH liés à des colis pour cette agence
    const { data: movements, error: movErr } = await supabase
      .from('warehouse_stock_movements')
      .select('*, inventory:warehouse_inventory(*)')
      .eq('agency_id', agencyId)
      .eq('type', 'DISPATCH')
      .not('package_id', 'is', null)
      .order('created_at', { ascending: false });

    if (movErr) {
      console.warn('Picking movements warning:', movErr.message);
    }

    const packageIds = [...new Set((movements || []).map(m => m.package_id).filter(Boolean))];

    // Récupérer les colis associés
    let packagesMap = new Map<string, any>();
    if (packageIds.length > 0) {
      const { data: pkgs } = await supabase
        .from('packages')
        .select('*')
        .in('id', packageIds);

      (pkgs || []).forEach(p => packagesMap.set(p.id, p));
    }

    // Récupérer les livreurs de l'agence pour la remise
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, profile:profiles(name, phone)')
      .eq('agency_id', agencyId);

    const availableDrivers = (drivers || []).map((d: any) => ({
      id: d.id,
      name: d.profile?.name || 'Livreur',
      phone: d.profile?.phone || ''
    }));

    // Fusionner pour générer les ordres de picking
    const pickingOrders = (movements || []).map(m => {
      const pkg = packagesMap.get(m.package_id);
      const inv = m.inventory;

      let pickingStatus: 'TO_PICK' | 'PICKED' | 'ASSIGNED' | 'DELIVERED' = 'TO_PICK';
      if (pkg?.status === 'DELIVERED') pickingStatus = 'DELIVERED';
      else if (pkg?.status === 'ASSIGNED_TO_DRIVER' || pkg?.status === 'IN_TRANSIT') pickingStatus = 'ASSIGNED';
      else if (pkg?.status === 'PICKED' || m.notes?.includes('Prélevé')) pickingStatus = 'PICKED';

      return {
        id: m.id,
        packageId: m.package_id,
        trackingCode: pkg?.tracking_code || 'MC-' + (m.package_id ? m.package_id.slice(0, 8).toUpperCase() : 'N/A'),
        clientName: pkg?.client_name || 'Client',
        clientAddress: pkg?.client_address || '',
        clientCommune: pkg?.client_commune || '',
        clientPhone: pkg?.client_phone || '',
        packageStatus: pkg?.status || 'PENDING',
        pickingStatus,
        inventoryId: m.inventory_id,
        productName: inv?.product_name || 'Article en stock',
        sku: inv?.sku || '',
        shelfLocation: inv?.shelf_location || 'Rayon A',
        quantity: Math.abs(m.quantity || 1),
        currentStock: inv?.quantity_in_stock || 0,
        createdAt: m.created_at
      };
    });

    return NextResponse.json({
      orders: pickingOrders,
      drivers: availableDrivers
    });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/picking]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
