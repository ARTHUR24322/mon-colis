/**
 * PATCH /api/agency/settings
 * Body: {
 *   communePrices: { commune: string; price: number }[];
 *   pricePerKm: number;
 *   pricePerKg: number;
 *   tauxConversionFC?: number;   ← taux propre à l'agence, limité par system_settings.exchange_rate
 * }
 * Updates pricing settings for the logged-in agency.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

/**
 * GET /api/agency/settings
 * Retourne les tarifs de l'agence (commune_prices, price_per_km, price_per_kg, taux_fc, max_weight_kg, devise_grille).
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('agencies')
      .select('commune_prices, price_per_km, price_per_kg, taux_fc, max_weight_kg, devise_grille')
      .eq('id', session.agencyId)
      .single();

    if (error || !data) {
      // Si colonnes manquantes, on tente select minimal
      const fallback = await supabase
        .from('agencies')
        .select('commune_prices, price_per_km, price_per_kg, taux_fc')
        .eq('id', session.agencyId)
        .single();

      if (fallback.error || !fallback.data) {
        return NextResponse.json({ error: 'Agence introuvable.' }, { status: 404 });
      }

      return NextResponse.json({
        communePrices: fallback.data.commune_prices || [],
        pricePerKm: fallback.data.price_per_km || 0,
        pricePerKg: fallback.data.price_per_kg || 0,
        tauxConversionFC: fallback.data.taux_fc || null,
        maxWeightKg: 30,
        deviseGrille: 'FC',
      });
    }

    return NextResponse.json({
      communePrices: data.commune_prices || [],
      pricePerKm: data.price_per_km || 0,
      pricePerKg: data.price_per_kg || 0,
      tauxConversionFC: data.taux_fc || null,
      maxWeightKg: data.max_weight_kg ?? 30,
      deviseGrille: data.devise_grille || 'FC',
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/agency/settings:', e);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}

const settingsSchema = z.object({
  communePrices: z.array(
    z.object({
      commune: z.string(),
      price: z.number().min(0),
    })
  ),
  pricePerKm: z.number().min(0),
  pricePerKg: z.number().min(0),
  tauxConversionFC: z.number().min(1).optional(),
  maxWeightKg: z.number().min(0.5).optional(),
  deviseGrille: z.enum(['FC', 'USD']).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const result = settingsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { communePrices, pricePerKm, pricePerKg, tauxConversionFC, maxWeightKg, deviseGrille } = result.data;

    // Vérifier le plafond du super admin si un taux est fourni
    if (tauxConversionFC !== undefined) {
      const { data: sysSettings } = await supabase
        .from('system_settings')
        .select('exchange_rate')
        .eq('id', 'global')
        .single();

      const plafond: number = sysSettings?.exchange_rate ?? 2900;

      if (tauxConversionFC > plafond) {
        return NextResponse.json(
          { error: `Le taux ne peut pas dépasser le plafond fixé par l'administrateur (${plafond} FC).` },
          { status: 400 }
        );
      }
    }

    // Construire la mise à jour
    const updatePayload: Record<string, unknown> = {
      commune_prices: communePrices,
      price_per_km: pricePerKm,
      price_per_kg: pricePerKg,
    };
    if (tauxConversionFC !== undefined) {
      updatePayload.taux_fc = tauxConversionFC;
    }
    if (maxWeightKg !== undefined) {
      updatePayload.max_weight_kg = maxWeightKg;
    }
    if (deviseGrille !== undefined) {
      updatePayload.devise_grille = deviseGrille;
    }

    let { error } = await supabase
      .from('agencies')
      .update(updatePayload)
      .eq('id', session.agencyId);

    // Fallback si colonnes pas encore créées
    if (error && (error.message?.includes('max_weight_kg') || error.message?.includes('devise_grille'))) {
      delete updatePayload.max_weight_kg;
      delete updatePayload.devise_grille;
      const retry = await supabase
        .from('agencies')
        .update(updatePayload)
        .eq('id', session.agencyId);
      error = retry.error;
    }

    if (error) {
      console.error('Error updating agency settings:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour des paramètres.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Unexpected error in PATCH /api/agency/settings:', e);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}

