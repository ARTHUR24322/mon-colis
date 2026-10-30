/**
 * POST /api/agency/warehouse/picking/[id]/action
 * Exécute une action de picking :
 * - 'pick' : Confirme le prélèvement et l'emballage en rayon SANS décrémenter le stock physique (règle OTP).
 * - 'handover' : Remise unique et idempotente au livreur via executePackageHandover (Bug 2.3).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import { fulfillmentService } from '@/lib/fulfillment-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : null;

    if (!agencyId && session?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Accès réservé aux agences.' }, { status: 403 });
    }

    const { id: movementId } = await params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide.' }, { status: 400 });
    }

    const { action, driverId, idempotencyKey } = body;

    // 1. Récupérer le mouvement de picking
    const { data: mov, error: movErr } = await supabase
      .from('warehouse_stock_movements')
      .select('*, inventory:warehouse_inventory(*)')
      .eq('id', movementId)
      .single();

    if (movErr || !mov) {
      return NextResponse.json({ error: 'Ordre de préparation introuvable.' }, { status: 404 });
    }

    const agentName = session?.name || 'Agent Entrepôt';

    // ACTION 1 : PICKING (Prélèvement et emballage en rayon)
    // Conforme à la règle de stock : LE STOCK PHYSIQUE NE DIMINUE QU'À L'OTP
    if (action === 'pick') {
      const nowFormatted = new Date().toLocaleDateString('fr-FR');
      await supabase
        .from('warehouse_stock_movements')
        .update({
          notes: `Prélevé et emballé par ${agentName} le ${nowFormatted}`
        })
        .eq('id', movementId);

      if (mov.package_id) {
        await supabase
          .from('packages')
          .update({
            status: 'ACCEPTED_BY_AGENCY',
            updated_at: new Date().toISOString()
          })
          .eq('id', mov.package_id);
      }

      return NextResponse.json({
        success: true,
        message: 'Article prélevé et emballé avec succès en rayon. Prêt pour la remise au livreur.'
      });
    }

    // ACTION 2 : REMISE AU LIVREUR (Handover direct, unique et idempotent)
    if (action === 'handover') {
      if (!driverId) {
        return NextResponse.json({ error: 'Veuillez sélectionner un livreur.' }, { status: 400 });
      }

      if (!mov.package_id) {
        return NextResponse.json({ error: 'Aucun colis associé à cet ordre de picking.' }, { status: 400 });
      }

      const handoverResult = await fulfillmentService.executePackageHandover({
        packageId: mov.package_id,
        driverId,
        agencyId: agencyId || mov.agency_id,
        actorId: session?.userId || 'system',
        actorName: agentName,
        actorRole: session?.role || 'agence',
        idempotencyKey: idempotencyKey || `handover-${movementId}-${mov.package_id}`,
      });

      if (!handoverResult.success) {
        return NextResponse.json({ error: handoverResult.error }, { status: 400 });
      }

      // Marquer le mouvement comme remis pour mise à jour de l'affichage
      await supabase
        .from('warehouse_stock_movements')
        .update({
          notes: `${mov.notes || 'Prélevé'} · Remis au livreur ${handoverResult.driver_name || ''} le ${new Date().toLocaleDateString('fr-FR')}`
        })
        .eq('id', movementId);

      return NextResponse.json({
        success: true,
        message: handoverResult.message || 'Colis remis au livreur avec succès. La course démarre immédiatement !',
        package: handoverResult.package,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/agency/warehouse/picking/[id]/action]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
