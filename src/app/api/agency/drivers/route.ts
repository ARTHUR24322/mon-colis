/**
 * POST /api/agency/drivers
 * Body: { name, phone, vehicle, pinCode }
 * Creates a new driver associated with the logged-in agency.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const driverSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  phone: z.string().min(6, 'Le numéro de téléphone est requis.'),
  vehicle: z.string().optional(),
  pinCode: z.string().length(4, 'Le code PIN doit contenir exactement 4 chiffres.'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const result = driverSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, phone, vehicle, pinCode } = result.data;
    const hashedPin = await bcrypt.hash(pinCode, 10);

    // 1. Créer d'abord le profil (le nom est dans profiles, pas dans drivers)
    const newId = crypto.randomUUID();
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newId,
        role: 'livreur',
        name,
        phone,
      });

    if (profileError) {
      console.error('Error inserting driver profile:', profileError);
      return NextResponse.json({ error: 'Erreur lors de la création du profil livreur.' }, { status: 500 });
    }

    // 2. Créer le livreur avec l'ID du profil (sans colonne 'name')
    const { data: newDriver, error } = await supabase
      .from('drivers')
      .insert({
        id: newId,
        agency_id: session.agencyId,
        phone,
        pin_code: hashedPin,
        available: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting driver:', error);
      // Nettoyage : supprimer le profil créé si le driver échoue
      await supabase.from('profiles').delete().eq('id', newId);
      return NextResponse.json({ error: 'Erreur lors de la création du livreur.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      driver: {
        id: newDriver.id,
        name,
        phone,
        vehicle,
      },
    });
  } catch (err) {
    console.error('[POST /api/agency/drivers]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

/**
 * GET /api/agency/drivers
 * Returns all drivers belonging to the current agency
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('id, agency_id, phone, available, created_at, profiles(id, name, phone)')
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/agency/drivers] Error:', error);
      return NextResponse.json({ error: 'Erreur récupération livreurs.' }, { status: 500 });
    }

    const formatted = (drivers || []).map((d: any) => ({
      id: d.id,
      name: d.profiles?.name || 'Livreur',
      phone: d.phone || d.profiles?.phone || '',
      available: d.available !== false,
      created_at: d.created_at,
    }));

    return NextResponse.json({ drivers: formatted });
  } catch (err) {
    console.error('[GET /api/agency/drivers]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
