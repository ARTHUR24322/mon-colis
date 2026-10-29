/**
 * PATCH /api/auth/change-password
 * Body: { currentPassword: string; newPassword: string }
 * Permet à tout utilisateur connecté (vendeur, livreur, agence, relais, client, admin)
 * de modifier son propre mot de passe.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import bcrypt from 'bcryptjs';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Non autorisé. Veuillez vous reconnecter.' }, { status: 401 });
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

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      );
    }

    // Récupérer le profil et son hash de mot de passe actuel
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, password_hash')
      .eq('id', session.userId)
      .maybeSingle();

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    }

    // Vérifier le mot de passe actuel (supporte bcrypt $2a$/$2b$ et SHA-256 legacy)
    let passwordValid = false;
    const currentHash = profile.password_hash || '';

    if (currentHash.startsWith('$2a$') || currentHash.startsWith('$2b$')) {
      passwordValid = await bcrypt.compare(currentPassword, currentHash);
    } else if (/^[0-9a-f]{64}$/i.test(currentHash)) {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(currentPassword));
      const sha256Hash = Buffer.from(hashBuffer).toString('hex');
      passwordValid = sha256Hash === currentHash;
    } else if (currentHash === currentPassword) {
      // Cas de mot de passe en texte brut hérité
      passwordValid = true;
    }

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Le mot de passe actuel est incorrect.' },
        { status: 401 }
      );
    }

    // Hasher le nouveau mot de passe avec bcrypt
    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ password_hash: newHash })
      .eq('id', session.userId);

    if (updateError) {
      console.error('[PATCH /api/auth/change-password] Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du mot de passe.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Mot de passe modifié avec succès.'
    });
  } catch (e) {
    console.error('Unexpected error in PATCH /api/auth/change-password:', e);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}
