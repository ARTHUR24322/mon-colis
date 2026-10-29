/**
 * POST /api/agency/warehouse/picking/[id]/action
 * Exécute une action de picking :
 * - 'pick' : Confirme le prélèvement en rayon et décrémente physiquement le stock.
 * - 'handover' : Remet le colis au livreur sans étape de ramassage.
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

    const { id } = await params; // movementId
    const body = await req.json();
    const { action, driverId } = body;

    // 1. Récupérer le mouvement
    const { data: mov, error: movErr } = await supabase
      .from('warehouse_stock_movements')
      .select('*, inventory:warehouse_inventory(*)')
      .eq('id', id)
      .single();

    if (movErr || !mov) {
      return NextResponse.json({ error: 'Ordre de préparation introuvable.' }, { status: 404 });
    }

    const qty = Math.abs(mov.quantity || 1);
    const agentName = session?.name || 'Agent Entrepôt';

    // ACTION 1 : PICKING (Prélèvement en rayon)
    if (action === 'pick') {
      const inv = mov.inventory;
      if (inv) {
        const curStock = Number(inv.quantity_in_stock || 0);
        const curReserved = Number(inv.quantity_reserved || 0);

        const newStock = Math.max(0, curStock - qty);
        const newReserved = Math.max(0, curReserved - qty);

        await supabase
          .from('warehouse_inventory')
          .update({
            quantity_in_stock: newStock,
            quantity_reserved: newReserved,
            updated_at: new Date().toISOString()
          })
          .eq('id', inv.id);
      }

      await supabase
        .from('warehouse_stock_movements')
        .update({
          notes: `Prélevé et emballé par ${agentName} le ${new Date().toLocaleDateString('fr-FR')}`
        })
        .eq('id', id);

      return NextResponse.json({
        success: true,
        message: 'Article prélevé avec succès en rayon. Stock décrémenté.'
      });
    }

    // ACTION 2 : REMISE AU LIVREUR (Handover direct sans ramassage)
    if (action === 'handover') {
      if (!driverId) {
        return NextResponse.json({ error: 'Veuillez sélectionner un livreur.' }, { status: 400 });
      }

      if (!mov.package_id) {
        return NextResponse.json({ error: 'Aucun colis associé à cet ordre.' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();

      // Mettre à jour le colis
      const { data: updatedPkg, error: pkgErr } = await supabase
        .from('packages')
        .update({
          driver_id: driverId,
          status: 'ASSIGNED_TO_DRIVER',
          updated_at: nowIso
        })
        .eq('id', mov.package_id)
        .select('*')
        .single();

      if (pkgErr) {
        return NextResponse.json({ error: pkgErr.message }, { status: 500 });
      }

      // Notifier le livreur
      try {
        await supabase.from('notifications').insert({
          user_id: driverId,
          title: '📦 Colis d’entrepôt remis pour livraison',
          message: `Le colis ${updatedPkg?.tracking_code || ''} vous a été remis directement depuis l’entrepôt pour livraison à ${updatedPkg?.client_commune || 'destination'}.`,
          type: 'PACKAGE_HANDOVER',
          created_at: nowIso
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'Colis remis au livreur avec succès. La course démarre immédiatement !'
      });
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/agency/warehouse/picking/[id]/action]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
