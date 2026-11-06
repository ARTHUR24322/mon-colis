/**
 * POST /api/admin/packages/cleanup-orphans
 * Permet au Super Admin de :
 * - Purger (supprimer) tous les colis orphelins (sans agence) et leurs dépendances en cascade.
 * - OU réassigner tous les colis orphelins à une agence active cible.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession().catch(() => null);
    if (!admin) {
      return NextResponse.json({ error: 'Session administrateur requise.' }, { status: 401 });
    }
    if (admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Action réservée au Super Admin général.' }, { status: 403 });
    }

    const body = await req.json();
    const { action = 'purge', targetAgencyId, packageIds } = body as {
      action: 'purge' | 'reassign';
      targetAgencyId?: string;
      packageIds?: string[];
    };

    // 1. Trouver les colis orphelins cibles
    let query = supabase
      .from('packages')
      .select('id, tracking_code, status')
      .or('agency_id.is.null,agency_id.eq.');

    if (packageIds && Array.isArray(packageIds) && packageIds.length > 0) {
      query = supabase.from('packages').select('id, tracking_code, status').in('id', packageIds);
    }

    const { data: orphanPackages, error: fetchErr } = await query;
    if (fetchErr) {
      console.error('[CLEANUP ORPHANS] Erreur fetch:', fetchErr);
      return NextResponse.json({ error: 'Erreur lors de la recherche des colis orphelins.' }, { status: 500 });
    }

    const ids = (orphanPackages || []).map(p => p.id);
    if (ids.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Aucun colis orphelin trouvé.'
      });
    }

    // ACTION PURGE : suppression définitive en cascade
    if (action === 'purge') {
      console.log(`[CLEANUP ORPHANS] Purge de ${ids.length} colis orphelins...`);

      // 1. Dépendances des colis
      await supabase.from('package_audit_logs').delete().in('package_id', ids);
      await supabase.from('financial_audits').delete().in('package_id', ids);
      await supabase.from('package_quotes').delete().in('package_id', ids);
      await supabase.from('driver_cash_deposits').delete().in('package_id', ids);
      await supabase.from('driver_cash_requests').delete().in('package_id', ids);
      await supabase.from('warehouse_stock_movements').delete().in('package_id', ids);

      // 2. Supprimer les colis
      const { error: delErr } = await supabase.from('packages').delete().in('id', ids);
      if (delErr) {
        console.error('[CLEANUP ORPHANS] Erreur suppression packages:', delErr);
        return NextResponse.json({ error: `Erreur lors de la suppression des colis : ${delErr.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        count: ids.length,
        message: `${ids.length} colis orphelins supprimés avec succès (historique et dépendances nettoyés).`
      });
    }

    // ACTION REASSIGN : assigner à une agence active
    if (action === 'reassign') {
      if (!targetAgencyId) {
        return NextResponse.json({ error: 'Identifiant agence cible requis pour la réassignation.' }, { status: 400 });
      }

      // Vérifier que l'agence existe
      const { data: targetAgency } = await supabase
        .from('agencies')
        .select('id, profile:profiles(name)')
        .eq('id', targetAgencyId)
        .maybeSingle();

      if (!targetAgency) {
        return NextResponse.json({ error: 'Agence cible introuvable.' }, { status: 404 });
      }

      const agencyName = (targetAgency as any)?.profile?.name || 'Agence';

      // Pour les colis livrés/annulés/retournés : conserver le statut
      const finishedStatuses = ['DELIVERED', 'CANCELLED', 'RETURNED'];
      const finishedIds = (orphanPackages || []).filter(p => finishedStatuses.includes(p.status)).map(p => p.id);
      const activeIds = (orphanPackages || []).filter(p => !finishedStatuses.includes(p.status)).map(p => p.id);

      if (finishedIds.length > 0) {
        await supabase
          .from('packages')
          .update({
            agency_id: targetAgencyId,
            assigned_agency_id: targetAgencyId,
          })
          .in('id', finishedIds);
      }

      if (activeIds.length > 0) {
        await supabase
          .from('packages')
          .update({
            agency_id: targetAgencyId,
            assigned_agency_id: targetAgencyId,
            status: 'PENDING_AGENCY',
            driver_id: null,
          })
          .in('id', activeIds);
      }

      return NextResponse.json({
        success: true,
        count: ids.length,
        message: `${ids.length} colis orphelins réassignés avec succès à ${agencyName}.`
      });
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/admin/packages/cleanup-orphans]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
