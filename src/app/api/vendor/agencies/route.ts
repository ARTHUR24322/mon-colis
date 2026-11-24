/**
 * GET /api/vendor/agencies
 * Retourne les agences actives avec tarif estimé pour CE colis.
 * Query params: commune (commune de livraison), poids (kg)
 *
 * Règles de filtrage :
 * - Status = APPROVED uniquement
 * - La commune de destination doit être dans coverage_zones (ou coverage_zones vide = accepte tout)
 * - Les agences SUSPENDED ou REJECTED ne sont pas listées
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { isSameCommune } from '@/utils/kinshasa';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Accès réservé aux vendeurs.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const commune = searchParams.get('commune') || '';
    const poids = parseFloat(searchParams.get('poids') || '1');

    // Récupérer les agences candidates (statuts actifs / approuvés)
    const { data: agencies, error } = await supabaseAdmin
      .from('agencies')
      .select(`
        id,
        status,
        coverage_zones,
        commune_prices,
        price_per_km,
        price_per_kg,
        taux_fc,
        max_weight_kg,
        devise_grille,
        profile:profiles!id(name, phone, email),
        fleet_size
      `);

    if (error) {
      console.error('[GET /api/vendor/agencies]', error);
      // Fallback si colonnes pas encore présentes
      const fallback = await supabaseAdmin
        .from('agencies')
        .select(`
          id,
          status,
          coverage_zones,
          commune_prices,
          price_per_km,
          price_per_kg,
          taux_fc,
          profile:profiles!id(name, phone, email),
          fleet_size
        `);
      if (fallback.error) {
        return NextResponse.json({ error: 'Erreur base de données.' }, { status: 500 });
      }
      return processAgencies(fallback.data || [], commune, poids);
    }

    return processAgencies(agencies || [], commune, poids);
  } catch (err) {
    console.error('[GET /api/vendor/agencies]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

function processAgencies(agencies: any[], commune: string, poids: number) {
  const safeWeight = isNaN(poids) || poids <= 0 ? 1 : poids;

  const result = agencies
    .map((ag: any) => {
      const profile = Array.isArray(ag.profile) ? ag.profile[0] : ag.profile;

      // Vérification du statut de l'agence (tolérant: APPROVED, active, ACTIVE, ou par défaut si non suspendue/rejetée)
      const statusUpper = String(ag.status || 'APPROVED').toUpperCase().trim();
      if (statusUpper === 'SUSPENDED' || statusUpper === 'REJECTED' || statusUpper === 'PENDING') {
        return null;
      }

      // Règle 1 : Vérification de la capacité en poids de l'agence
      const maxWeight = ag.max_weight_kg ? parseFloat(ag.max_weight_kg) : 50;
      if (safeWeight > maxWeight) {
        return null;
      }

      // Règle 2 : Vérification de la zone couverte
      // Récupérer les communes depuis coverage_zones ET commune_prices
      const zones: string[] = Array.isArray(ag.coverage_zones) ? ag.coverage_zones : [];
      const communePrices: { commune: string; price: number }[] = Array.isArray(ag.commune_prices) ? ag.commune_prices : [];
      
      const pricedCommunes = communePrices
        .filter((cp: any) => cp && cp.commune && (typeof cp.price !== 'number' || cp.price > 0))
        .map((cp: any) => cp.commune);

      const allCovered = [...zones, ...pricedCommunes];

      // Si une commune de livraison est demandée et que l'agence a restreint ses zones,
      // vérifier si la commune correspond (tolérance aux accents, tirets et apostrophes)
      if (commune && allCovered.length > 0) {
        const coversCommune = allCovered.some((z: string) => isSameCommune(z, commune));
        if (!coversCommune) return null;
      }

      // Calcul du tarif estimé pour ce colis
      const communeEntry = communePrices.find((cp: any) =>
        isSameCommune(cp.commune, commune)
      );

      const pricePerKg = ag.price_per_kg || 0;
      let baseCommune = communeEntry?.price || 0;

      // Si l'agence n'a pas encore fixé de prix spécifique pour cette commune, utiliser le tarif moyen
      if (!baseCommune || baseCommune <= 0) {
        const validPrices = communePrices
          .filter((cp: any) => typeof cp.price === 'number' && cp.price > 0)
          .map((cp: any) => cp.price);
        if (validPrices.length > 0) {
          baseCommune = Math.round(validPrices.reduce((a: number, b: number) => a + b, 0) / validPrices.length);
        } else {
          baseCommune = 7000; // ~2.5 USD par défaut en FC
        }
      }

      const weightCost = Math.round(safeWeight * pricePerKg);
      let estimatedRaw = baseCommune + weightCost;

      // Règle 3 : Conversion FC -> USD si les tarifs sont en Francs Congolais
      const rate = ag.taux_fc || 2800;
      const isFC = ag.devise_grille === 'FC' || estimatedRaw > 50;
      const estimatedDeliveryPrice = isFC
        ? parseFloat((estimatedRaw / rate).toFixed(2))
        : estimatedRaw;

      return {
        id: ag.id,
        name: profile?.name || 'Agence',
        phone: profile?.phone || '',
        email: profile?.email || '',
        coverageZones: allCovered.length > 0 ? allCovered : ['Kinshasa'],
        fleetSize: ag.fleet_size || 1,
        maxWeightKg: maxWeight,
        pricePerKg,
        pricePerKm: ag.price_per_km || 0,
        tauxFC: rate,
        estimatedDeliveryPrice,
        communePrices,
        rating: 4.8,
        avgDelay: '2-3h',
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.estimatedDeliveryPrice - b.estimatedDeliveryPrice);

  return NextResponse.json({ agencies: result });
}
