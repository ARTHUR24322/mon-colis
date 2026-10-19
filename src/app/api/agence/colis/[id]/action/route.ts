/**
 * POST /api/agence/colis/[id]/action
 * Body: { action: 'accept' | 'reject', reason?: string }
 *
 * Permet à l'agence connectée :
 * - d'accepter un colis (assigné à elle ou ouvert sans agence 'PENDING_AGENCY')
 * - de refuser un colis avec un motif obligatoire
 *
 * Conséquences :
 * - Audit log immuable dans package_audit_logs
 * - Notification automatique au vendeur
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
    if (!session || session.role !== 'agence') {
      return NextResponse.json({ error: 'Accès réservé aux agences.' }, { status: 403 });
    }

    const { id: packageId } = await params;
    const { action, reason } = await request.json();

    const targetAgencyId = session.agencyId || session.userId;

    if (!['accept', 'reject', 'assign_driver'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide ("accept", "reject" ou "assign_driver").' }, { status: 400 });
    }

    if (action === 'reject' && (!reason || !reason.trim())) {
      return NextResponse.json({ error: 'Un motif de refus est obligatoire.' }, { status: 400 });
    }

    // 1. Récupération du colis
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select('id, tracking_code, status, vendeur_id, agency_id, driver_id, client_commune')
      .eq('id', packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    // Récupérer le nom de l'agence
    const { data: agencyProfile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', targetAgencyId)
      .maybeSingle();
    const agencyName = agencyProfile?.name || session.name || 'L\'agence';

    // 2. Traitement ACCEPTATION
    if (action === 'accept') {
      // Un colis peut être accepté s'il est en PENDING_AGENCY (assigné à l'agence ou non assigné)
      if (pkg.status !== 'PENDING_AGENCY' && pkg.status !== 'CREATED') {
        return NextResponse.json({
          error: `Ce colis ne peut plus être accepté (statut actuel: ${pkg.status}).`
        }, { status: 400 });
      }

      // Si le colis était déjà assigné à une autre agence
      if (pkg.agency_id && pkg.agency_id !== targetAgencyId) {
        return NextResponse.json({
          error: 'Ce colis a été attribué à une autre agence.'
        }, { status: 403 });
      }

      const { error: updErr } = await supabaseAdmin
        .from('packages')
        .update({
          agency_id: targetAgencyId,
          status: 'ACCEPTED_BY_AGENCY',
          updated_at: new Date().toISOString(),
        })
        .eq('id', packageId);

      if (updErr) {
        console.error('[Agency Accept] Error:', updErr);
        return NextResponse.json({ error: 'Erreur lors de l\'acceptation du colis.' }, { status: 500 });
      }

      // Journal d'audit
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        action: 'AGENCY_ACCEPTED',
        actor_id: session.userId,
        actor_role: 'agence',
        actor_name: agencyName,
        details: `Colis accepté par l'agence ${agencyName}. Prêt pour dispatch ou collecte.`,
      });

      // Notification vendeur
      if (pkg.vendeur_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: pkg.vendeur_id,
          title: 'Colis accepté par l\'agence',
          message: `L'agence ${agencyName} a accepté la prise en charge de votre colis ${pkg.tracking_code || packageId.slice(0, 8)}.`,
          type: 'PACKAGE_STATUS',
          data: { package_id: packageId, status: 'ACCEPTED_BY_AGENCY' },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Colis accepté avec succès.',
      });
    }

    // 3. Traitement REFUS
    if (action === 'reject') {
      // Vérifier que le colis était bien proposé à cette agence
      if (pkg.agency_id !== session.userId && pkg.status !== 'PENDING_AGENCY') {
        return NextResponse.json({
          error: 'Ce colis ne vous est pas attribué.'
        }, { status: 400 });
      }

      const { error: updErr } = await supabaseAdmin
        .from('packages')
        .update({
          agency_id: null,
          status: 'REJECTED_BY_AGENCY',
          updated_at: new Date().toISOString(),
        })
        .eq('id', packageId);

      if (updErr) {
        console.error('[Agency Reject] Error:', updErr);
        return NextResponse.json({ error: 'Erreur lors du refus.' }, { status: 500 });
      }

      // Journal d'audit
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        action: 'AGENCY_REJECTED',
        actor_id: session.userId,
        actor_role: 'agence',
        actor_name: agencyName,
        details: `Colis décliné par l'agence ${agencyName}. Motif : ${reason.trim()}`,
      });

      // Notification vendeur
      if (pkg.vendeur_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: pkg.vendeur_id,
          title: 'Agence indisponible pour votre colis',
          message: `L'agence ${agencyName} a décliné la prise en charge de votre colis ${pkg.tracking_code || packageId.slice(0, 8)}. Motif : "${reason.trim()}". Veuillez sélectionner une autre agence.`,
          type: 'PACKAGE_STATUS',
          data: { package_id: packageId, status: 'REJECTED_BY_AGENCY', reason: reason.trim() },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Colis décliné. Le vendeur a été notifié pour réattribuer le colis.',
      });
    }

    // 4. Traitement ASSIGNATION LIVREUR
    if (action === 'assign_driver') {
      const { driverId } = await request.json().catch(() => ({}));
      if (!driverId) {
        return NextResponse.json({ error: 'Identifiant du livreur requis.' }, { status: 400 });
      }

      // Vérifier que le livreur appartient bien à cette agence
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('id, agency_id, profiles(name)')
        .eq('id', driverId)
        .eq('agency_id', targetAgencyId)
        .maybeSingle();

      if (!driver) {
        return NextResponse.json({ error: 'Livreur introuvable ou non affilié à votre agence.' }, { status: 400 });
      }

      const driverProfile = Array.isArray(driver.profiles) ? driver.profiles[0] : driver.profiles;
      const driverName = (driverProfile as { name?: string })?.name || 'Livreur';

      const { error: updErr } = await supabaseAdmin
        .from('packages')
        .update({
          driver_id: driverId,
          agency_id: targetAgencyId,
          status: 'ASSIGNED_TO_DRIVER',
          updated_at: new Date().toISOString(),
        })
        .eq('id', packageId);

      if (updErr) {
        console.error('[Agency Assign Driver] Error:', updErr);
        return NextResponse.json({ error: 'Erreur lors de l’assignation du livreur.' }, { status: 500 });
      }

      // Audit log
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        action: 'DRIVER_ASSIGNED',
        actor_id: session.userId,
        actor_role: 'agence',
        actor_name: agencyName,
        details: `Colis assigné au livreur ${driverName} par l'agence ${agencyName}.`,
      });

      // Notification livreur
      await supabaseAdmin.from('notifications').insert({
        user_id: driverId,
        title: 'Nouvelle course assignée',
        message: `Vous avez été assigné au colis ${pkg.tracking_code || packageId.slice(0, 8)} vers ${pkg.client_commune || 'Kinshasa'}.`,
        type: 'PACKAGE_STATUS',
        data: { package_id: packageId, status: 'ASSIGNED_TO_DRIVER' },
      });

      return NextResponse.json({
        success: true,
        message: `Colis assigné à ${driverName} avec succès.`,
        driverName,
      });
    }
  } catch (err) {
    console.error('[POST /api/agence/colis/[id]/action]', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
