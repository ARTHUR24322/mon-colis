/**
 * PATCH /api/agency/change-password
 * Body: { currentPassword: string; newPassword: string }
 * Allows an authenticated agence user to change their own password.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import bcrypt from 'bcryptjs';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Mot de passe actuel et nouveau mot de passe requis.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' },
        { status: 400 }
      );
    }

    // Fetch the profile to get the current password hash
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, password_hash')
      .eq('id', session.userId)
      .maybeSingle();

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    }

    // Verify current password (supports bcrypt and SHA-256 legacy)
    let passwordValid = false;
    if (profile.password_hash?.startsWith('$2b$')) {
      passwordValid = await bcrypt.compare(currentPassword, profile.password_hash);
    } else if (profile.password_hash && /^[0-9a-f]{64}$/i.test(profile.password_hash)) {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(currentPassword));
      const sha256Hash = Buffer.from(hashBuffer).toString('hex');
      passwordValid = sha256Hash === profile.password_hash;
    }

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Le mot de passe actuel est incorrect.' },
        { status: 401 }
      );
    }

    // Hash and save the new password
    const newHash = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ password_hash: newHash })
      .eq('id', session.userId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du mot de passe.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Unexpected error in PATCH /api/agency/change-password:', e);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}
