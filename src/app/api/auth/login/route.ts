/**
 * POST /api/auth/login
 * Body: { email, password, role: 'vendeur'|'agence' } OR { phone, pinCode, role: 'livreur' }
 * Returns: 200 + sets httpOnly session cookie  |  401 if invalid
 * All accounts are verified against Supabase — no hardcoded credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createToken, setSessionCookie, UserRole } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role } = body as { role: string };

    if (!role) {
      return NextResponse.json({ error: 'Le rôle est requis.' }, { status: 400 });
    }

    // ── LIVREUR: authenticate by phone + PIN ──────────────────────
    if (role === 'livreur') {
      const { phone, pinCode } = body as { phone: string; pinCode: string };
      if (!phone || !pinCode) {
        return NextResponse.json({ error: 'Téléphone et code PIN requis.' }, { status: 400 });
      }

      const { dataService } = await import('@/lib/data-service');
      const driver = await dataService.authenticateDriver(phone, pinCode);

      if (!driver) {
        return NextResponse.json(
          { error: 'Numéro ou code PIN incorrect.' },
          { status: 401 }
        );
      }

      const token = await createToken({
        userId: driver.id,
        role: 'livreur',
        name: driver.name,
        phone: driver.phone,
        agencyId: driver.agencyId,
        driverId: driver.id,
      });
      await setSessionCookie(token);

      return NextResponse.json({
        success: true,
        user: { id: driver.id, role: 'livreur', name: driver.name },
      });
    }

    // ── VENDEUR / AGENCE: authenticate by email + password ────────
    const { email, password } = body as { email: string; password: string };
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    if (!['vendeur', 'agence'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
    }

    // 1. Find the profile by email + role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, password_hash, role, phone')
      .eq('email', email.toLowerCase().trim())
      .eq('role', role)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' },
        { status: 401 }
      );
    }

    // 2. Hash submitted password and compare
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
    const submittedHash = Buffer.from(hashBuffer).toString('hex');

    if (submittedHash !== profile.password_hash) {
      return NextResponse.json(
        { error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' },
        { status: 401 }
      );
    }

    // 3. For agence role, fetch the agency id (agencies.id = profiles.id via shared PK)
    let agencyId: string | undefined;
    if (role === 'agence') {
      const { data: agence } = await supabase
        .from('agencies')
        .select('id')
        .eq('id', profile.id)
        .maybeSingle();
      agencyId = agence?.id;
    }

    // 4. Create session
    const token = await createToken({
      userId: profile.id,
      role: profile.role as UserRole,
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
        role: profile.role,
        name: profile.name,
        email: profile.email,
      },
    });

  } catch (err) {
    console.error('[auth/login] error:', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
