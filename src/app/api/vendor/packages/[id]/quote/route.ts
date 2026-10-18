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
}): { total: number; tarif_commune: number; tarif_poids: number } {
  const { communePrices, commune, poids, distance, pricePerKg, pricePerKm } = params;

  const communeEntry = communePrices.find(cp =>
    cp.commune?.toLowerCase() === commune?.toLowerCase()
  );

  const tarif_commune = communeEntry?.price || 0;
  const tarif_poids = Math.round(poids * pricePerKg);
  const tarif_distance = Math.round(distance * pricePerKm);
  const total = tarif_commune + tarif_poids + tarif_distance;

  return { total, tarif_commune, tarif_poids };
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
    const { action } = body; // 'generate' ou 'accept'

    // Récupérer le colis avec ses infos
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select(`
        id, status, vendeur_id, agency_id, client_commune,
        package_price, weight, delivery_mode, paid_by_client, is_prepaid,
        agency:agencies!agency_id(
          id, commune_prices, price_per_kg, price_per_km, taux_fc,
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

    // ── Générer un devis ─────────────────────────────────────────────────────
    if (action === 'generate') {
      // Expirer les anciens devis PENDING
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

      // Récupérer les tarifs de l'agence
      const agencyRaw = Array.isArray(pkg.agency) ? pkg.agency[0] : pkg.agency;
      const communePrices: { commune: string; price: number }[] = agencyRaw?.commune_prices || [];
      const pricePerKg = agencyRaw?.price_per_kg || 0;
      const pricePerKm = agencyRaw?.price_per_km || 0;

      const { total, tarif_commune, tarif_poids } = calculateDeliveryPrice({
        communePrices,
        commune: pkg.client_commune || '',
        poids: pkg.weight || 1,
        distance: 0, // distance réelle à calculer si disponible
        pricePerKg,
        pricePerKm,
      });

      const prixMarchandise = pkg.package_price || 0;
      const montantEncaisser = pkg.paid_by_client ? (prixMarchandise + (pkg.is_prepaid ? 0 : total)) : total;

      const validUntil = new Date(Date.now() + QUOTE_VALIDITY_HOURS * 60 * 60 * 1000).toISOString();

      const { data: quote, error: insertErr } = await supabaseAdmin
        .from('package_quotes')
        .insert({
          package_id: packageId,
          agency_id: pkg.agency_id || null,
          prix_marchandise: prixMarchandise,
          frais_livraison: total,
          montant_encaisser: montantEncaisser,
          paid_by_client: pkg.paid_by_client !== false,
          devise: 'USD',
          taux_change: tauxChange,
          poids_kg: pkg.weight || 1,
          distance_km: 0,
          commune_destination: pkg.client_commune || '',
          tarif_commune,
          tarif_poids,
          status: 'PENDING',
          valid_until: validUntil,
        })
        .select()
        .single();

      if (insertErr || !quote) {
        console.error('[POST quote/generate]', insertErr);
        return NextResponse.json({ error: 'Erreur lors de la génération du devis.' }, { status: 500 });
      }

      // Mettre le colis en statut QUOTE_PENDING
      await supabaseAdmin
        .from('packages')
        .update({ status: 'QUOTE_PENDING', updated_at: new Date().toISOString() })
        .eq('id', packageId);

      return NextResponse.json({ quote, action: 'generated' });
    }

    // ── Accepter un devis ────────────────────────────────────────────────────
    if (action === 'accept') {
      const { quoteId } = body;
      if (!quoteId) {
        return NextResponse.json({ error: 'quoteId manquant.' }, { status: 400 });
      }

      const { data: quote, error: quoteErr } = await supabaseAdmin
        .from('package_quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('package_id', packageId)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (quoteErr || !quote) {
        return NextResponse.json({ error: 'Devis introuvable ou déjà traité.' }, { status: 404 });
      }

      // Vérification expiration
      if (new Date(quote.valid_until) < new Date()) {
        await supabaseAdmin.from('package_quotes').update({ status: 'EXPIRED' }).eq('id', quoteId);
        return NextResponse.json({ error: 'Ce devis a expiré. Veuillez en générer un nouveau.', expired: true }, { status: 410 });
      }

      const now = new Date().toISOString();

      // Figer le devis
      await supabaseAdmin
        .from('package_quotes')
        .update({ status: 'ACCEPTED', accepted_at: now, accepted_by: session.userId })
        .eq('id', quoteId);

      // Mettre à jour le colis avec le devis accepté
      await supabaseAdmin
        .from('packages')
        .update({
          quote_id: quoteId,
          quote_accepted_at: now,
          delivery_price: quote.frais_livraison,
          status: pkg.agency_id ? 'PENDING_AGENCY' : 'CREATED',
          updated_at: now,
        })
        .eq('id', packageId);

      // Journal d'audit
      await supabaseAdmin.from('package_audit_logs').insert({
        package_id: packageId,
        package_code: packageId.slice(0, 8).toUpperCase(),
        actor_id: session.userId,
        actor_name: session.name,
        actor_role: 'vendeur',
        from_status: pkg.status,
        to_status: pkg.agency_id ? 'PENDING_AGENCY' : 'CREATED',
        action: 'VENDOR_ACCEPTED_QUOTE',
        reason: `Devis accepté — Livraison: ${quote.frais_livraison} USD, Marchandise: ${quote.prix_marchandise} USD`,
        metadata: {
          quote_id: quoteId,
          frais_livraison: quote.frais_livraison,
          taux_change: quote.taux_change,
        },
      });

      return NextResponse.json({ success: true, quote: { ...quote, status: 'ACCEPTED', accepted_at: now }, action: 'accepted' });
    }

    return NextResponse.json({ error: 'Action invalide. Utilisez "generate" ou "accept".' }, { status: 400 });

  } catch (err) {
    console.error('[POST /api/vendor/packages/[id]/quote]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
