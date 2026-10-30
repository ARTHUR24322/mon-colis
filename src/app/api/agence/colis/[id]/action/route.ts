/**
 * POST /api/agence/colis/[id]/action
 * Body: { action: 'accept' | 'reject' | 'assign_driver', reason?: string, driverId?: string }
 *
 * Flux agence :
 *   accept       → statut ACCEPTED_BY_AGENCY + recalcul delivery_price avec distance réelle
 *   reject       → statut REJECTED_BY_AGENCY, notif vendeur
 *   assign_driver → statut ASSIGNED_TO_DRIVER, notif livreur
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { fulfillmentService } from '@/lib/fulfillment-service';

// ─────────────────────────────────────────────────────────────────────────────
// Calcul du prix de livraison
// ─────────────────────────────────────────────────────────────────────────────
function calcDeliveryPrice(params: {
  communePrices: { commune: string; price: number }[];
  commune: string;
  poids: number;
  distanceKm: number;
  pricePerKg: number;
  pricePerKm: number;
  tauxChange: number;
  deviseGrille?: string;
}): { totalUsd: number; totalFc: number } {
  const { communePrices, commune, poids, distanceKm, pricePerKg, pricePerKm, tauxChange, deviseGrille } = params;
  const entry = communePrices.find(
    (cp) => cp.commune?.toLowerCase() === commune?.toLowerCase()
  );
  const tarifCommune = entry?.price ?? 0;
  const tarifPoids = Math.round(poids * pricePerKg * 100) / 100;
  const tarifKm = Math.round(distanceKm * pricePerKm * 100) / 100;
  const rawTotal = Math.round((tarifCommune + tarifPoids + tarifKm) * 100) / 100;

  // Si la grille est en FC ou si le montant dépasse 50 (tarifs de Kinshasa en Francs Congolais)
  const isFC = deviseGrille === 'FC' || rawTotal > 50 || tarifCommune > 50;
  const rate = tauxChange > 0 ? tauxChange : 2400;

  if (isFC) {
    const totalUsd = parseFloat((rawTotal / rate).toFixed(2));
    return { totalUsd, totalFc: Math.round(rawTotal) };
  } else {
    const totalUsd = parseFloat(rawTotal.toFixed(2));
    const totalFc = Math.round(totalUsd * rate);
    return { totalUsd, totalFc };
  }
}

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

    // ── Lecture unique du body ────────────────────────────────────────────────
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }

    const { action, reason, driverId, distanceKm: passedDistance, idempotencyKey } = body as {
      action?: string;
      reason?: string;
      driverId?: string;
      distanceKm?: number;
      idempotencyKey?: string;
    };

    const targetAgencyId = session.agencyId || session.userId;

    if (!['accept', 'reject', 'assign_driver'].includes(action ?? '')) {
      return NextResponse.json(
        { error: 'Action invalide. Valeurs acceptées : "accept", "reject", "assign_driver".' },
        { status: 400 }
      );
    }

    if (action === 'reject' && (!reason || !reason.trim())) {
      return NextResponse.json({ error: 'Un motif de refus est obligatoire.' }, { status: 400 });
    }

    if (action === 'assign_driver' && !driverId) {
      return NextResponse.json({ error: 'Identifiant du livreur requis (driverId).' }, { status: 400 });
    }

    // ── Récupération du colis ─────────────────────────────────────────────────
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select('id, tracking_code, status, vendeur_id, agency_id, driver_id, client_commune, client_address, origin_drop_point_id, weight, distance_km, delivery_price, package_price, paid_by_client')
      .eq('id', packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    // Nom de l'agence pour les logs / notifications
    const { data: agencyProfile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', targetAgencyId)
      .maybeSingle();
    const agencyName = agencyProfile?.name || session.name || 'L\'agence';

    const now = new Date().toISOString();
    const trackingLabel = pkg.tracking_code || ('MC-' + packageId.slice(0, 8).toUpperCase());

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION : ACCEPTATION
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === 'accept') {
      const acceptableStatuses = ['PENDING_AGENCY', 'QUOTE_PENDING', 'CREATED', 'WAITING_FOR_AGENCY_PICKUP'];
      if (!acceptableStatuses.includes(pkg.status)) {
        return NextResponse.json(
          { error: `Ce colis ne peut plus être accepté (statut : ${pkg.status}).` },
          { status: 400 }
        );
      }

      if (pkg.agency_id && pkg.agency_id !== targetAgencyId) {
        return NextResponse.json(
          { error: 'Ce colis est attribué à une autre agence.' },
          { status: 403 }
        );
      }

      // ── Recalcul du prix de livraison avec les tarifs de l'agence + distance OSM ──
      const [agencyRes, sysRes] = await Promise.all([
        supabaseAdmin
          .from('agencies')
          .select('commune_prices, price_per_km, price_per_kg, address, devise_grille, taux_fc')
          .eq('id', targetAgencyId)
          .maybeSingle(),
        supabaseAdmin
          .from('system_settings')
          .select('exchange_rate')
          .eq('id', 'global')
          .maybeSingle(),
      ]);

      const agencyData = agencyRes.data;
      const systemRate = sysRes.data?.exchange_rate || 2400;
      const tauxChange = agencyData?.taux_fc || systemRate;

      let newDeliveryPrice: number | null = pkg.delivery_price ?? null;
      // Normalisation de sécurité : si delivery_price était corrompu en FC (> 50), convertir en USD
      if (newDeliveryPrice !== null && newDeliveryPrice > 50) {
        newDeliveryPrice = parseFloat((newDeliveryPrice / tauxChange).toFixed(2));
      }

      let realDistanceKm = (typeof passedDistance === 'number' && passedDistance > 0)
        ? passedDistance
        : (Number(pkg.distance_km) > 0 ? Number(pkg.distance_km) : 0);

      if (agencyData) {
        const communePrices: { commune: string; price: number }[] =
          agencyData.commune_prices || [];
        const pricePerKm = agencyData.price_per_km || 0;
        const pricePerKg = agencyData.price_per_kg || 0;
        const poids = pkg.weight || 1;

        // ── Calcul de la distance de secours si non transmise ──────────
        if (realDistanceKm <= 0) {
          try {
            const agencyAddress = (agencyData as { address?: string }).address
              || `Kinshasa, République Démocratique du Congo`;
            const clientDest = (pkg as { client_address?: string }).client_address
              ? `${(pkg as { client_address?: string }).client_address}, ${pkg.client_commune || ''}, Kinshasa`
              : `${pkg.client_commune || 'Kinshasa'}, Kinshasa`;

            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            const distRes = await fetch(
              `${baseUrl}/api/distance?from=${encodeURIComponent(agencyAddress)}&to=${encodeURIComponent(clientDest)}`
            );
            if (distRes.ok) {
              const distData = await distRes.json();
              if (distData.distanceKm && distData.distanceKm > 0) {
                realDistanceKm = distData.distanceKm;
              }
            }
          } catch (distErr) {
            console.warn('[Agency Accept] Distance OSM indisponible, distance = 0 km:', distErr);
          }
        }

        const calculated = calcDeliveryPrice({
          communePrices,
          commune: pkg.client_commune || '',
          poids,
          distanceKm: realDistanceKm,
          pricePerKg,
          pricePerKm,
          tauxChange,
          deviseGrille: agencyData.devise_grille || 'FC',
        });

        // N'appliquer le tarif recalculé que s'il est supérieur à 0 et que le colis n'avait pas déjà un prix validé non corrompu
        if (calculated.totalUsd > 0) {
          newDeliveryPrice = calculated.totalUsd;
        }
      }

      // Mise à jour du colis (+ distance si calculée)
      const updatePayload: Record<string, unknown> = {
        agency_id: targetAgencyId,
        status: 'ACCEPTED_BY_AGENCY',
        updated_at: now,
        ...(realDistanceKm > 0 ? { distance_km: realDistanceKm } : {}),
      };
      if (newDeliveryPrice !== null) {
        updatePayload.delivery_price = newDeliveryPrice;
      }

      const { error: updErr } = await supabaseAdmin
        .from('packages')
        .update(updatePayload)
        .eq('id', packageId);

      if (updErr) {
        console.error('[Agency Accept]', updErr);
        return NextResponse.json({ error: 'Erreur lors de l\'acceptation du colis.' }, { status: 500 });
      }

      // Valider le devis associé s'il est encore PENDING ou ACCEPTED
      const itemPrice = pkg.package_price || 0;
      const quoteMontantEncaisser = pkg.paid_by_client
        ? parseFloat((itemPrice + (newDeliveryPrice || 0)).toFixed(2))
        : itemPrice;

      await supabaseAdmin
        .from('package_quotes')
        .update({
          status: 'ACCEPTED',
          accepted_at: now,
          agency_id: targetAgencyId,
          distance_km: realDistanceKm,
          ...(newDeliveryPrice !== null ? {
            frais_livraison: newDeliveryPrice,
            montant_encaisser: quoteMontantEncaisser,
            devise: 'USD',
            taux_change: tauxChange,
          } : {}),
        })
        .eq('package_id', packageId)
        .in('status', ['PENDING', 'ACCEPTED']);

      // Audit
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        action: 'AGENCY_ACCEPTED',
        actor_id: session.userId,
        actor_role: 'agence',
        actor_name: agencyName,
        details: `Colis accepté par l'agence ${agencyName}. Frais recalculés : ${newDeliveryPrice ?? 'N/A'} USD.`,
      }).select().maybeSingle();

      // Notification vendeur
      if (pkg.vendeur_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: pkg.vendeur_id,
          title: 'Colis accepté par l\'agence',
          message: `L'agence ${agencyName} a accepté la prise en charge de votre colis ${trackingLabel}.`,
          type: 'PACKAGE_STATUS',
          data: { package_id: packageId, status: 'ACCEPTED_BY_AGENCY' },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Colis accepté avec succès.',
        deliveryPrice: newDeliveryPrice,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION : REFUS
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === 'reject') {
      if (
        pkg.agency_id &&
        pkg.agency_id !== targetAgencyId &&
        !['PENDING_AGENCY', 'QUOTE_PENDING', 'CREATED'].includes(pkg.status)
      ) {
        return NextResponse.json(
          { error: 'Ce colis ne vous est pas attribué.' },
          { status: 400 }
        );
      }

      await supabaseAdmin
        .from('packages')
        .update({ agency_id: null, status: 'REJECTED_BY_AGENCY', updated_at: now })
        .eq('id', packageId);

      await supabaseAdmin
        .from('package_quotes')
        .update({ status: 'CANCELLED' })
        .eq('package_id', packageId)
        .eq('status', 'PENDING');

      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        action: 'AGENCY_REJECTED',
        actor_id: session.userId,
        actor_role: 'agence',
        actor_name: agencyName,
        details: `Colis décliné par l'agence ${agencyName}. Motif : ${(reason as string).trim()}`,
      }).select().maybeSingle();

      if (pkg.vendeur_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: pkg.vendeur_id,
          title: 'Agence indisponible pour votre colis',
          message: `L'agence ${agencyName} a décliné la prise en charge de votre colis ${trackingLabel}. Motif : "${(reason as string).trim()}". Veuillez choisir une autre agence.`,
          type: 'PACKAGE_STATUS',
          data: { package_id: packageId, status: 'REJECTED_BY_AGENCY', reason: (reason as string).trim() },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Colis décliné. Le vendeur a été notifié pour réattribuer le colis.',
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION : ASSIGNATION / REMISE LIVREUR (Point d'entrée unifié et idempotent - Bug 2.3)
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === 'assign_driver') {
      const handoverResult = await fulfillmentService.executePackageHandover({
        packageId,
        driverId: driverId as string,
        agencyId: targetAgencyId,
        actorId: session.userId,
        actorName: agencyName,
        actorRole: 'agence',
        idempotencyKey: idempotencyKey || `assign-${packageId}-${driverId}`,
      });

      if (!handoverResult.success) {
        return NextResponse.json({ error: handoverResult.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: handoverResult.message || `Colis assigné avec succès.`,
        driverName: handoverResult.driver_name,
      });
    }

    return NextResponse.json({ error: 'Action non traitée.' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/agence/colis/[id]/action]', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}
