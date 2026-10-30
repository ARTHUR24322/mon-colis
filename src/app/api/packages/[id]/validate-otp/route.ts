/**
 * POST /api/packages/[id]/validate-otp
 * Body: { otp: string }
 * Valide le code OTP pour confirmer la récupération d'un colis (au point relais ou en livraison directe).
 * BLOQUE formellement le retrait si le colis est en litige / réclamation vendeur.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { supabase } from '@/utils/supabase/client';
import { getSession } from '@/lib/session-server';
import { logPackageAudit } from '@/lib/package-state-machine';
import { fulfillmentService } from '@/lib/fulfillment-service';
import { z } from 'zod';

const validateOtpSchema = z.object({
  otp: z.string().min(1, 'Le code OTP est requis.'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
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

    // 1. Vérification préalable du statut et de l'absence de réclamation
    const { data: pkg, error: fetchErr } = await supabase
      .from('packages')
      .select('id, status, claim_status, claim_reason, tracking_code, short_code, vendeur_id, driver_id, dest_drop_point_id')
      .eq('id', colisId)
      .maybeSingle();

    if (fetchErr || !pkg) {
      return NextResponse.json({ error: 'Colis introuvable.' }, { status: 404 });
    }

    if (pkg.status === 'IN_DISPUTE' || pkg.claim_status === 'OPEN') {
      return NextResponse.json(
        {
          error: `Retrait bloqué : ce colis fait l'objet d'une réclamation vendeur active ("${pkg.claim_reason || 'En cours de traitement'}"). Le retrait ne peut avoir lieu avant résolution par le Super Admin.`,
        },
        { status: 403 }
      );
    }

    if (pkg.status === 'DELIVERED') {
      return NextResponse.json(
        { error: 'Ce colis a déjà été livré/retiré (action idempotente).' },
        { status: 400 }
      );
    }

    // 2. Valider le code OTP via dataService
    const result = await dataService.validateDeliveryOtp(colisId, otp);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 2b. RÈGLE STRICTE FULFILLMENT : Décrémentation physique du stock UNIQUEMENT sur validation réussie de l'OTP
    try {
      await fulfillmentService.handleOtpValidationStockDeduction(colisId);
    } catch (stockErr) {
      console.warn('[validate-otp] Décrémentation stock fulfillment:', stockErr);
    }

    // 3. Journaliser dans package_audit_logs
    await logPackageAudit({
      packageId: colisId,
      packageCode: pkg.tracking_code || pkg.short_code,
      actorId: session?.userId || null,
      actorName: session?.name || 'Point Relais / Livreur',
      actorRole: session?.role || 'point_relais',
      fromStatus: pkg.status,
      toStatus: 'DELIVERED',
      action: 'VALIDATE_DELIVERY_OTP',
      reason: 'Validation du code OTP par le client final',
      metadata: { otp_validated: true },
    });

    // 4. Notifications automatiques
    const pkgCode = pkg.tracking_code || pkg.short_code || `#${colisId.slice(0, 8)}`;
    const promises: Promise<unknown>[] = [];

    if (pkg.driver_id) {
      promises.push(
        Promise.resolve(
          supabase.from('notifications').insert({
            user_id: pkg.driver_id,
            type: 'SUCCESS',
            message: `Le client a validé son retrait OTP pour le colis ${pkgCode}.`,
          })
        )
      );
    }

    if (pkg.vendeur_id) {
      promises.push(
        Promise.resolve(
          supabase.from('notifications').insert({
            user_id: pkg.vendeur_id,
            type: 'SUCCESS',
            message: `Votre colis ${pkgCode} a été récupéré avec succès par le client (code OTP validé).`,
          })
        )
      );
    }

    await Promise.allSettled(promises);

    return NextResponse.json({
      success: true,
      message: 'Code OTP validé avec succès. Colis délivré.',
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
