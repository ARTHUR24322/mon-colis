/**
 * POST /api/auth/login
 * Body:
 *   - Vendeur  : { phone, password, role: 'vendeur' }  ← numéro de téléphone (DRC preferred)
 *               { email, password, role: 'vendeur' }   ← fallback email
 *   - Agence   : { email, password, role: 'agence' }
 *   - Livreur  : { phone, pinCode, role: 'livreur' }
 *   - Relais   : { agentNumber, pinCode, role: 'point_relais' }
 * Returns: 200 + sets httpOnly session cookie  |  401 if invalid
 * All accounts are verified against Supabase — no hardcoded credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createToken, setSessionCookie, UserRole } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import bcrypt from 'bcryptjs';
import { logLoginAttempt } from '@/utils/loginLogger';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // -- Double protection brute-force (5 tentatives / 60s par IP)
    const rl = rateLimit(request, { max: 5, windowMs: 60_000, blockDurationMs: 15 * 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.message || 'Trop de tentatives. Réessayez dans 15 minutes.' },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    const body = await request.json();
    const { role } = body as { role: string };

    if (!role) {
      return NextResponse.json({ error: 'Le rôle est requis.' }, { status: 400 });
    }

    // -- LIVREUR: authenticate by phone + PIN ----------------------
    if (role === 'livreur') {
      const { phone, pinCode } = body as { phone: string; pinCode: string };
      if (!phone || !pinCode) {
        return NextResponse.json({ error: 'Téléphone et code PIN requis.' }, { status: 400 });
      }

      const { dataService } = await import('@/lib/data-service');
      const driver = await dataService.authenticateDriver(phone, pinCode);

      if (!driver) {
        await logLoginAttempt(request, phone, 'livreur', 'failed', 'Numéro ou code PIN incorrect.');
        return NextResponse.json(
          { error: 'Numéro ou code PIN incorrect.' },
          { status: 401 }
        );
      }

      await logLoginAttempt(request, phone, 'livreur', 'success', 'Connexion réussie');

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

    // -- POINT RELAIS AGENT: authenticate by agentNumber + PIN -----
    if (role === 'point_relais') {
      const { agentNumber, pinCode } = body as { agentNumber: string; pinCode: string };
      if (!agentNumber || !pinCode) {
        return NextResponse.json({ error: 'Numéro agent et code PIN requis.' }, { status: 400 });
      }
      if (!/^\d{9}$/.test(agentNumber)) {
        return NextResponse.json({ error: 'Le numéro agent doit contenir exactement 9 chiffres.' }, { status: 400 });
      }
      if (!/^\d{6}$/.test(pinCode)) {
        return NextResponse.json({ error: 'Le code PIN doit contenir exactement 6 chiffres.' }, { status: 400 });
      }

      const { dataService } = await import('@/lib/data-service');
      const agent = await dataService.authenticateDropPointAgent(agentNumber, pinCode);

      if (!agent) {
        await logLoginAttempt(request, agentNumber, 'point_relais', 'failed', 'Numéro agent ou code PIN incorrect.');
        return NextResponse.json(
          { error: 'Numéro agent ou code PIN incorrect.' },
          { status: 401 }
        );
      }

      await logLoginAttempt(request, agentNumber, 'point_relais', 'success', 'Connexion réussie');

      const token = await createToken({
        userId: agent.id,
        role: 'point_relais' as any,
        name: agent.name,
        agencyId: agent.dropPointId, // reuse agencyId field to store dropPointId
        dropPointId: agent.dropPointId,
        agentNumber: agent.agentNumber,
      });
      await setSessionCookie(token);

      return NextResponse.json({
        success: true,
        user: {
          id: agent.id,
          role: 'point_relais',
          name: agent.name,
          agentNumber: agent.agentNumber,
          dropPointId: agent.dropPointId,
          dropPointName: agent.dropPointName,
          dropPointCommune: agent.dropPointCommune,
        },
      });
    }

    // -- ADMINS (superadmin, admin_agences, admin_relais): authenticate by password ----------------------
    if (['superadmin', 'admin_agences', 'admin_relais'].includes(role)) {
      const { email, password } = body as { email?: string; password?: string };
      if (!email || !password) {
        return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
      }
      
      const adminEmail = process.env.ADMIN_EMAIL || 'Arthuradmindev@gmail.com';
      const adminHash = process.env.ADMIN_PASSWORD_HASH;

      let isSuperAdmin = email.trim().toLowerCase() === adminEmail.toLowerCase();
      
      if (!isSuperAdmin) {
        // Authenticate as sub-admin
        const { loadAdmins, hashAdminPassword } = require('../../admin/admins/route');
        const admins = await loadAdmins();
        const subAdmin = admins.find((a: any) => (a.email || '').toLowerCase() === email.trim().toLowerCase() || a.username.toLowerCase() === email.trim().toLowerCase());
        
        if (!subAdmin || !subAdmin.isActive) {
          await logLoginAttempt(request, email, role, 'failed', 'Identifiants administrateur incorrects ou inactifs.');
          return NextResponse.json({ error: 'Identifiants administrateur incorrects.' }, { status: 401 });
        }
        
        const pwdHash = hashAdminPassword(password);
        if (pwdHash !== subAdmin.passwordHash) {
          await logLoginAttempt(request, email, role, 'failed', 'Mot de passe incorrect.');
          return NextResponse.json({ error: 'Identifiants administrateur incorrects.' }, { status: 401 });
        }
        
        await logLoginAttempt(request, email, role, 'success', 'Connexion réussie');
        
        const token = await createToken({
          userId: subAdmin.id,
          role: subAdmin.role as any,
          name: subAdmin.displayName,
        });
        await setSessionCookie(token);

        return NextResponse.json({
          success: true,
          user: { id: subAdmin.id, role: subAdmin.role, name: subAdmin.displayName },
        });
      } else {
        // Authenticate as superadmin
        const activeHash = adminHash || process.env.ADMIN_PASSWORD_HASH;

        if (!activeHash) {
          return NextResponse.json({ error: 'Configuration admin manquante (ADMIN_PASSWORD_HASH).' }, { status: 500 });
        }

        const passwordValid = await bcrypt.compare(password, activeHash);

        if (!passwordValid) {
          await logLoginAttempt(request, email, role, 'failed', 'Mot de passe incorrect.');
          return NextResponse.json({ error: 'Identifiants administrateur incorrects.' }, { status: 401 });
        }

        await logLoginAttempt(request, email, role, 'success', 'Connexion réussie');

        const token = await createToken({
          userId: 'superadmin-master-id',
          role: 'superadmin',
          name: 'Super Admin Moncolis',
        });
        await setSessionCookie(token);

        return NextResponse.json({
          success: true,
          user: { id: 'superadmin-master-id', role: 'superadmin', name: 'Super Admin Moncolis' },
        });
      }
    }

    // -- VENDEUR / AGENCE: authenticate by phone (preferred) or email + password --------
    const { email, phone, password } = body as { email?: string; phone?: string; password: string };
    const identifier = phone?.trim() || email?.trim() || '';

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifiant (téléphone ou email) et mot de passe requis.' }, { status: 400 });
    }

    if (!['vendeur', 'agence'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
    }

    // 1. Find the profile by phone OR email + role
    //    For vendeur, phone is the primary identifier in the DRC market.
    let profile: Record<string, any> | null = null;
    let profileError: any = null;

    if (phone) {
      // Normalize phone: strip spaces, keep + prefix
      const normalizedPhone = phone.trim().replace(/\s+/g, '');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, password_hash, role, phone, is_active')
        .eq('phone', normalizedPhone)
        .eq('role', role)
        .maybeSingle();
      profile = data;
      profileError = error;

      // Also try without leading + (some entries may be stored without it)
      if (!profile && normalizedPhone.startsWith('+')) {
        const phoneWithout = normalizedPhone.slice(1);
        const { data: data2 } = await supabase
          .from('profiles')
          .select('id, name, email, password_hash, role, phone, is_active')
          .eq('phone', phoneWithout)
          .eq('role', role)
          .maybeSingle();
        if (data2) profile = data2;
      }
    } else {
      // Fallback: lookup by email
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, password_hash, role, phone, is_active')
        .eq('email', email!.toLowerCase().trim())
        .eq('role', role)
        .maybeSingle();
      profile = data;
      profileError = error;
    }

    if (profileError || !profile) {
      await logLoginAttempt(request, identifier, role, 'failed', 'Identifiants incorrects.');
      return NextResponse.json(
        { error: 'Identifiants incorrects. Vérifiez votre numéro ou email et mot de passe.' },
        { status: 401 }
      );
    }

    if (profile.is_active === false) {
      await logLoginAttempt(request, identifier, role, 'blocked', 'Compte suspendu par l\'administration.');
      return NextResponse.json(
        { error: 'Votre compte a été suspendu par l\'administration. Veuillez contacter le support.' },
        { status: 403 }
      );
    }

    // 2. Vérification du mot de passe avec bcrypt
    //    Compatibilité ascendante : si l'ancien hash est en SHA-256 (64 chars hex),
    //    on vérifie l'ancien format puis on rehache automatiquement en bcrypt.
    let passwordValid = false;
    let needsRehash   = false;

    if (profile.password_hash && profile.password_hash.startsWith('$2b$')) {
      // Hash bcrypt — vérification standard
      passwordValid = await bcrypt.compare(password, profile.password_hash);
    } else if (profile.password_hash && /^[0-9a-f]{64}$/i.test(profile.password_hash)) {
      // Hash SHA-256 legacy — vérification temporaire pour migration
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
      const sha256Hash = Buffer.from(hashBuffer).toString('hex');
      passwordValid = sha256Hash === profile.password_hash;
      if (passwordValid) needsRehash = true; // Rehacher en bcrypt après connexion réussie
    }

    if (!passwordValid) {
      await logLoginAttempt(request, identifier, role, 'failed', 'Mot de passe incorrect.');
      return NextResponse.json(
        { error: 'Identifiants incorrects. Vérifiez votre numéro ou email et mot de passe.' },
        { status: 401 }
      );
    }

    // Rehachage automatique SHA-256 → bcrypt (migration transparente)
    if (needsRehash) {
      const newBcryptHash = await bcrypt.hash(password, 12);
      await supabase
        .from('profiles')
        .update({ password_hash: newBcryptHash })
        .eq('id', profile.id);
    }

    // 3. For agence role, fetch the agency and verify validation status
    let agencyId: string | undefined;
    if (role === 'agence') {
      const { dataService } = await import('@/lib/data-service');
      const allAgencies = await dataService.getAgencies();
      const agInfo = allAgencies.find(a => a.id === profile.id);

      if (agInfo) {
        if (agInfo.status === 'PENDING') {
          return NextResponse.json(
            { error: "Votre compte agence est en cours d'examen par le Superadmin. Dès validation de votre dossier, vous pourrez vous connecter." },
            { status: 403 }
          );
        }
        if (agInfo.status === 'REJECTED') {
          return NextResponse.json(
            { error: "Votre demande d'adhésion agence a été refusée par la direction Moncolis. Veuillez contacter le support." },
            { status: 403 }
          );
        }
        if (agInfo.status === 'SUSPENDED') {
          return NextResponse.json(
            { error: "Votre compte agence a été suspendu par l'administrateur. Veuillez contacter le support." },
            { status: 403 }
          );
        }
        agencyId = agInfo.id;
      } else {
        const { data: agence } = await supabase
          .from('agencies')
          .select('id')
          .eq('id', profile.id)
          .maybeSingle();
        agencyId = agence?.id;
      }
    }

    // 4. Create session
    await logLoginAttempt(request, identifier, role, 'success', 'Connexion réussie');
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
