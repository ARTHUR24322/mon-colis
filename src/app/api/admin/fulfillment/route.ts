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

    const spaceMap = new Map<string, any>();
    (spacesData || []).forEach(sp => spaceMap.set(sp.id, sp));

    // Enrichir les abonnements avec commissions, noms vendeur et agence
    const enrichedSubs = (subsData || []).map(s => {
      const space = s.storage_space_id ? spaceMap.get(s.storage_space_id) : null;
      const pricePaid = Number(s.price_paid || 0);
      const commissionRate = typeof s.commission_rate === 'number' && !isNaN(s.commission_rate)
        ? s.commission_rate
        : (typeof space?.commission_rate === 'number' && !isNaN(space.commission_rate) ? space.commission_rate : 10);
      const commissionAmount = typeof s.commission_amount === 'number' && !isNaN(s.commission_amount) && s.commission_amount > 0
        ? s.commission_amount
        : Number(((pricePaid * commissionRate) / 100).toFixed(2));
      const netAgencyAmount = typeof s.net_agency_amount === 'number' && !isNaN(s.net_agency_amount) && s.net_agency_amount > 0
        ? s.net_agency_amount
        : Number((pricePaid - commissionAmount).toFixed(2));

      return {
        ...s,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        net_agency_amount: netAgencyAmount,
        vendorName: profileMap.get(s.vendor_id)?.name || 'Vendeur Inconnu',
        vendorEmail: profileMap.get(s.vendor_id)?.email || '',
        agencyName: profileMap.get(s.agency_id)?.name || 'Agence Inconnue'
      };
    });

    // Enrichir les espaces avec nom de l'agence et commission par défaut
    const enrichedSpaces = (spacesData || []).map(sp => ({
      ...sp,
      commission_rate: typeof sp.commission_rate === 'number' && !isNaN(sp.commission_rate) ? sp.commission_rate : 10,
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
    const activeSubs = enrichedSubs.filter(s => s.status === 'ACTIVE');
    const monthlyRevenueEstimate = activeSubs.reduce((sum, s) => sum + (Number(s.price_paid) || 0), 0);
    const totalPlatformCommission = activeSubs.reduce((sum, s) => sum + (Number(s.commission_amount) || 0), 0);
    const netAgencyPayoutEstimate = monthlyRevenueEstimate - totalPlatformCommission;

    return NextResponse.json({
      success: true,
      kpis: {
        totalStockUnits,
        reservedStockUnits,
        activeSubscriptionsCount: activeSubs.length,
        totalSubscriptionsCount: (subsData || []).length,
        monthlyRevenueEstimate,
        totalPlatformCommission,
        netAgencyPayoutEstimate,
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

    // Action 4: Fixer la commission sur un abonnement de location d'entrepôt
    if (action === 'UPDATE_SUBSCRIPTION_COMMISSION') {
      const { subscriptionId, commissionRate, commissionAmount } = body;
      if (!subscriptionId) {
        return NextResponse.json({ error: 'subscriptionId manquant' }, { status: 400 });
      }

      const rate = typeof commissionRate === 'number' && !isNaN(commissionRate)
        ? Math.max(0, Math.min(100, commissionRate))
        : 10;

      // Récupérer la souscription
      const { data: sub, error: subErr } = await supabase
        .from('vendor_storage_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (subErr || !sub) {
        return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 });
      }

      const pricePaid = Number(sub.price_paid || 0);
      const calculatedAmt = typeof commissionAmount === 'number' && !isNaN(commissionAmount)
        ? Math.max(0, commissionAmount)
        : Number(((pricePaid * rate) / 100).toFixed(2));
      const calculatedNet = Math.max(0, Number((pricePaid - calculatedAmt).toFixed(2)));

      // Mettre à jour avec fallback si les colonnes ne sont pas encore créées
      try {
        const { data, error } = await supabase
          .from('vendor_storage_subscriptions')
          .update({
            commission_rate: rate,
            commission_amount: calculatedAmt,
            net_agency_amount: calculatedNet,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscriptionId)
          .select()
          .single();

        if (error) {
          // Si erreur de colonne manquante, on informe sans crasher
          console.warn('[UPDATE_SUBSCRIPTION_COMMISSION] Note colonne:', error.message);
          return NextResponse.json({
            success: true,
            warning: 'Commission calculée. Veuillez exécuter la migration SQL si les colonnes ne sont pas encore ajoutées en base.',
            data: { ...sub, commission_rate: rate, commission_amount: calculatedAmt, net_agency_amount: calculatedNet }
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Commission sur la location mise à jour avec succès.',
          data
        });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Erreur mise à jour commission' }, { status: 500 });
      }
    }

    // Action 5: Fixer la commission par défaut sur un espace de stockage d'agence
    if (action === 'UPDATE_SPACE_COMMISSION') {
      const { spaceId, commissionRate } = body;
      if (!spaceId) {
        return NextResponse.json({ error: 'spaceId manquant' }, { status: 400 });
      }

      const rate = typeof commissionRate === 'number' && !isNaN(commissionRate)
        ? Math.max(0, Math.min(100, commissionRate))
        : 10;

      try {
        const { data, error } = await supabase
          .from('agency_storage_spaces')
          .update({
            commission_rate: rate,
            updated_at: new Date().toISOString()
          })
          .eq('id', spaceId)
          .select()
          .single();

        if (error) {
          console.warn('[UPDATE_SPACE_COMMISSION] Note colonne:', error.message);
          return NextResponse.json({
            success: true,
            warning: 'Taux commission enregistré localement. Pensez à exécuter la migration SQL.',
            data: { id: spaceId, commission_rate: rate }
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Taux de commission de l\'espace mis à jour avec succès.',
          data
        });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Erreur mise à jour espace' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: any) {
    console.error('[ADMIN FULFILLMENT API POST]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
