/**
 * POST /api/agency/warehouse/inbound-batches/[id]/receive
 * Valide la réception physique d'un bon de dépôt en entrepôt.
 * Incrémente automatiquement les stocks et trace les mouvements.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : null;

    if (!agencyId && session?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { items: receivedItemsList, shelfLocationGlobal, notes } = body;

    // 1. Récupérer le bon
    const { data: batch, error: batchErr } = await supabase
      .from('warehouse_inbound_batches')
      .select('*')
      .eq('id', id)
      .single();

    if (batchErr || !batch) {
      return NextResponse.json({ error: 'Bon de dépôt introuvable.' }, { status: 404 });
    }

    if (agencyId && batch.agency_id !== agencyId && session?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Ce bon de dépôt est destiné à une autre agence.' }, { status: 403 });
    }

    if (batch.status === 'RECEIVED') {
      return NextResponse.json({ error: 'Ce bon de dépôt a déjà été réceptionné.' }, { status: 400 });
    }

    const agentName = session?.name || 'Agent Entrepôt';
    const declaredItems: any[] = Array.isArray(batch.items) ? batch.items : [];

    let totalReceived = 0;
    const updatedBatchItems: any[] = [];

    // 2. Traitement de chaque article
    for (let i = 0; i < declaredItems.length; i++) {
      const declared = declaredItems[i];
      const matchReceived = Array.isArray(receivedItemsList)
        ? receivedItemsList.find((r: any) => r.productName === declared.productName || r.sku === declared.sku)
        : null;

      const qtyReceived = matchReceived !== undefined && matchReceived !== null
        ? Math.max(0, parseInt(matchReceived.receivedQuantity, 10) || 0)
        : declared.expectedQuantity;

      const shelfLoc = matchReceived?.shelfLocation?.trim() || shelfLocationGlobal?.trim() || declared.shelfLocation || 'Rayon A';

      totalReceived += qtyReceived;

      updatedBatchItems.push({
        ...declared,
        receivedQuantity: qtyReceived,
        shelfLocation: shelfLoc
      });

      if (qtyReceived > 0) {
        // Chercher si le produit existe déjà dans warehouse_inventory
        let { data: existingInv } = await supabase
          .from('warehouse_inventory')
          .select('*')
          .eq('vendor_id', batch.vendor_id)
          .eq('agency_id', batch.agency_id)
          .eq('product_name', declared.productName)
          .maybeSingle();

        let inventoryId: string;
        let prevStock = 0;
        let newStock = qtyReceived;

        if (existingInv) {
          inventoryId = existingInv.id;
          prevStock = Number(existingInv.quantity_in_stock || 0);
          newStock = prevStock + qtyReceived;

          await supabase
            .from('warehouse_inventory')
            .update({
              quantity_in_stock: newStock,
              shelf_location: shelfLoc,
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', inventoryId);
        } else {
          // Créer l'entrée dans l'inventaire
          const { data: newInv, error: invErr } = await supabase
            .from('warehouse_inventory')
            .insert({
              vendor_id: batch.vendor_id,
              agency_id: batch.agency_id,
              product_name: declared.productName,
              sku: declared.sku || null,
              unit_price: parseFloat(declared.unitPrice) || 0,
              quantity_in_stock: qtyReceived,
              quantity_reserved: 0,
              shelf_location: shelfLoc,
              low_stock_threshold: 5,
              is_active: true
            })
            .select('id')
            .single();

          if (invErr || !newInv) {
            console.error('Failed to create inventory item during receive:', invErr);
            continue;
          }
          inventoryId = newInv.id;
        }

        // Enregistrer le mouvement de stock
        await supabase.from('warehouse_stock_movements').insert({
          inventory_id: inventoryId,
          agency_id: batch.agency_id,
          vendor_id: batch.vendor_id,
          type: 'DEPOSIT',
          quantity: qtyReceived,
          previous_stock: prevStock,
          new_stock: newStock,
          inbound_batch_id: batch.id,
          reference: batch.batch_number,
          performed_by: agentName,
          notes: `Réception bon de dépôt ${batch.batch_number}`
        });
      }
    }

    // 3. Mettre à jour le statut du bon
    const nowIso = new Date().toISOString();
    const { data: updatedBatch, error: updateErr } = await supabase
      .from('warehouse_inbound_batches')
      .update({
        status: 'RECEIVED',
        received_items_count: totalReceived,
        received_at: nowIso,
        received_by: agentName,
        items: updatedBatchItems,
        notes: notes?.trim() || batch.notes,
        updated_at: nowIso
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      console.error('Inbound batch update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 4. Notifier le vendeur
    try {
      await supabase.from('notifications').insert({
        user_id: batch.vendor_id,
        title: '📦 Marchandise réceptionnée en entrepôt',
        message: `Votre bon de dépôt ${batch.batch_number} (${totalReceived} articles) a été réceptionné et stocké avec succès à l'agence.`,
        type: 'WAREHOUSE_INBOUND_RECEIVED',
        created_at: nowIso
      });
    } catch (notifErr) {
      console.warn('Could not create notification for vendor:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `Bon ${batch.batch_number} réceptionné avec succès (${totalReceived} articles en stock).`,
      batch: updatedBatch
    });
  } catch (err: any) {
    console.error('[POST /api/agency/warehouse/inbound-batches/[id]/receive]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
