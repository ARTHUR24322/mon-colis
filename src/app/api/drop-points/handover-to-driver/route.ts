import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { getSession } from '@/lib/session-server';

/**
 * POST /api/drop-points/handover-to-driver
 *
 * Remise sécurisée d'un colis déposé au relais à un livreur (Circuit A).
 * RÈGLE STRICTE :
 * Le serveur vérifie que le livreur appartient bien à l'agence choisie par le vendeur pour ce colis.
 * Si le livreur appartient à une autre agence → Refus immédiat avec message "Mauvaise agence".
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    // Peut être appelé par un point relais connecté ou un agent avec identifiant
    const body = await request.json();
    const { packageId, dropPointId, driverIdentifier, agentId, agentName } = body;

    if (!packageId || !dropPointId || !driverIdentifier) {
      return NextResponse.json({ error: 'Identifiant du colis, point relais et livreur requis.' }, { status: 400 });
    }

    // 1. Récupérer le colis
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select(`
        id, tracking_code, status, vendeur_id, agency_id, origin_drop_point_id,
        agency:agencies!agency_id(
          id, profile:profiles!id(name)
        )
      `)
      .eq('id', packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    if (pkg.origin_drop_point_id !== dropPointId) {
      return NextResponse.json({ error: 'Ce colis n’est pas stocké dans ce point relais.' }, { status: 400 });
    }

    if (pkg.status !== 'WAITING_FOR_AGENCY_PICKUP' && pkg.status !== 'ACCEPTED_BY_AGENCY' && pkg.status !== 'ASSIGNED_TO_DRIVER') {
      return NextResponse.json({
        error: `Le colis ne peut pas être remis au livreur (statut actuel : ${pkg.status}).`
      }, { status: 400 });
    }

    if (!pkg.agency_id) {
      return NextResponse.json({
        error: 'Aucune agence n’est attribuée à ce colis. Remise impossible.'
      }, { status: 400 });
    }

    // 2. Identifier le livreur (par QR token, id ou téléphone)
    const cleanIdentifier = String(driverIdentifier).trim();
    let queryDriver = supabaseAdmin
      .from('drivers')
      .select(`
        id, agency_id, phone, available,
        profile:profiles!id(name),
        agency:agencies!agency_id(
          id, profile:profiles!id(name)
        )
      `);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdentifier);
    if (isUuid) {
      queryDriver = queryDriver.eq('id', cleanIdentifier);
    } else {
      queryDriver = queryDriver.or(`phone.eq.${cleanIdentifier}`);
    }

    const { data: driverData, error: driverErr } = await queryDriver.maybeSingle();

    if (driverErr || !driverData) {
      return NextResponse.json({
        error: 'Livreur introuvable ou non reconnu. Scannez un QR livreur valide.',
        code: 'DRIVER_NOT_FOUND'
      }, { status: 404 });
    }

    const assignedAgencyProfile = Array.isArray(pkg.agency) ? pkg.agency[0] : pkg.agency;
    const assignedAgencyName = (assignedAgencyProfile as any)?.profile?.name || 'Agence assignée';

    const driverAgencyProfile = Array.isArray(driverData.agency) ? driverData.agency[0] : driverData.agency;
    const driverAgencyName = (driverAgencyProfile as any)?.profile?.name || 'Autre agence';

    const driverProfile = Array.isArray(driverData.profile) ? driverData.profile[0] : driverData.profile;
    const driverName = (driverProfile as any)?.name || 'Livreur';
    const driverPhone = driverData.phone || '';

    // 3. VÉRIFICATION STRICTE DE L'AGENCE
    if (driverData.agency_id !== pkg.agency_id) {
      return NextResponse.json({
        error: `Remise refusée (Mauvaise agence) : ce colis a été confié à l'agence "${assignedAgencyName}". Ce livreur appartient à "${driverAgencyName}". Remise strictement interdite.`,
        code: 'WRONG_AGENCY',
        assignedAgencyName,
        driverAgencyName,
      }, { status: 403 });
    }

    // 4. Validation de la remise → Changement de statut vers IN_TRANSIT
    const now = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from('packages')
      .update({
        status: 'IN_TRANSIT',
        driver_id: driverData.id,
        picked_up_at: now,
        updated_at: now,
      })
      .eq('id', packageId);

    if (updErr) {
      console.error('[Handover to Driver] Update error:', updErr);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour de la remise.' }, { status: 500 });
    }

    // 5. Journal d'audit immuable
    const actualAgentName = agentName || session?.name || 'Agent Point Relais';
    const actualAgentId = agentId || session?.userId || null;

    await supabaseAdmin.from('package_audit_logs').insert({
      package_id: packageId,
      package_code: pkg.tracking_code || packageId.slice(0, 8).toUpperCase(),
      action: 'DROP_POINT_HANDOVER_TO_DRIVER',
      actor_id: actualAgentId,
      actor_name: actualAgentName,
      actor_role: 'point_relais',
      from_status: pkg.status,
      to_status: 'IN_TRANSIT',
      details: `Colis remis au livreur ${driverName} (${driverAgencyName}). Conformité de l’agence validée par le point relais.`,
      metadata: {
        driverId: driverData.id,
        driverName,
        agencyId: pkg.agency_id,
        agencyName: assignedAgencyName,
      }
    });

    // 6. Notification au vendeur
    if (pkg.vendeur_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: pkg.vendeur_id,
        title: 'Colis récupéré par le livreur',
        message: `Votre colis ${pkg.tracking_code || packageId.slice(0, 8)} a été collecté au point relais par ${driverName} (${assignedAgencyName}) et est en cours d'acheminement.`,
        type: 'PACKAGE_STATUS',
        data: { package_id: packageId, status: 'IN_TRANSIT' }
      });
    }

    // 7. Notification au livreur
    await supabaseAdmin.from('notifications').insert({
      user_id: driverData.id,
      title: 'Colis collecté au point relais',
      message: `Prise en charge confirmée pour le colis ${pkg.tracking_code || packageId.slice(0, 8)}. En route pour la livraison.`,
      type: 'PACKAGE_STATUS',
      data: { package_id: packageId, status: 'IN_TRANSIT' }
    });

    return NextResponse.json({
      success: true,
      message: `Colis confié à ${driverName} (${assignedAgencyName}) avec succès.`,
      driverName,
      driverPhone,
      agencyName: assignedAgencyName,
      status: 'IN_TRANSIT',
    });

  } catch (err) {
    console.error('[POST /api/drop-points/handover-to-driver]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
