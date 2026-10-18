/**
 * POST /api/drop-points/verify-qr
 * Body: { qrToken: string }
 * Vérifie l'authenticité et la validité active d'un QR code de point relais.
 * Rejette immédiatement tout ancien QR code révoqué ou falsifié.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

const verifySchema = z.object({
  qrToken: z.string().trim().min(5, 'Jeton QR requis.'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: 'Jeton QR manquant ou invalide.' }, { status: 400 });
    }

    const { qrToken } = parsed.data;

    // Rechercher le point relais avec ce qr_token ACTUEL et ACTIF
    const { data: dp, error } = await supabase
      .from('drop_points')
      .select('id, code, name, commune, address, phone, is_active, qr_token')
      .eq('qr_token', qrToken)
      .maybeSingle();

    if (error || !dp) {
      return NextResponse.json({
        valid: false,
        error: 'Ce QR code est invalide ou a été révoqué par le Super Admin suite à une régénération.',
      }, { status: 404 });
    }

    if (!dp.is_active) {
      return NextResponse.json({
        valid: false,
        error: `Le point relais "${dp.name}" est actuellement suspendu / désactivé.`,
      }, { status: 403 });
    }

    return NextResponse.json({
      valid: true,
      dropPoint: {
        id: dp.id,
        code: dp.code || dp.id,
        name: dp.name,
        commune: dp.commune,
        address: dp.address,
        phone: dp.phone,
      },
    });
  } catch (err: any) {
    console.error('[POST /api/drop-points/verify-qr]', err);
    return NextResponse.json({ valid: false, error: 'Erreur interne lors de la vérification.' }, { status: 500 });
  }
}
