/**
 * API /api/agency/warehouse/returns
 * Gestion des retours colis directement réintégrés dans le stock entrepôt de l'agence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : req.nextUrl.searchParams.get('agencyId');

    if (!agencyId) {
      return NextResponse.json({ error: 'Identifiant agence requis.' }, { status: 400 });
    }

    // Récupérer les colis en statut de retour/échec qui ont été expédiés en WAREHOUSE_FULFILLMENT
    // Les statuts pouvant donner lieu à réintégration : 'RETOUR_EN_COURS', 'RETOURNE', 'ECHEC', 'ANNULE'
    const returnStatuses = ['RETOUR_EN_COURS', 'RETOURNÉ', 'RETOURNE', 'ECHEC', 'ÉCHEC', 'ANNULÉ', 'ANNULE'];

    const { data: rawPackages, error } = await supabase
      .from('colis')
      .select('id, code_suivi, client_nom, client_telephone, statut, montant, destination, agence_id, created_at, meta')
      .eq('agence_id', agencyId)
      .in('statut', returnStatuses)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('Fulfillment returns fetch warning:', error.message);
      return NextResponse.json({ returns: [] });
    }

    // Filtrer ceux qui proviennent du stock entrepôt (meta.deliveryMode === 'WAREHOUSE_FULFILLMENT')
    const warehouseReturns = (rawPackages || []).filter(c => {
      const meta = typeof c.meta === 'string' ? JSON.parse(c.meta || '{}') : (c.meta || {});
      return meta.deliveryMode === 'WAREHOUSE_FULFILLMENT' && !meta.warehouseReturnedToStock;
    }).map(c => {
      const meta = typeof c.meta === 'string' ? JSON.parse(c.meta || '{}') : (c.meta || {});
      return {
        id: c.id,
        trackingCode: c.code_suivi,
        recipientName: c.client_nom,
        recipientPhone: c.client_telephone,
        destination: c.destination,
        status: c.statut,
        amount: Number(c.montant || 0),
        warehouseItemId: meta.warehouseItemId,
        productName: meta.warehouseItemName || 'Article Entrepôt',
        createdAt: c.created_at
      };
    });

    return NextResponse.json({ returns: warehouseReturns });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/returns]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'agence' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const agencyId = session.role === 'agence' ? session.agencyId || session.userId : null;
    const body = await req.json();
    const { colisId, condition = 'OK', notes = '', shelfLocation } = body;

    if (!colisId) {
      return NextResponse.json({ error: 'Identifiant du colis requis.' }, { status: 400 });
    }

    // 1. Récupérer le colis
    const { data: colis, error: colisErr } = await supabase
      .from('colis')
      .select('*')
      .eq('id', colisId)
      .single();

    if (colisErr || !colis) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    const meta = typeof colis.meta === 'string' ? JSON.parse(colis.meta || '{}') : (colis.meta || {});
    const warehouseItemId = meta.warehouseItemId;

    if (!warehouseItemId) {
      return NextResponse.json({ error: 'Ce colis n’est pas associé à un article en stock entrepôt.' }, { status: 400 });
    }

    if (meta.warehouseReturnedToStock) {
      return NextResponse.json({ error: 'Ce colis a déjà été réintégré dans le stock de l’entrepôt.' }, { status: 400 });
    }

    // 2. Si l'article est en bon état ('OK'), réintégrer dans warehouse_inventory
    if (condition === 'OK') {
      const { data: invItem, error: invErr } = await supabase
        .from('warehouse_inventory')
        .select('*')
        .eq('id', warehouseItemId)
        .single();

      if (!invErr && invItem) {
        const newStock = (invItem.quantity_in_stock || 0) + 1;
        const updatePayload: any = { quantity_in_stock: newStock };
        if (shelfLocation?.trim()) {
          updatePayload.shelf_location = shelfLocation.trim();
        }

        await supabase
          .from('warehouse_inventory')
          .update(updatePayload)
          .eq('id', warehouseItemId);

        // Mouvement de stock de type 'RETURN'
        await supabase
          .from('warehouse_stock_movements')
          .insert({
            inventory_id: warehouseItemId,
            type: 'RETURN',
            quantity: 1,
            colis_id: colisId,
            notes: `Réintégration suite à retour colis ${colis.code_suivi || ''}. État: ${condition}. ${notes}`.trim()
          });
      }
    } else {
      // Marchandise endommagée
      await supabase
        .from('warehouse_stock_movements')
        .insert({
          inventory_id: warehouseItemId,
          type: 'ADJUSTMENT',
          quantity: 0,
          colis_id: colisId,
          notes: `Colis ${colis.code_suivi || ''} retourné endommagé (${condition}). Non réintégré en stock vendable. ${notes}`.trim()
        });
    }

    // 3. Mettre à jour les métadonnées du colis
    const updatedMeta = {
      ...meta,
      warehouseReturnedToStock: true,
      warehouseReturnDate: new Date().toISOString(),
      warehouseReturnCondition: condition,
      warehouseReturnNotes: notes
    };

    await supabase
      .from('colis')
      .update({
        meta: updatedMeta,
        statut: 'RETOURNÉ_EN_RAYON'
      })
      .eq('id', colisId);

    return NextResponse.json({
      success: true,
      message: condition === 'OK'
        ? 'Colis retourné et article remis en stock avec succès.'
        : 'Retour traité. Article classé comme endommagé / hors stock.',
      condition
    });
  } catch (err: any) {
    console.error('[POST /api/agency/warehouse/returns]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
