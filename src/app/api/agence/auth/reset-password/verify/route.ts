/**
 * POST /api/agence/auth/reset-password/verify
 * Étape 2 : Vérification du code OTP saisi par l'agence.
 * Si le code est valide, délivre un token de réinitialisation temporaire (10 min).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const OTP_SECRET = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'mc_agency_reset_salt_secret';

export async function POST(req: NextRequest) {
  try {
    const { otp } = await req.json();

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return NextResponse.json({ error: 'Code de vérification à 6 chiffres invalide.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const rawCookie = cookieStore.get('agency_reset_otp')?.value;

    if (!rawCookie) {
      return NextResponse.json(
        { error: 'Session expirée ou inexistante. Veuillez recommencer la demande.' },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(rawCookie, 'base64').toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'Session corrompue.' }, { status: 400 });
    }

    const { accountId, accountType, accountEmail, otpHash, expiresAt } = payload;

    if (!accountId || !otpHash || !expiresAt) {
      return NextResponse.json({ error: 'Session de récupération invalide.' }, { status: 400 });
    }

    if (Date.now() > expiresAt) {
      cookieStore.delete('agency_reset_otp');
      return NextResponse.json({ error: 'Le code de vérification a expiré. Veuillez en redemander un.' }, { status: 401 });
    }

    // Calcul du hash attendu
    const expectedHash = crypto
      .createHmac('sha256', OTP_SECRET)
      .update(`${otp.trim()}:${accountId}:${expiresAt}`)
      .digest('hex');

    if (expectedHash !== otpHash) {
      return NextResponse.json({ error: 'Code de vérification incorrect.' }, { status: 401 });
    }

    // Code valide ! Créer le token de réinitialisation (10 minutes)
    const resetExpiresAt = Date.now() + 10 * 60 * 1000;
    const tokenSig = crypto
      .createHmac('sha256', OTP_SECRET)
      .update(`${accountId}:${accountEmail}:${resetExpiresAt}`)
      .digest('hex');

    const resetPayload = JSON.stringify({
      accountId,
      accountType,
      accountEmail,
      resetExpiresAt,
      tokenSig,
    });

    // Supprimer le cookie OTP et définir le cookie de réinitialisation
    cookieStore.delete('agency_reset_otp');
    cookieStore.set('agency_reset_verified', Buffer.from(resetPayload).toString('base64'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 minutes
    });

    return NextResponse.json({
      success: true,
      message: 'Code validé avec succès. Vous pouvez maintenant définir votre nouveau mot de passe.',
    });
  } catch (error: any) {
    console.error('[POST /api/agence/auth/reset-password/verify]', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la vérification.' }, { status: 500 });
  }
}
