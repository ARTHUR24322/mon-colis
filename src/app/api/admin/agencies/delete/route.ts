import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminSession, getAdvancedAdminPin } from '@/lib/adminSession';

export async function POST(request: NextRequest) {
  try {
    // 1. Seul un superadmin authentifié peut supprimer définitivement
    const admin = await requireAdminSession().catch(() => null);
    if (!admin) {
      return NextResponse.json({ error: 'Session administrateur requise.' }, { status: 401 });
    }
    if (admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Action réservée au Super Admin général.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      agencyId,
      securityCode,
      deletePackages = true,
      reassignToAgencyId
    } = body as {
      agencyId: string;
      securityCode?: string;
      deletePackages?: boolean;
      reassignToAgencyId?: string;
    };

    if (!agencyId) {
      return NextResponse.json({ error: 'Identifiant agence manquant.' }, { status: 400 });
    }

    // 2. Vérification du code ADVANCED_ADMIN_PIN — aucun code par défaut
    const correctPin = getAdvancedAdminPin();
    if (!correctPin) {
      return NextResponse.json(
        { error: 'ADVANCED_ADMIN_PIN non configuré sur le serveur. Contactez l\'administrateur système.' },
        { status: 500 }
      );
    }
    if (!securityCode || securityCode.trim() !== correctPin) {
      return NextResponse.json({ error: 'Code de sécurité incorrect.' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Récupérer les informations de l'agence avant suppression
    const { data: agencyData } = await supabaseAdmin
      .from('agencies')
      .select('id, profile:profiles(name, email)')
      .eq('id', agencyId)
      .maybeSingle();

    const agencyName = (agencyData as any)?.profile?.name || agencyId;

    console.log(`[ADMIN DELETE AGENCY] Suppression définitive de l'agence: ${agencyName} (${agencyId}), deletePackages=${deletePackages}`);

    // 4. Déterminer une agence de repli si la réassignation est demandée
    let fallbackAgencyId: string | null = null;
    if (!deletePackages) {
      if (reassignToAgencyId && reassignToAgencyId !== agencyId) {
        fallbackAgencyId = reassignToAgencyId;
      } else {
        const { data: otherAgencies } = await supabaseAdmin
          .from('agencies')
          .select('id')
          .neq('id', agencyId)
          .limit(1);
        fallbackAgencyId = otherAgencies?.[0]?.id || null;
      }
    }

    // 5. Récupérer tous les colis associés à cette agence
    const { data: agencyPackages } = await supabaseAdmin
      .from('packages')
      .select('id, status')
      .or(`agency_id.eq.${agencyId},assigned_agency_id.eq.${agencyId}`);

    const pkgIds = (agencyPackages || []).map(p => p.id);

    // A. Traitement des colis pour éviter tout orphelin
    if (pkgIds.length > 0) {
      if (deletePackages || !fallbackAgencyId) {
        // Suppression en cascade complète des colis de cette agence
        console.log(`[ADMIN DELETE AGENCY] Suppression de ${pkgIds.length} colis de l'agence pour éviter les orphelins.`);
        await supabaseAdmin.from('package_audit_logs').delete().in('package_id', pkgIds);
        await supabaseAdmin.from('financial_audits').delete().in('package_id', pkgIds);
        await supabaseAdmin.from('package_quotes').delete().in('package_id', pkgIds);
        await supabaseAdmin.from('driver_cash_deposits').delete().in('package_id', pkgIds);
        await supabaseAdmin.from('driver_cash_requests').delete().in('package_id', pkgIds);
        await supabaseAdmin.from('warehouse_stock_movements').delete().in('package_id', pkgIds);
        await supabaseAdmin.from('packages').delete().in('id', pkgIds);
      } else {
        // Réassignation propre à l'agence de repli
        console.log(`[ADMIN DELETE AGENCY] Réassignation de ${pkgIds.length} colis vers l'agence ${fallbackAgencyId}`);
        const finishedStatuses = ['DELIVERED', 'CANCELLED', 'RETURNED'];
        const finishedIds = (agencyPackages || []).filter(p => finishedStatuses.includes(p.status)).map(p => p.id);
        const activeIds = (agencyPackages || []).filter(p => !finishedStatuses.includes(p.status)).map(p => p.id);

        if (finishedIds.length > 0) {
          await supabaseAdmin
            .from('packages')
            .update({
              agency_id: fallbackAgencyId,
              assigned_agency_id: fallbackAgencyId,
            })
            .in('id', finishedIds);
        }

        if (activeIds.length > 0) {
          await supabaseAdmin
            .from('packages')
            .update({
              agency_id: fallbackAgencyId,
              assigned_agency_id: fallbackAgencyId,
              status: 'PENDING_AGENCY',
              driver_id: null,
            })
            .in('id', activeIds);
        }
      }
    }

    // B. Nettoyage des livreurs de l'agence
    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('agency_id', agencyId);

    const driverIds = (drivers || []).map(d => d.id);
    if (driverIds.length > 0) {
      await supabaseAdmin.from('driver_cash_deposits').delete().in('driver_id', driverIds);
      await supabaseAdmin.from('driver_cash_requests').delete().in('driver_id', driverIds);
      await supabaseAdmin.from('drivers').delete().eq('agency_id', agencyId);
      await supabaseAdmin.from('profiles').delete().in('id', driverIds).eq('role', 'livreur');
      for (const dId of driverIds) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(dId);
        } catch {
          // Silencieux
        }
      }
    }

    // C. Supprimer les sessions de caisse
    await supabaseAdmin.from('driver_cash_deposits').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('driver_cash_requests').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('agency_cash_sessions').delete().eq('agency_id', agencyId);

    // D. Supprimer les abonnements et mouvements entrepôt
    await supabaseAdmin.from('vendor_storage_subscriptions').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('warehouse_stock_movements').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('warehouse_inventory').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('warehouse_inbound_batches').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('agency_storage_spaces').delete().eq('agency_id', agencyId);

    // E. Supprimer paramètres, promos et membres d'équipe de l'agence
    await supabaseAdmin.from('agency_settings').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('agency_promo_codes').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('agency_members').delete().eq('agency_id', agencyId);

    // F. Points relais affiliés : réassigner ou détacher
    if (fallbackAgencyId) {
      await supabaseAdmin.from('drop_points').update({ agency_id: fallbackAgencyId }).eq('agency_id', agencyId);
    } else {
      await supabaseAdmin.from('drop_points').update({ agency_id: null }).eq('agency_id', agencyId);
    }

    // G. Supprimer les demandes de versement de l'agence
    await supabaseAdmin.from('vendor_payout_requests').delete().eq('agency_id', agencyId);

    // H. Supprimer l'entrée agence
    const { error: agencyDeleteError } = await supabaseAdmin.from('agencies').delete().eq('id', agencyId);
    if (agencyDeleteError) {
      console.error('[ADMIN DELETE AGENCY] Erreur lors de la suppression dans agencies:', agencyDeleteError);
    }

    // I. Supprimer le profil utilisateur associé
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', agencyId);
    if (profileDeleteError) {
      console.error('[ADMIN DELETE AGENCY] Erreur lors de la suppression dans profiles:', profileDeleteError);
    }

    // J. Supprimer le compte Supabase Auth
    try {
      await supabaseAdmin.auth.admin.deleteUser(agencyId);
    } catch (authErr) {
      console.warn('[ADMIN DELETE AGENCY] Impossible de supprimer le user auth:', authErr);
    }

    return NextResponse.json({
      success: true,
      message: `L'agence "${agencyName}" a été définitivement supprimée avec succès${deletePackages ? ' (colis associés supprimés pour éviter les orphelins)' : fallbackAgencyId ? ' (colis réassignés à l\'agence de repli)' : ''}.`
    });

  } catch (error: any) {
    console.error('[ADMIN DELETE AGENCY] Exception critique:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne du serveur lors de la suppression de l\'agence.' },
      { status: 500 }
    );
  }
}
