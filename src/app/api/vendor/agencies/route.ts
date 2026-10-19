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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Accès réservé aux vendeurs.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const commune = searchParams.get('commune') || '';
    const poids = parseFloat(searchParams.get('poids') || '1');

    // Récupérer toutes les agences APPROVED
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
      `)
      .eq('status', 'APPROVED');

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
        `)
        .eq('status', 'APPROVED');
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
  const result = agencies
    .map((ag: any) => {
      const profile = Array.isArray(ag.profile) ? ag.profile[0] : ag.profile;

      // Règle 1 : Vérification de la capacité en poids de l'agence
      // Si le colis du vendeur dépasse ce que l'agence a fixé, elle n'apparaît pas
      const maxWeight = ag.max_weight_kg ? parseFloat(ag.max_weight_kg) : 50;
      if (poids > maxWeight) {
        return null;
      }

      // Règle 2 : Vérification de la zone couverte
      const zones: string[] = ag.coverage_zones || [];
      const coversCommune = zones.length === 0 || zones.some((z: string) =>
        z.toLowerCase() === commune.toLowerCase()
      );
      if (!coversCommune) return null;

      // Calcul du tarif estimé pour ce colis
      const communePrices: { commune: string; price: number }[] = ag.commune_prices || [];
      const communeEntry = communePrices.find((cp: any) =>
        cp.commune?.toLowerCase() === commune.toLowerCase()
      );

      const pricePerKg = ag.price_per_kg || 0;
      const baseCommune = communeEntry?.price || 0;
      const weightCost = Math.round(poids * pricePerKg);
      let estimatedRaw = baseCommune + weightCost;

      // Règle 3 : Conversion FC -> USD si les tarifs sont en Francs Congolais (éviter les millions)
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
        coverageZones: zones,
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
