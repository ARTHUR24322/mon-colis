import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminSession } from '@/lib/adminSession';
import { getSession } from '@/lib/session-server';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession().catch(() => null);
    const userSession = !adminSession ? await getSession().catch(() => null) : null;

    if (!adminSession && !userSession) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const supabase = getAdminClient();

    // 1. Espaces de stockage des agences
    const { data: spacesData, error: spacesErr } = await supabase
      .from('agency_storage_spaces')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Abonnements de stockage des vendeurs
    const { data: subsData, error: subsErr } = await supabase
      .from('vendor_storage_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    // 3. Inventaire des produits stockés
    const { data: invData, error: invErr } = await supabase
      .from('warehouse_inventory')
      .select('*')
      .order('created_at', { ascending: false });

    // 4. Derniers lots d'approvisionnement (Inbound batches)
    const { data: batchesData, error: batchesErr } = await supabase
      .from('warehouse_inbound_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    // 5. Derniers mouvements de stock (Audit trail)
    const { data: movementsData, error: movErr } = await supabase
      .from('warehouse_stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // 6. Récupérer les profils (vendeurs & agences) pour affichage clair
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, email, role');

    const profileMap = new Map<string, { name: string; email: string; role: string }>();
    (profilesData || []).forEach(p => profileMap.set(p.id, p));

    // Enrichir les abonnements avec noms vendeur et agence
    const enrichedSubs = (subsData || []).map(s => ({
      ...s,
      vendorName: profileMap.get(s.vendor_id)?.name || 'Vendeur Inconnu',
      vendorEmail: profileMap.get(s.vendor_id)?.email || '',
      agencyName: profileMap.get(s.agency_id)?.name || 'Agence Inconnue'
    }));

    // Enrichir les espaces avec nom de l'agence
    const enrichedSpaces = (spacesData || []).map(sp => ({
      ...sp,
      agencyName: profileMap.get(sp.agency_id)?.name || 'Agence Inconnue'
    }));

    // Enrichir l'inventaire avec noms
    const enrichedInventory = (invData || []).map(inv => ({
      ...inv,
      vendorName: profileMap.get(inv.vendor_id)?.name || 'Vendeur Inconnu',
      agencyName: profileMap.get(inv.agency_id)?.name || 'Agence Inconnue'
    }));

    // Enrichir les lots
    const enrichedBatches = (batchesData || []).map(b => ({
      ...b,
      vendorName: profileMap.get(b.vendor_id)?.name || 'Vendeur Inconnu',
      agencyName: profileMap.get(b.agency_id)?.name || 'Agence Inconnue'
    }));

    // Enrichir les mouvements
    const enrichedMovements = (movementsData || []).map(m => ({
      ...m,
      vendorName: profileMap.get(m.vendor_id)?.name || 'Vendeur Inconnu',
      agencyName: profileMap.get(m.agency_id)?.name || 'Agence Inconnue'
    }));

    // KPIs calculés
    const totalStockUnits = (invData || []).reduce((sum, item) => sum + (item.quantity_in_stock || 0), 0);
    const reservedStockUnits = (invData || []).reduce((sum, item) => sum + (item.quantity_reserved || 0), 0);
    const activeSubs = (subsData || []).filter(s => s.status === 'ACTIVE');
    const monthlyRevenueEstimate = activeSubs.reduce((sum, s) => sum + (Number(s.price_paid) || 0), 0);

    return NextResponse.json({
      success: true,
      kpis: {
        totalStockUnits,
        reservedStockUnits,
        activeSubscriptionsCount: activeSubs.length,
        totalSubscriptionsCount: (subsData || []).length,
        monthlyRevenueEstimate,
        totalSpacesCount: (spacesData || []).length,
        totalBatchesCount: (batchesData || []).length,
        totalInventoryItemsCount: (invData || []).length
      },
      spaces: enrichedSpaces,
      subscriptions: enrichedSubs,
      inventory: enrichedInventory,
      batches: enrichedBatches,
      movements: enrichedMovements
    });
  } catch (error: any) {
    console.error('[ADMIN FULFILLMENT API GET]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession().catch(() => null);
    const userSession = !adminSession ? await getSession().catch(() => null) : null;

    if (!adminSession && !userSession) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const body = await request.json();
    const { action } = body;

    // Action 1: Modifier le statut d'un abonnement de stockage vendeur
    if (action === 'UPDATE_SUBSCRIPTION_STATUS') {
      const { subscriptionId, newStatus } = body;
      if (!subscriptionId || !['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'].includes(newStatus)) {
        return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('vendor_storage_subscriptions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, message: `Abonnement mis à jour en "${newStatus}"`, data });
    }

    // Action 2: Modifier ou activer/désactiver un espace de stockage d'agence
    if (action === 'TOGGLE_SPACE_STATUS') {
      const { spaceId, isActive } = body;
      if (!spaceId) {
        return NextResponse.json({ error: 'Identifiant espace manquant' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('agency_storage_spaces')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', spaceId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, message: `Espace ${isActive ? 'activé' : 'désactivé'}`, data });
    }

    // Action 3: Ajustement manuel de stock super admin
    if (action === 'ADJUST_INVENTORY') {
      const { inventoryId, newQuantity, reason } = body;
      if (!inventoryId || typeof newQuantity !== 'number' || newQuantity < 0) {
        return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 });
      }

      const { data: inv, error: fetchErr } = await supabase
        .from('warehouse_inventory')
        .select('*')
        .eq('id', inventoryId)
        .single();

      if (fetchErr || !inv) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

      const diff = newQuantity - inv.quantity_in_stock;

      await supabase
        .from('warehouse_inventory')
        .update({ quantity_in_stock: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', inventoryId);

      // Enregistrer le mouvement d'ajustement super admin
      await supabase.from('warehouse_stock_movements').insert({
        inventory_id: inventoryId,
        agency_id: inv.agency_id,
        vendor_id: inv.vendor_id,
        type: 'ADJUSTMENT',
        quantity: diff,
        previous_stock: inv.quantity_in_stock,
        new_stock: newQuantity,
        performed_by: 'SUPERADMIN',
        notes: reason || 'Ajustement d\'inventaire par le Super Admin'
      });

      return NextResponse.json({ success: true, message: 'Stock ajusté avec succès' });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: any) {
    console.error('[ADMIN FULFILLMENT API POST]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
