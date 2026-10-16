/**
 * POST /api/packages/[id]/validate-otp
 * Body: { otp: string }
 * Valide le code OTP pour confirmer la récupération d'un colis au point relais.
 * Migré de Prisma → Supabase + dataService
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

const validateOtpSchema = z.object({
  otp: z.string().min(1, 'Le code OTP est requis.'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: colisId } = await params;
    const body = await request.json();
    const resultZod = validateOtpSchema.safeParse(body);

    if (!colisId || !resultZod.success) {
      return NextResponse.json(
        { error: 'colisId et otp sont requis.' },
        { status: 400 }
      );
    }
    const { otp } = resultZod.data;

    // Valider le code OTP via dataService (qui gère la logique en DB)
    const result = await dataService.validateDeliveryOtp(colisId, otp);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Récupérer le colis mis à jour pour les notifications
    const { data: pkg } = await supabase
      .from('packages')
      .select('tracking_code, vendeur_id, driver_id, dest_drop_point_id')
      .eq('id', colisId)
      .maybeSingle();

    if (pkg) {
      const promises: Promise<unknown>[] = [];

      // Notifier le livreur
      if (pkg.driver_id) {
        promises.push(
          Promise.resolve(
            supabase.from('notifications').insert({
              user_id: pkg.driver_id,
              type: 'SUCCESS',
              message: `Le client a récupéré le colis (${pkg.tracking_code}) au point relais. Livraison terminée.`,
            })
          )
        );
      }

      // Notifier le vendeur
      if (pkg.vendeur_id) {
        promises.push(
          Promise.resolve(
            supabase.from('notifications').insert({
              user_id: pkg.vendeur_id,
              type: 'SUCCESS',
              message: `Votre colis (${pkg.tracking_code}) a été récupéré avec succès par le client au point relais.`,
            })
          )
        );
      }

      await Promise.allSettled(promises);
    }

    return NextResponse.json({
      success: true,
      message: 'OTP validé. Colis récupéré avec succès.',
      package: result.package,
    });
  } catch (err) {
    console.error('[POST /api/packages/[id]/validate-otp]', err);
    return NextResponse.json(
      { error: 'Erreur interne lors de la validation.' },
      { status: 500 }
    );
  }
}
