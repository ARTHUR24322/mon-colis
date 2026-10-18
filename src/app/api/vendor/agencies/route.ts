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
        profile:profiles!id(name, phone, email),
        fleet_size
      `)
      .eq('status', 'APPROVED');

    if (error) {
      console.error('[GET /api/vendor/agencies]', error);
      return NextResponse.json({ error: 'Erreur base de données.' }, { status: 500 });
    }

    const result = (agencies || [])
      .map((ag: any) => {
        const profile = Array.isArray(ag.profile) ? ag.profile[0] : ag.profile;

        // Vérification de la zone couverte
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
        const estimatedDeliveryPrice = baseCommune + weightCost;

        return {
          id: ag.id,
          name: profile?.name || 'Agence',
          phone: profile?.phone || '',
          email: profile?.email || '',
          coverageZones: zones,
          fleetSize: ag.fleet_size || 1,
          pricePerKg,
          pricePerKm: ag.price_per_km || 0,
          tauxFC: ag.taux_fc || 2800,
          estimatedDeliveryPrice,
          communePrices,
          // Métadonnées fictives (à remplacer par des vraies données si disponibles)
          rating: 4.2,
          avgDelay: '2-3h',
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.estimatedDeliveryPrice - b.estimatedDeliveryPrice); // tri par prix

    return NextResponse.json({ agencies: result });
  } catch (err) {
    console.error('[GET /api/vendor/agencies]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
