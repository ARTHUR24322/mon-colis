/**
 * GET /api/agency/notification-counts
 * Retourne les compteurs de badges pour chaque section de la navigation agence.
 * Utilisé pour afficher des badges rouges sur les items du menu.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence'
      ? (session.agencyId || session.userId)
      : req.nextUrl.searchParams.get('agencyId');

    if (!agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    // ── 1. Colis en attente d'acceptation ────────────────────────────────────
    const { count: pendingPackages } = await supabase
      .from('packages')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .in('status', ['PENDING_AGENCY', 'WAITING_FOR_AGENCY_PICKUP']);

    // ── 2. Bons de dépôt entrepôt en attente de réception ────────────────────
    const { count: pendingBatches } = await supabase
      .from('inbound_batches')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('status', 'PENDING');

    // ── 3. Abonnements espaces vendeurs en attente d'approbation ─────────────
    const { count: pendingSubscriptions } = await supabase
      .from('vendor_storage_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('status', 'PENDING');

    // ── 4. Versements livreurs en attente de validation ───────────────────────
    const { count: pendingVersements } = await supabase
      .from('driver_cash_deposits')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('status', 'PENDING');

    // ── 5. Colis prêts au picking (fulfillment) ──────────────────────────────
    const { count: readyPicking } = await supabase
      .from('warehouse_stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('type', 'DISPATCH')
      .not('package_id', 'is', null);

    // Parmi ces mouvements, combien ont un colis NON encore livré ?
    // (approximation : on retourne readyPicking si > 0)

    // ── 6. Notifications non lues ────────────────────────────────────────────
    const { count: unreadNotifs } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session?.userId || agencyId)
      .eq('read', false);

    return NextResponse.json({
      // Badge par section nav
      colis: (pendingPackages || 0),
      reception: (pendingBatches || 0),
      entrepot: (pendingSubscriptions || 0) + (readyPicking || 0),
      versements: (pendingVersements || 0),
      notifications: (unreadNotifs || 0),
      // Total global
      total: (pendingPackages || 0) + (pendingBatches || 0) + (pendingSubscriptions || 0) + (pendingVersements || 0) + (unreadNotifs || 0),
    });
  } catch (err: any) {
    console.error('[GET /api/agency/notification-counts]', err);
    return NextResponse.json({
      colis: 0, reception: 0, entrepot: 0, versements: 0, notifications: 0, total: 0
    });
  }
}
