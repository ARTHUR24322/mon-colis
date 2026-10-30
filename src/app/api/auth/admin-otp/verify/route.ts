import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createAdminSessionCookie, clearAdminOtpMeta, getAdminOtpMeta } from '@/lib/adminSession';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 3, windowMs: 60_000, blockDurationMs: 15 * 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Trop de tentatives erronées. Réessayez dans 15 minutes.' },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    const { otp } = await request.json();

    if (!otp) {
      return NextResponse.json({ success: false, error: 'OTP manquant' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const storedHash = cookieStore.get('admin_otp_hash')?.value;

    if (!storedHash) {
      return NextResponse.json(
        { success: false, error: 'Code expiré ou invalide. Veuillez recommencer.' },
        { status: 401 }
      );
    }

    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (inputHash !== storedHash) {
      return NextResponse.json({ success: false, error: 'Code OTP incorrect' }, { status: 401 });
    }

    // OTP valide — récupérer les métadonnées (role + email) du cookie intermédiaire
    const meta = await getAdminOtpMeta();

    // Nettoyer les cookies temporaires
    cookieStore.delete('admin_otp_hash');
    await clearAdminOtpMeta();

    if (!meta) {
      // Fallback : session superadmin si le cookie meta est absent (compatibilité)
      await createAdminSessionCookie('superadmin', 'admin@moncolis.cd');
      return NextResponse.json({ success: true, role: 'superadmin' });
    }

    // Créer le cookie de session admin sécurisé (httpOnly, signé HMAC)
    await createAdminSessionCookie(meta.role, meta.email);

    return NextResponse.json({ success: true, role: meta.role });
  } catch (error) {
    console.error('[admin-otp/verify]', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
  }
}
