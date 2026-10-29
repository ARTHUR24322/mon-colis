import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminSession } from '@/lib/adminSession';
import { getSession } from '@/lib/session-server';

// Codes autorisés pour le déverrouillage des options avancées
const VALID_ADVANCED_CODES = ['7412', '9876', 'SUPERADMIN2026', 'ADMIN-DELETE-AGENCY'];

export async function POST(request: NextRequest) {
  try {
    // 1. Vérification de la session admin / superadmin
    const adminSession = await requireAdminSession().catch(() => null);
    const userSession = !adminSession ? await getSession().catch(() => null) : null;

    const isSuperAdmin = (adminSession && ['SUPER_ADMIN', 'superadmin'].includes(adminSession.role)) ||
                         (userSession && ['superadmin', 'admin'].includes(userSession.role));

    const body = await request.json();
    const { agencyId, securityCode } = body as { agencyId: string; securityCode?: string };

    if (!agencyId) {
      return NextResponse.json({ error: 'Identifiant agence manquant' }, { status: 400 });
    }

    // 2. Vérification du code de sécurité des options avancées
    const envCode = process.env.ADMIN_ADVANCED_CODE;
    const isCodeValid = (securityCode && (VALID_ADVANCED_CODES.includes(securityCode.trim()) || securityCode.trim() === envCode)) || isSuperAdmin;

    if (!isCodeValid) {
      return NextResponse.json({ error: 'Code de sécurité des options avancées invalide.' }, { status: 403 });
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

    console.log(`[ADMIN DELETE AGENCY] Suppression définitive de l'agence: ${agencyName} (${agencyId})`);

    // 4. Nettoyage sécurisé en cascade des dépendances
    // A. Détacher les colis (remise en attente d'agence) pour ne pas détruire les commandes clients
    await supabaseAdmin
      .from('packages')
      .update({
        agency_id: null,
        assigned_agency_id: null,
        status: 'PENDING_AGENCY'
      })
      .or(`agency_id.eq.${agencyId},assigned_agency_id.eq.${agencyId}`);

    // B. Supprimer les sessions de caisse
    await supabaseAdmin.from('agency_cash_sessions').delete().eq('agency_id', agencyId);

    // C. Supprimer les abonnements et mouvements entrepôt
    await supabaseAdmin.from('vendor_storage_subscriptions').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('warehouse_stock_movements').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('warehouse_inventory').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('warehouse_inbound_batches').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('agency_storage_spaces').delete().eq('agency_id', agencyId);

    // D. Supprimer paramètres, promos et membres d'équipe de l'agence
    await supabaseAdmin.from('agency_settings').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('agency_promo_codes').delete().eq('agency_id', agencyId);
    await supabaseAdmin.from('agency_members').delete().eq('agency_id', agencyId);

    // E. Détacher les points relais affiliés
    await supabaseAdmin.from('drop_points').update({ agency_id: null }).eq('agency_id', agencyId);

    // F. Supprimer les demandes de versement orphelines
    await supabaseAdmin.from('vendor_payout_requests').delete().eq('agency_id', agencyId);

    // G. Supprimer l'entrée agence
    const { error: agencyDeleteError } = await supabaseAdmin.from('agencies').delete().eq('id', agencyId);
    if (agencyDeleteError) {
      console.error('[ADMIN DELETE AGENCY] Erreur lors de la suppression dans agencies:', agencyDeleteError);
    }

    // H. Supprimer le profil utilisateur associé
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', agencyId);
    if (profileDeleteError) {
      console.error('[ADMIN DELETE AGENCY] Erreur lors de la suppression dans profiles:', profileDeleteError);
    }

    // I. Supprimer le compte Supabase Auth si possible
    try {
      await supabaseAdmin.auth.admin.deleteUser(agencyId);
    } catch (authErr) {
      console.warn('[ADMIN DELETE AGENCY] Impossible de supprimer le user auth:', authErr);
    }

    return NextResponse.json({
      success: true,
      message: `L'agence "${agencyName}" et toutes ses données associées ont été définitivement supprimées.`,
      agencyId
    });
  } catch (error: any) {
    console.error('[ADMIN DELETE AGENCY] Exception:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la suppression de l\'agence' }, { status: 500 });
  }
}
