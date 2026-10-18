/**
 * /api/drop-points/scan-handover
 *
 * GET: Vérifie un colis scanné par son QR code ou code de suivi / code de remise
 *      Params: code, dropPointId
 *
 * POST: Valide ou refuse la remise physique du colis par le vendeur
 *      Body: {
 *        packageId: string,
 *        dropPointId: string,
 *        agentId: string,
 *        agentName?: string,
 *        action: 'ACCEPT' | 'REFUSE',
 *        refusalReason?: string,
 *        notes?: string
 *      }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get('code')?.trim();
    const dropPointId = searchParams.get('dropPointId')?.trim();

    if (!rawCode || !dropPointId) {
      return NextResponse.json({ error: 'Code et identifiant du point relais requis.' }, { status: 400 });
    }

    // Le code peut être du JSON (provenant du QR code de remise), un UUID, un trackingCode ou un pickup_code
    let packageIdOrTracking = rawCode;
    try {
      if (rawCode.startsWith('{') && rawCode.endsWith('}')) {
        const parsed = JSON.parse(rawCode);
        packageIdOrTracking = parsed.packageId || parsed.trackingCode || rawCode;
      }
    } catch {
      // ce n'est pas du JSON, garder brut
    }

    // 1. Recherche du colis
    let query = supabaseAdmin
      .from('packages')
      .select(`
        id, tracking_code, status, pickup_code, package_price, weight,
        origin_drop_point_id, dest_drop_point_id, delivery_mode,
        paid_by_client, is_prepaid, client_name, client_phone, client_commune,
        vendeur_id, agency_id, quote_id, quote_accepted_at,
        quote:package_quotes!quote_id(
          id, status, prix_marchandise, frais_livraison, montant_encaisser, devise, valid_until
        ),
        vendeur:profiles!vendeur_id(name, phone)
      `);

    // Tester si c'est un UUID valide ou un tracking_code
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packageIdOrTracking);
    if (isUuid) {
      query = query.or(`id.eq.${packageIdOrTracking},quote_id.eq.${packageIdOrTracking}`);
    } else {
      query = query.or(`tracking_code.eq.${packageIdOrTracking},pickup_code.eq.${packageIdOrTracking}`);
    }

    const { data: pkgs, error: pkgErr } = await query.limit(1);

    if (pkgErr || !pkgs || pkgs.length === 0) {
      return NextResponse.json({
        found: false,
        error: 'Aucun colis trouvé avec ce code ou QR code.'
      }, { status: 404 });
    }

    const pkg = pkgs[0];

    // 2. Vérification d'attribution au point relais
    // Pour le premier kilomètre, origin_drop_point_id doit correspondre à ce relais
    const isOriginRelay = pkg.origin_drop_point_id === dropPointId;
    const isDestRelay = pkg.dest_drop_point_id === dropPointId;
    const isAssignedToThisRelay = isOriginRelay || isDestRelay;

    // 3. Vérification du devis
    const hasAcceptedQuote = Boolean(
      (pkg.quote && (pkg.quote as any).status === 'ACCEPTED') ||
      pkg.quote_accepted_at
    );

    // 4. Calcul du montant à encaisser (si paiement à la livraison COD)
    const quote = pkg.quote as any;
    const montantAEncaisser = quote?.montant_encaisser ?? (pkg.is_prepaid ? 0 : (pkg.package_price || 0));

    // 5. Statut actuel
    const canAcceptHandover = [
      'CREATED',
      'QUOTE_PENDING',
      'PENDING_AGENCY',
      'ACCEPTED_BY_AGENCY',
      'PENDING_DROP_POINT_CONFIRMATION',
      'WAITING_FOR_AGENCY_PICKUP'
    ].includes(pkg.status);

    const vendeurProfile = Array.isArray(pkg.vendeur) ? pkg.vendeur[0] : pkg.vendeur;

    return NextResponse.json({
      found: true,
      package: {
        id: pkg.id,
        trackingCode: pkg.tracking_code || `MC-${pkg.id.slice(0, 8).toUpperCase()}`,
        status: pkg.status,
        clientName: pkg.client_name,
        clientPhone: pkg.client_phone,
        clientCommune: pkg.client_commune,
        vendeurName: vendeurProfile?.name || 'Vendeur',
        vendeurPhone: vendeurProfile?.phone || '',
        weight: pkg.weight || 1,
        packagePrice: pkg.package_price,
        paidByClient: pkg.paid_by_client,
        isPrepaid: pkg.is_prepaid,
        deliveryMode: pkg.delivery_mode,
        montantAEncaisser,
        devise: quote?.devise || 'USD',
      },
      checks: {
        isAssignedToThisRelay,
        hasAcceptedQuote,
        canAcceptHandover,
        alreadyDeposited: pkg.status === 'DEPOSITED_AT_DROP_POINT' || pkg.status === 'WAITING_FOR_AGENCY_PICKUP',
      }
    });
  } catch (err) {
    console.error('[GET /api/drop-points/scan-handover]', err);
    return NextResponse.json({ error: 'Erreur interne de vérification.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      packageId,
      dropPointId,
      agentId,
      agentName = 'Agent Relais',
      action, // 'ACCEPT' ou 'REFUSE'
      refusalReason,
      notes
    } = body;

    if (!packageId || !dropPointId || !agentId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
    }

    // 1. Récupérer le colis et le point relais
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select('id, tracking_code, status, vendeur_id, origin_drop_point_id, quote_id, quote_accepted_at')
      .eq('id', packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    const { data: dp } = await supabaseAdmin
      .from('drop_points')
      .select('id, name, commune, credits')
      .eq('id', dropPointId)
      .maybeSingle();

    const dpName = dp?.name || 'Point Relais';

    // 2. Traitement ACCEPT
    if (action === 'ACCEPT') {
      // Déduire un crédit si disponible
      if (dp && typeof dp.credits === 'number' && dp.credits > 0) {
        await supabaseAdmin
          .from('drop_points')
          .update({ credits: dp.credits - 1 })
          .eq('id', dropPointId);
      }

      // Mettre à jour le statut du colis
      // Passe à WAITING_FOR_AGENCY_PICKUP ou DEPOSITED_AT_DROP_POINT
      const newStatus = 'WAITING_FOR_AGENCY_PICKUP';

      const { error: updErr } = await supabaseAdmin
        .from('packages')
        .update({
          status: newStatus,
          origin_drop_point_id: dropPointId,
          deposited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', packageId);

      if (updErr) {
        console.error('[Scan Handover Accept] Update error:', updErr);
        return NextResponse.json({ error: 'Erreur lors de la mise à jour du colis.' }, { status: 500 });
      }

      // Trace immuable dans package_audit_logs
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        action: 'DROP_POINT_HANDOVER_ACCEPTED',
        actor_id: agentId,
        actor_role: 'point_relais',
        actor_name: agentName,
        details: `Colis remis par le vendeur et accepté au Point Relais "${dpName}". Conformité vérifiée. En attente de collecte par l'agence.`,
      });

      // Notification automatique au vendeur
      if (pkg.vendeur_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: pkg.vendeur_id,
          title: 'Colis déposé au Point Relais',
          message: `Votre colis ${pkg.tracking_code || packageId.slice(0, 8)} a bien été pris en charge au Point Relais ${dpName}.`,
          type: 'PACKAGE_STATUS',
          data: { package_id: packageId, status: newStatus, drop_point_id: dropPointId },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Colis réceptionné avec succès au point relais ${dpName}.`,
        status: newStatus,
      });
    }

    // 3. Traitement REFUSE
    if (action === 'REFUSE') {
      if (!refusalReason || !refusalReason.trim()) {
        return NextResponse.json({ error: 'Le motif de refus est obligatoire.' }, { status: 400 });
      }

      const newStatus = 'REFUSED_BY_DROP_POINT';

      const { error: updErr } = await supabaseAdmin
        .from('packages')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', packageId);

      if (updErr) {
        console.error('[Scan Handover Refuse] Update error:', updErr);
        return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
      }

      // Trace immuable
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        action: 'DROP_POINT_HANDOVER_REFUSED',
        actor_id: agentId,
        actor_role: 'point_relais',
        actor_name: agentName,
        details: `Colis refusé au Point Relais "${dpName}". Motif : ${refusalReason.trim()}${notes ? ' - ' + notes.trim() : ''}`,
      });

      // Notification automatique au vendeur
      if (pkg.vendeur_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: pkg.vendeur_id,
          title: 'Colis refusé au Point Relais',
          message: `Votre colis ${pkg.tracking_code || packageId.slice(0, 8)} a été refusé au Point Relais ${dpName}. Motif : "${refusalReason.trim()}".`,
          type: 'PACKAGE_STATUS',
          data: { package_id: packageId, status: newStatus, reason: refusalReason.trim() },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Colis refusé. Le vendeur a été notifié du motif.',
        status: newStatus,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/drop-points/scan-handover]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
