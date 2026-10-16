/**
 * PATCH /api/agency/drivers/[id]/reset-pin
 * Body: { newPin: string (4 digits) }
 * Resets the PIN of a driver belonging to the logged-in agency.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  newPin: z
    .string()
    .length(4, 'Le code PIN doit contenir exactement 4 chiffres.')
    .regex(/^\d{4}$/, 'Le code PIN doit être numérique.'),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15 : params est une Promise, on doit l'await
    const { id: driverId } = await context.params;

    const session = await getSession();
    if (!session || session.role !== 'agence') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { newPin } = result.data;

    // Récupérer le driver pour vérifier qu'il existe
    const { data: driver, error: fetchErr } = await supabase
      .from('drivers')
      .select('id, agency_id')
      .eq('id', driverId)
      .single();

    if (fetchErr || !driver) {
      console.error('Driver not found:', driverId, fetchErr);
      return NextResponse.json({ error: 'Livreur introuvable.' }, { status: 404 });
    }

    // Vérifier que ce livreur appartient à cette agence
    const sessionAgencyId = session.agencyId || session.userId;
    if (driver.agency_id !== sessionAgencyId) {
      console.error('Agency mismatch:', {
        driverAgencyId: driver.agency_id,
        sessionAgencyId,
      });
      return NextResponse.json(
        { error: 'Accès non autorisé à ce livreur.' },
        { status: 403 }
      );
    }

    // Hasher et mettre à jour le PIN
    const hashedPin = await bcrypt.hash(newPin, 10);
    const { error: updateErr } = await supabase
      .from('drivers')
      .update({ pin_code: hashedPin })
      .eq('id', driverId);

    if (updateErr) {
      console.error('Error resetting PIN:', updateErr);
      return NextResponse.json(
        { error: 'Erreur lors de la réinitialisation du PIN.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, newPin });
  } catch (err) {
    console.error('[PATCH reset-pin]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
