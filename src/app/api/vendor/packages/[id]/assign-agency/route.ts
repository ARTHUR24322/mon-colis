/**
 * POST /api/vendor/packages/[id]/assign-agency
 * Body: { agencyId: string | null }  — null = "laisser les agences se positionner"
 *
 * Règles :
 * - Le colis doit appartenir au vendeur connecté
 * - Le colis doit être au statut CREATED ou PENDING_AGENCY (pas encore pris en charge)
 * - Si agencyId fourni : passe en PENDING_AGENCY + notifie l'agence
 * - Si agencyId = null : passe en PENDING_AGENCY sans agence (visible de toutes les agences)
 * - Journalise dans package_audit_logs
 * - Si l'agence choisie est suspendue ou hors zone → erreur 400
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Accès réservé aux vendeurs.' }, { status: 403 });
    }

    const { id: packageId } = await params;
    const { agencyId } = await request.json();

    // 1. Vérification du colis
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select('id, status, vendeur_id, agency_id, client_commune, weight')
      .eq('id', packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    if (pkg.vendeur_id !== session.userId) {
      return NextResponse.json({ error: 'Ce colis ne vous appartient pas.' }, { status: 403 });
    }

    // BUG 3 : Le blocage ne s'applique que si une agence a déjà accepté le colis.
    // Sans agence ou tant qu'aucune agence n'a accepté, le choix et le changement d'agence sont libres.
    const forbiddenAfterAcceptance = [
      'ACCEPTED_BY_AGENCY', 'ACCEPTÉ', 'ASSIGNED_TO_DRIVER', 'IN_TRANSIT', 'EN TRANSIT',
      'DEPOSITED_AT_DROP_POINT', 'AVAILABLE_AT_PICKUP_POINT', 'DELIVERED', 'LIVRÉ', 'CANCELLED', 'ANNULÉ'
    ];
    if (pkg.agency_id && forbiddenAfterAcceptance.includes(String(pkg.status).toUpperCase())) {
      return NextResponse.json({
        error: "Impossible de changer d'agence : le colis a déjà été accepté ou pris en charge.",
      }, { status: 400 });
    }

    // 2. Si agencyId fourni, vérification de l'agence
    let agencyName = null;
    if (agencyId) {
      const { data: agency } = await supabaseAdmin
        .from('agencies')
        .select('id, status, coverage_zones, profile:profiles!id(name)')
        .eq('id', agencyId)
        .maybeSingle();

      if (!agency) {
        return NextResponse.json({ error: 'Agence introuvable.' }, { status: 404 });
      }

      if (agency.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Cette agence n\'est pas disponible (suspendue ou non approuvée).' }, { status: 400 });
      }

      // Vérification zone couverte
      const zones: string[] = agency.coverage_zones || [];
      const commune = pkg.client_commune || '';
      if (zones.length > 0 && !zones.some((z: string) => z.toLowerCase() === commune.toLowerCase())) {
        return NextResponse.json({
          error: `Cette agence ne couvre pas la commune "${commune}".`,
        }, { status: 400 });
      }

      const profile = Array.isArray(agency.profile) ? agency.profile[0] : agency.profile;
      agencyName = profile?.name || 'Agence';
    }

    const previousAgencyId = pkg.agency_id;

    // 3. Mise à jour du colis
    const { error: updateErr } = await supabaseAdmin
      .from('packages')
      .update({
        agency_id: agencyId || null,
        status: 'PENDING_AGENCY',
        updated_at: new Date().toISOString(),
      })
      .eq('id', packageId);

    if (updateErr) {
      console.error('[POST assign-agency] update error:', updateErr);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
    }

    // 4. Journal d'audit
    await supabaseAdmin.from('package_audit_logs').insert({
      package_id: packageId,
      package_code: pkg.id.slice(0, 8).toUpperCase(),
      actor_id: session.userId,
      actor_name: session.name,
      actor_role: 'vendeur',
      from_status: pkg.status,
      to_status: 'PENDING_AGENCY',
      action: agencyId ? 'VENDOR_ASSIGNED_AGENCY' : 'VENDOR_OPEN_TO_AGENCIES',
      reason: agencyId
        ? `Vendeur a choisi l'agence "${agencyName}"`
        : 'Vendeur a laissé le colis ouvert aux agences',
      metadata: {
        previous_agency_id: previousAgencyId || null,
        new_agency_id: agencyId || null,
      },
    });

    // 5. Notification à l'agence (si choisie)
    if (agencyId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: agencyId,
        type: 'PACKAGE_ASSIGNED',
        message: `Nouveau colis à accepter (vendeur: ${session.name}) — MC-${packageId.slice(0, 8).toUpperCase()}`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      agencyId: agencyId || null,
      agencyName: agencyName || null,
      status: 'PENDING_AGENCY',
    });
  } catch (err) {
    console.error('[POST /api/vendor/packages/[id]/assign-agency]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
