/**
 * POST /api/vendor/packages/[id]/quote
 * Génère un devis pour un colis (ou retourne le devis actif s'il n'est pas encore expiré).
 *
 * GET /api/vendor/packages/[id]/quote
 * Récupère le devis actif.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { isSameCommune } from '@/utils/kinshasa';
import { enqueueNotificationForAgencyMembers } from '@/lib/notification-outbox';

const QUOTE_VALIDITY_HOURS = 24; // Le devis est valide 24 heures

/**
 * Calcule le prix de livraison estimé.
 * Logique : tarif par commune + (poids × tarif/kg) + (distance × tarif/km)
 */
function calculateDeliveryPrice(params: {
  communePrices: { commune: string; price: number }[];
  commune: string;
  poids: number;
  distance: number;
  pricePerKg: number;
  pricePerKm: number;
  tauxChange: number;
  deviseGrille?: string;
}): { totalUsd: number; totalFc: number; tarif_commune_usd: number; tarif_poids_usd: number; tarif_distance_usd: number } {
  const { communePrices, commune, poids, distance, pricePerKg, pricePerKm, tauxChange, deviseGrille } = params;

  const communeEntry = communePrices.find(cp =>
    isSameCommune(cp.commune, commune)
  );

  let rawCommune = communeEntry?.price || 0;
  if (!rawCommune || rawCommune <= 0) {
    const validPrices = communePrices.filter(cp => typeof cp.price === 'number' && cp.price > 0).map(cp => cp.price);
    if (validPrices.length > 0) {
      rawCommune = Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length);
    }
  }
  const rawPoids = Math.round(poids * pricePerKg);
  const rawDistance = Math.round(distance * pricePerKm);
  const rawTotal = rawCommune + rawPoids + rawDistance;

  // Si la grille est configurée en FC ou que les montants sont de l'ordre des FC (> 50)
  const isFC = deviseGrille === 'FC' || rawTotal > 50 || rawCommune > 50;

  if (isFC) {
    const rate = tauxChange > 0 ? tauxChange : 2800;
    const totalFc = rawTotal;
    const totalUsd = parseFloat((totalFc / rate).toFixed(2));
    const tarif_commune_usd = parseFloat((rawCommune / rate).toFixed(2));
    const tarif_poids_usd = parseFloat((rawPoids / rate).toFixed(2));
    const tarif_distance_usd = parseFloat((rawDistance / rate).toFixed(2));
    return { totalUsd, totalFc, tarif_commune_usd, tarif_poids_usd, tarif_distance_usd };
  } else {
    // Les tarifs étaient déjà saisis en USD
    const totalUsd = parseFloat(rawTotal.toFixed(2));
    const totalFc = Math.round(totalUsd * tauxChange);
    return {
      totalUsd,
      totalFc,
      tarif_commune_usd: rawCommune,
      tarif_poids_usd: rawPoids,
      tarif_distance_usd: rawDistance,
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Accès réservé aux vendeurs.' }, { status: 403 });
    }

    const { id: packageId } = await params;

    // Récupérer le devis actif (non expiré, non annulé)
    const { data: quote } = await supabaseAdmin
      .from('package_quotes')
      .select('*')
      .eq('package_id', packageId)
      .in('status', ['PENDING', 'ACCEPTED'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!quote) {
      return NextResponse.json({ quote: null });
    }

    // Vérification expiration
    if (quote.status === 'PENDING' && new Date(quote.valid_until) < new Date()) {
      await supabaseAdmin.from('package_quotes').update({ status: 'EXPIRED' }).eq('id', quote.id);
      return NextResponse.json({ quote: null, expired: true });
    }

    return NextResponse.json({ quote });
  } catch (err) {
    console.error('[GET /api/vendor/packages/[id]/quote]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

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
    const body = await request.json();
    const { action, distanceKm: passedDistance, agencyId: requestedAgencyId, quoteId } = body; // 'generate' ou 'accept'

    // Récupérer le colis avec ses infos actuelles vérifiées en base
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select(`
        id, status, vendeur_id, agency_id, client_commune, client_address,
        package_price, weight, delivery_mode, paid_by_client, is_prepaid,
        agency:agencies!agency_id(
          id, commune_prices, price_per_kg, price_per_km, taux_fc, max_weight_kg, devise_grille,
          profile:profiles!id(name)
        )
      `)
      .eq('id', packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    if (pkg.vendeur_id !== session.userId) {
      return NextResponse.json({ error: 'Ce colis ne vous appartient pas.' }, { status: 403 });
    }

    // Ces deux routes ne fonctionnent que si le colis est en cours de création ou en attente d'agence
    // (interdiction absolue de modifier un colis déjà pris en charge, livré ou en litige)
    const currentStatusNormalized = (pkg.status || '').toUpperCase();
    const forbiddenStatuses = [
      'ACCEPTED_BY_AGENCY', 'ACCEPTÉ', 'ASSIGNED_TO_DRIVER', 'IN_TRANSIT', 'EN TRANSIT',
      'DEPOSITED_AT_DROP_POINT', 'AVAILABLE_AT_PICKUP_POINT', 'WAITING_FOR_AGENCY_PICKUP',
      'REFUSED_BY_DROP_POINT', 'IN_DISPUTE', 'DELIVERED', 'LIVRÉ', 'CANCELLED', 'ANNULÉ'
    ];
    if (forbiddenStatuses.includes(currentStatusNormalized)) {
      return NextResponse.json({
        error: `Impossible de recalculer ou d'accepter le devis : le colis a déjà été pris en charge ou livré.`,
      }, { status: 400 });
    }

    // ── Générer un devis (Calculer / Recalculer) ──────────────────────────────
    if (action === 'generate') {
      const targetAgencyId = requestedAgencyId || pkg.agency_id;
      if (!targetAgencyId) {
        return NextResponse.json({
          error: "Veuillez d'abord choisir une agence pour calculer le devis.",
        }, { status: 400 });
      }

      // Expirer les anciens devis PENDING pour ce colis
      await supabaseAdmin
        .from('package_quotes')
        .update({ status: 'EXPIRED' })
        .eq('package_id', packageId)
        .eq('status', 'PENDING');

      // Récupérer le taux de change
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('exchange_rate')
        .eq('id', 'global')
        .maybeSingle();
      const tauxChange = settings?.exchange_rate || 2800;

      // Récupérer les tarifs de l'agence (soit depuis pkg.agency soit directement en base)
      let agencyRaw: any = null;
      if (pkg.agency_id === targetAgencyId && pkg.agency) {
        agencyRaw = Array.isArray(pkg.agency) ? pkg.agency[0] : pkg.agency;
      }
      if (!agencyRaw) {
        const { data: agData } = await supabaseAdmin
          .from('agencies')
          .select(`
            id, commune_prices, price_per_kg, price_per_km, taux_fc, max_weight_kg, devise_grille,
            profile:profiles!id(name)
          `)
          .eq('id', targetAgencyId)
          .maybeSingle();
        agencyRaw = agData;
      }

      const communePrices: { commune: string; price: number }[] = agencyRaw?.commune_prices || [];
      const pricePerKg = agencyRaw?.price_per_kg || 0;
      const pricePerKm = agencyRaw?.price_per_km || 0;
      const deviseGrille = agencyRaw?.devise_grille || 'FC';

      // Distance en km : reçue dans le body (calculée via OpenStreetMap) ou 0
      const distance = typeof passedDistance === 'number' && passedDistance > 0
        ? passedDistance
        : 0;

      const { totalUsd, tarif_commune_usd, tarif_poids_usd, tarif_distance_usd } = calculateDeliveryPrice({
        communePrices,
        commune: pkg.client_commune || '',
        poids: pkg.weight || 1,
        distance,
        pricePerKg,
        pricePerKm,
        tauxChange,
        deviseGrille,
      });

      const prixMarchandise = pkg.package_price || 0;
      const partMarchandise = pkg.is_prepaid ? 0 : prixMarchandise;
      const partLivraison = pkg.paid_by_client !== false ? totalUsd : 0;
      const montantEncaisser = partMarchandise + partLivraison;

      const validUntil = new Date(Date.now() + QUOTE_VALIDITY_HOURS * 60 * 60 * 1000).toISOString();

      const { data: quote, error: insertErr } = await supabaseAdmin
        .from('package_quotes')
        .insert({
          package_id: packageId,
          agency_id: targetAgencyId,
          prix_marchandise: prixMarchandise,
          frais_livraison: totalUsd,
          montant_encaisser: montantEncaisser,
          paid_by_client: pkg.paid_by_client !== false,
          devise: 'USD',
          taux_change: tauxChange,
          poids_kg: pkg.weight || 1,
          distance_km: distance,
          commune_destination: pkg.client_commune || '',
          tarif_commune: tarif_commune_usd,
          tarif_poids: tarif_poids_usd,
          status: 'PENDING',
          valid_until: validUntil,
        })
        .select()
        .single();

      if (insertErr || !quote) {
        console.error('[POST quote/generate]', insertErr);
        return NextResponse.json({ error: 'Erreur lors de la génération du devis.' }, { status: 500 });
      }

      // Calculer/recalculer le devis NE DOIT JAMAIS assigner l'agence ni changer le statut du colis en PENDING_AGENCY
      // Il met uniquement à jour le montant estimatif de livraison
      const { error: updatePkgErr } = await supabaseAdmin
        .from('packages')
        .update({
          delivery_price: totalUsd,
          updated_at: new Date().toISOString()
        })
        .eq('id', packageId)
        .in('status', ['CREATED', 'DRAFT', 'PENDING_AGENCY', 'QUOTE_PENDING']);

      if (updatePkgErr) {
        console.error('[POST quote/generate] pkg update error:', updatePkgErr);
      }

      const agencyProfile = Array.isArray(agencyRaw?.profile) ? agencyRaw?.profile[0] : agencyRaw?.profile;
      return NextResponse.json({
        quote: {
          ...quote,
          agencyName: agencyProfile?.name || 'Agence',
        },
        action: 'generated'
      });
    }

    // ── Accepter un devis ────────────────────────────────────────────────────
    if (action === 'accept') {
      let activeQuoteId = quoteId;
      if (!activeQuoteId) {
        const { data: latestPending } = await supabaseAdmin
          .from('package_quotes')
          .select('id')
          .eq('package_id', packageId)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        activeQuoteId = latestPending?.id;
      }

      if (!activeQuoteId) {
        return NextResponse.json({ error: 'Aucun devis en attente à accepter.' }, { status: 400 });
      }

      const { data: quote, error: quoteErr } = await supabaseAdmin
        .from('package_quotes')
        .select('*')
        .eq('id', activeQuoteId)
        .eq('package_id', packageId)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (quoteErr || !quote) {
        return NextResponse.json({ error: 'Devis introuvable ou déjà traité.' }, { status: 404 });
      }

      // Vérification expiration
      if (new Date(quote.valid_until) < new Date()) {
        await supabaseAdmin.from('package_quotes').update({ status: 'EXPIRED' }).eq('id', activeQuoteId);
        return NextResponse.json({ error: 'Ce devis a expiré. Veuillez en générer un nouveau.', expired: true }, { status: 410 });
      }

      const now = new Date().toISOString();

      // Figer le devis
      await supabaseAdmin
        .from('package_quotes')
        .update({ status: 'ACCEPTED', accepted_at: now, accepted_by: session.userId })
        .eq('id', activeQuoteId);

      // Calcul de l'agence et du statut cible : si agence assignée -> PENDING_AGENCY, sinon conserve CREATED
      const finalAgencyId = quote.agency_id || requestedAgencyId || pkg.agency_id || null;
      const targetStatus = finalAgencyId ? 'PENDING_AGENCY' : 'CREATED';

      // Mise à jour conditionnelle du colis : assignation officielle de l'agence et passage en PENDING_AGENCY
      const { data: updatedPackage, error: updateErr } = await supabaseAdmin
        .from('packages')
        .update({
          agency_id: finalAgencyId,
          quote_id: activeQuoteId,
          quote_accepted_at: now,
          delivery_price: quote.frais_livraison,
          status: targetStatus,
          updated_at: now,
        })
        .eq('id', packageId)
        .in('status', ['CREATED', 'DRAFT', 'PENDING_AGENCY', 'QUOTE_PENDING'])
        .select('id, status')
        .maybeSingle();

      if (updateErr || !updatedPackage) {
        return NextResponse.json({
          error: "Impossible d'accepter le devis : le colis a changé de statut en arrière-plan.",
        }, { status: 409 });
      }

      // Journal d'audit obligatoire
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        package_code: packageId.slice(0, 8).toUpperCase(),
        actor_id: session.userId,
        actor_name: session.name,
        actor_role: 'vendeur',
        from_status: pkg.status,
        to_status: targetStatus,
        action: 'VENDOR_ACCEPTED_QUOTE',
        reason: `Devis accepté — Agence: ${finalAgencyId || 'Aucune'}, Livraison: ${quote.frais_livraison} USD, Marchandise: ${quote.prix_marchandise} USD`,
        metadata: {
          quote_id: activeQuoteId,
          agency_id: finalAgencyId,
          frais_livraison: quote.frais_livraison,
          taux_change: quote.taux_change,
        },
      });

      // Notification à l'agence (UNIQUEMENT MAINTENANT que le vendeur a expressément accepté le devis)
      if (finalAgencyId) {
        await supabaseAdmin.from('notifications').insert({
          user_id: finalAgencyId,
          type: 'PACKAGE_ASSIGNED',
          message: `Nouveau colis à accepter (vendeur: ${session.name}) — MC-${packageId.slice(0, 8).toUpperCase()}`,
          is_read: false,
        });

        const ref = `MC-${packageId.slice(0, 8).toUpperCase()}`;
        enqueueNotificationForAgencyMembers({
          agencyId: finalAgencyId,
          eventType: 'NOUVEAU_COLIS_AGENCE',
          payload: { reference: ref, id: packageId },
          dedupeKey: `NOUVEAU_COLIS_AGENCE:${packageId}:quote-accept`,
        }).catch(err => console.error('[enqueueNotificationForAgencyMembers in quote/accept]', err));
      }

      return NextResponse.json({ success: true, quote: { ...quote, status: 'ACCEPTED', accepted_at: now }, action: 'accepted' });
    }

    return NextResponse.json({ error: 'Action invalide. Utilisez "generate" ou "accept".' }, { status: 400 });

  } catch (err) {
    console.error('[POST /api/vendor/packages/[id]/quote]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
