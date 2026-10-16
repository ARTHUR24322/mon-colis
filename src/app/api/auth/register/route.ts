/**
 * POST /api/auth/register
 * Body: { name, email, password, phone, address, zone, description, role: 'vendeur'|'agence' }
 * Creates a profile in Supabase and returns a session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { createToken, setSessionCookie, UserRole } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import bcrypt from 'bcryptjs';
import { dataService } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, address, role, coverageZones, fleetSize } = body as {
      name: string;
      email: string;
      password: string;
      phone: string;
      address: string;
      role: string;
      coverageZones?: string[] | string;
      fleetSize?: number | string;
    };

    if (!name || !email || !password || !phone || !role) {
      return NextResponse.json({ error: 'Tous les champs obligatoires sont requis.' }, { status: 400 });
    }

    if (!['vendeur', 'agence'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
    }

    // 1. Check if email already exists in profiles
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Un compte avec cet email existe déjà.' }, { status: 409 });
    }

    // 2. Hash the password using bcrypt (12 rounds) — résistant aux attaques GPU
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Create the shared profile record
    const profileId = crypto.randomUUID();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: profileId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        phone: phone.trim(),
        role,
      })
      .select()
      .single();

    if (profileError || !profile) {
      console.error('[register] profile insert error:', profileError);
      return NextResponse.json({ error: 'Erreur lors de la création du profil.' }, { status: 500 });
    }

    // 4. For agence: create agencies record with PENDING status
    let agencyId: string | undefined;
    if (role === 'agence') {
      const parsedZones = Array.isArray(coverageZones)
        ? coverageZones
        : coverageZones
        ? coverageZones.split(',').map((z: string) => z.trim()).filter(Boolean)
        : ['Gombe', 'Limete'];

      const parsedFleet = typeof fleetSize === 'number'
        ? fleetSize
        : parseInt(String(fleetSize || '2'), 10) || 2;

      const { data: agence, error: agenceError } = await supabase
        .from('agencies')
        .insert({
          id: profile.id,         // 1-to-1 with profiles via shared primary key
          phone: phone.trim(),
          address: address?.trim() || '',
          status: 'PENDING',
          coverage_zones: parsedZones,
          fleet_size: parsedFleet,
          manager_name: profile.name,
          billing_type: 'Commission',
          billing_value: 15,
        })
        .select('id')
        .single();

      if (agenceError) {
        console.error('[register] agency insert error:', agenceError);
        // Roll back the profile
        await supabase.from('profiles').delete().eq('id', profile.id);
        return NextResponse.json({ error: 'Erreur lors de la création du compte agence.' }, { status: 500 });
      }

      agencyId = agence?.id;

      // Record in pending applications state
      dataService.recordAgencyApplication({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: phone.trim(),
        address: address?.trim() || '',
        coverageZones: parsedZones,
        fleetSize: parsedFleet,
      });

      // Crucial: do NOT set session cookie for pending agency!
      return NextResponse.json({
        success: true,
        status: 'PENDING',
        message: "Votre demande d'adhésion agence a été soumise avec succès. Votre dossier est en cours d'examen par le Superadmin.",
        user: {
          id: profile.id,
          role,
          name: profile.name,
          email: profile.email,
        },
      });
    }

    // 5. For vendeur: create and set session cookie immediately
    const token = await createToken({
      userId: profile.id,
      role: role as UserRole,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      agencyId,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      status: 'APPROVED',
      user: {
        id: profile.id,
        role,
        name: profile.name,
        email: profile.email,
      },
    });

  } catch (err) {
    console.error('[auth/register] error:', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
