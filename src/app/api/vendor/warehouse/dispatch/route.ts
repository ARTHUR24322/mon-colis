/**
 * POST /api/vendor/warehouse/dispatch
 * Réserve ou décrémente un article en entrepôt lors de la création d'un colis.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const vendorId = session?.role === 'vendeur' ? session.userId : null;

    const body = await req.json();
    const { inventoryId, quantity, packageId, action } = body;

    if (!inventoryId) {
      return NextResponse.json({ error: 'Identifiant de produit requis.' }, { status: 400 });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    // Récupérer le produit en stock
    const { data: item, error: itemErr } = await supabase
      .from('warehouse_inventory')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Article en stock introuvable.' }, { status: 404 });
    }

    const currentStock = Number(item.quantity_in_stock || 0);
    const currentReserved = Number(item.quantity_reserved || 0);
    const available = currentStock - currentReserved;

    // Action 1 : Réservation lors de la création de colis
    if (!action || action === 'reserve') {
      if (available < qty) {
        return NextResponse.json({
          error: `Stock insuffisant. Seulement ${Math.max(0, available)} unité(s) disponible(s).`
        }, { status: 400 });
      }

      const newReserved = currentReserved + qty;

      const { data: updated, error: updErr } = await supabase
        .from('warehouse_inventory')
        .update({
          quantity_reserved: newReserved,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryId)
        .select('*')
        .single();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      // Enregistrer le mouvement de réservation
      await supabase.from('warehouse_stock_movements').insert({
        inventory_id: inventoryId,
        agency_id: item.agency_id,
        vendor_id: item.vendor_id,
        type: 'DISPATCH',
        quantity: -qty,
        previous_stock: currentStock,
        new_stock: currentStock,
        package_id: packageId || null,
        performed_by: session?.name || 'Vendeur',
        notes: `Réservation de ${qty} unité(s) pour le colis ${packageId || ''}`
      });

      return NextResponse.json({
        success: true,
        message: `${qty} unité(s) réservée(s) avec succès.`,
        item: updated
      });
    }

    // Action 2 : Annulation de réservation (libération du stock)
    if (action === 'release') {
      const newReserved = Math.max(0, currentReserved - qty);

      await supabase
        .from('warehouse_inventory')
        .update({
          quantity_reserved: newReserved,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryId);

      return NextResponse.json({ success: true, message: 'Stock réservé libéré.' });
    }

    // Action 3 : Sortie physique définitive (décrémentation finale lors de l'expédition/livraison)
    if (action === 'fulfill') {
      const newStock = Math.max(0, currentStock - qty);
      const newReserved = Math.max(0, currentReserved - qty);

      await supabase
        .from('warehouse_inventory')
        .update({
          quantity_in_stock: newStock,
          quantity_reserved: newReserved,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryId);

      await supabase.from('warehouse_stock_movements').insert({
        inventory_id: inventoryId,
        agency_id: item.agency_id,
        vendor_id: item.vendor_id,
        type: 'DISPATCH',
        quantity: -qty,
        previous_stock: currentStock,
        new_stock: newStock,
        package_id: packageId || null,
        performed_by: session?.name || 'Agence',
        notes: `Sortie d'entrepôt définitive pour livraison colis ${packageId || ''}`
      });

      return NextResponse.json({ success: true, message: 'Stock décrémenté.' });
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/vendor/warehouse/dispatch]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
