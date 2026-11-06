/**
 * POST /api/agence/auth/reset-password/confirm
 * Étape 3 : Définition et enregistrement du nouveau mot de passe.
 * - Vérifie le cookie de validation intermédiaire (agency_reset_verified)
 * - Hash le mot de passe avec bcrypt (10 rounds)
 * - Met à jour `profiles` ou `agency_members`
 * - Journalise dans security_logs
 * - Nettoie le cookie
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const OTP_SECRET = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'mc_agency_reset_salt_secret';

export async function POST(req: NextRequest) {
  try {
    const { newPassword, confirmPassword } = await req.json();

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' },
        { status: 400 }
      );
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Les deux mots de passe ne correspondent pas.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const rawCookie = cookieStore.get('agency_reset_verified')?.value;

    if (!rawCookie) {
      return NextResponse.json(
        { error: 'Autorisation de réinitialisation expirée ou inexistante. Veuillez recommencer.' },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(rawCookie, 'base64').toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'Jeton de réinitialisation invalide.' }, { status: 400 });
    }

    const { accountId, accountType, accountEmail, resetExpiresAt, tokenSig } = payload;

    if (!accountId || !resetExpiresAt || !tokenSig) {
      return NextResponse.json({ error: 'Jeton incomplet.' }, { status: 400 });
    }

    if (Date.now() > resetExpiresAt) {
      cookieStore.delete('agency_reset_verified');
      return NextResponse.json({ error: 'Le délai de réinitialisation est dépassé. Veuillez recommencer.' }, { status: 401 });
    }

    // Vérifier la signature du jeton
    const expectedSig = crypto
      .createHmac('sha256', OTP_SECRET)
      .update(`${accountId}:${accountEmail}:${resetExpiresAt}`)
      .digest('hex');

    if (expectedSig !== tokenSig) {
      return NextResponse.json({ error: 'Signature du jeton invalide.' }, { status: 401 });
    }

    // 1. Hasher le mot de passe avec bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const nowIso = new Date().toISOString();

    // 2. Mettre à jour dans la table appropriée
    if (accountType === 'agency_member') {
      const { error: updErr } = await supabase
        .from('agency_members')
        .update({ password_hash: passwordHash })
        .eq('id', accountId);

      if (updErr) {
        console.error('[reset-password/confirm] Update agency_members error:', updErr);
        return NextResponse.json({ error: 'Erreur lors de la mise à jour du mot de passe.' }, { status: 500 });
      }
    } else {
      // Compte agence principal dans profiles (ne pas inclure updated_at qui n'existe pas dans profiles)
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ password_hash: passwordHash })
        .eq('id', accountId);

      if (updErr) {
        console.error('[reset-password/confirm] Update profiles error:', updErr);
        return NextResponse.json({ error: 'Erreur lors de la mise à jour du mot de passe.' }, { status: 500 });
      }

      // Si présent également dans agency_members pour le même email, synchroniser
      if (accountEmail) {
        try {
          await supabase
            .from('agency_members')
            .update({ password_hash: passwordHash })
            .ilike('email', accountEmail);
        } catch {
          // Silencieux
        }
      }

      // Synchroniser avec Supabase Auth si le compte existe dans auth.users
      try {
        await supabase.auth.admin.updateUserById(accountId, { password: newPassword });
      } catch {
        // Silencieux
      }
    }

    // 3. Journaliser dans security_logs
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      await supabase.from('security_logs').insert({
        action: 'AGENCY_PASSWORD_RESET_SUCCESS',
        actor_ip: ip,
        actor_id: accountId,
        actor_name: accountEmail,
        target_role: 'agence',
        success: true,
        details: 'Mot de passe réinitialisé via code de vérification sécurisé.',
        created_at: nowIso,
      });
    } catch {
      // Silencieux
    }

    // 4. Nettoyer le cookie
    cookieStore.delete('agency_reset_verified');

    return NextResponse.json({
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
      email: accountEmail,
    });
  } catch (error: any) {
    console.error('[POST /api/agence/auth/reset-password/confirm]', error);
    return NextResponse.json({ error: 'Erreur inattendue lors de la confirmation.' }, { status: 500 });
  }
}

