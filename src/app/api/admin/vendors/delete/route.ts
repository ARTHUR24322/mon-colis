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
    const { vendorId, securityCode } = body as { vendorId: string; securityCode?: string };

    if (!vendorId) {
      return NextResponse.json({ error: 'Identifiant vendeur manquant.' }, { status: 400 });
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

    // 3. Récupérer les informations du vendeur avant suppression
    const { data: vendorData } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('id', vendorId)
      .maybeSingle();

    const vendorName = vendorData?.name || vendorId;

    console.log(`[ADMIN DELETE VENDOR] Suppression définitive du vendeur: ${vendorName} (${vendorId})`);

    // 4. Nettoyage sécurisé en cascade des dépendances du vendeur
    // A. Récupérer et nettoyer tous les colis du vendeur et leurs sous-dépendances
    const { data: vendorPackages } = await supabaseAdmin
      .from('packages')
      .select('id')
      .eq('vendeur_id', vendorId);

    const pkgIds = (vendorPackages || []).map((p: any) => p.id).filter(Boolean);

    if (pkgIds.length > 0) {
      await supabaseAdmin.from('package_audit_logs').delete().in('package_id', pkgIds);
      await supabaseAdmin.from('financial_audits').delete().in('package_id', pkgIds);
      await supabaseAdmin.from('package_quotes').delete().in('package_id', pkgIds);
      await supabaseAdmin.from('driver_cash_deposits').delete().in('package_id', pkgIds);
      await supabaseAdmin.from('driver_cash_requests').delete().in('package_id', pkgIds);
      await supabaseAdmin.from('warehouse_stock_movements').delete().in('package_id', pkgIds);
      await supabaseAdmin.from('packages').delete().in('id', pkgIds);
    }
    // Filet de sécurité : supprimer tout colis restant avec ce vendeur_id
    await supabaseAdmin.from('packages').delete().eq('vendeur_id', vendorId);

    // B. Abonnements d'entrepôt, mouvements de stock et inventaire
    await supabaseAdmin.from('vendor_storage_subscriptions').delete().eq('vendor_id', vendorId);
    await supabaseAdmin.from('warehouse_stock_movements').delete().eq('vendor_id', vendorId);
    await supabaseAdmin.from('warehouse_inventory').delete().eq('vendor_id', vendorId);
    await supabaseAdmin.from('warehouse_inbound_batches').delete().eq('vendor_id', vendorId);

    // C. Demandes de versement et paiements
    await supabaseAdmin.from('vendor_payout_requests').delete().eq('vendor_id', vendorId);
    await supabaseAdmin.from('vendor_payment_requests').delete().eq('vendor_id', vendorId);
    await supabaseAdmin.from('payment_otps').delete().eq('vendor_id', vendorId);
    await supabaseAdmin.from('ledger_entries').delete().eq('vendor_id', vendorId);

    // D. Audits financiers, devis et logs de sécurité
    await supabaseAdmin.from('financial_audits').delete().or(`actor_id.eq.${vendorId},target_id.eq.${vendorId}`);
    await supabaseAdmin.from('package_quotes').delete().eq('vendeur_id', vendorId);
    await supabaseAdmin.from('notifications').delete().eq('user_id', vendorId);
    await supabaseAdmin.from('security_logs').delete().eq('actor_id', vendorId);

    // E. Table vendors (si présente dans la base)
    try {
      await supabaseAdmin.from('vendors').delete().eq('id', vendorId);
    } catch {
      // Silencieux si la table vendors n'existe pas
    }

    // F. Supprimer le profil vendeur dans profiles
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', vendorId);
    if (profileDeleteError) {
      console.error('[ADMIN DELETE VENDOR] Erreur suppression profiles:', profileDeleteError);
      return NextResponse.json({
        error: `Impossible de supprimer le profil vendeur : ${profileDeleteError.message}`
      }, { status: 400 });
    }

    // G. Supprimer le compte Supabase Auth
    try {
      await supabaseAdmin.auth.admin.deleteUser(vendorId);
    } catch (authErr) {
      console.warn('[ADMIN DELETE VENDOR] Impossible de supprimer le user auth:', authErr);
    }

    return NextResponse.json({
      success: true,
      message: `Le compte vendeur "${vendorName}" et toutes ses données associées ont été définitivement supprimés.`,
      vendorId
    });
  } catch (error: any) {
    console.error('[ADMIN DELETE VENDOR] Exception:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la suppression du vendeur' }, { status: 500 });
  }
}
