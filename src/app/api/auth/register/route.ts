/**
 * POST /api/auth/register
 * Body: { name, email, password, phone, address, zone, description, role: 'vendeur'|'agence' }
 * Creates a profile in Supabase and returns a session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { createToken, setSessionCookie, UserRole } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, address, role } = body as {
      name: string;
      email: string;
      password: string;
      phone: string;
      address: string;
      role: string;
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

    // 2. Hash the password using SHA-256 via WebCrypto API
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
    const passwordHash = Buffer.from(hashBuffer).toString('hex');

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

    // 4. For agence: also create the agencies record (agencies.id = profiles.id, shared PK)
    let agencyId: string | undefined;
    if (role === 'agence') {
      const { data: agence, error: agenceError } = await supabase
        .from('agencies')
        .insert({
          id: profile.id,         // 1-to-1 with profiles via shared primary key
          phone: phone.trim(),
          address: address?.trim() || '',
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
    }

    // 5. Create and set the session cookie
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
