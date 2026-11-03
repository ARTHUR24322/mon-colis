/**
 * POST /api/agence/auth/reset-password/request
 * Étape 1 : Demande de réinitialisation de mot de passe pour un compte agence.
 * - Vérifie l'existence du compte (Directeur dans profiles ou agency_members)
 * - Rate-limit par IP (max 5 requêtes / 15 minutes)
 * - Génère un code OTP à 6 chiffres valable 15 minutes
 * - Envoie le code par e-mail (Nodemailer / Resend)
 * - Stocke le hash sécurisé dans un cookie httpOnly
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const OTP_SECRET = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'mc_agency_reset_salt_secret';

// Rate-limiting en mémoire par IP
const requestAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = requestAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) {
    return false;
  }
  entry.count++;
  return true;
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 3
    ? name[0] + '***'
    : name.slice(0, 2) + '***' + name.slice(-1);
  return `${maskedName}@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Trop de demandes de réinitialisation. Veuillez patienter 15 minutes.' },
        { status: 429 }
      );
    }

    const { identifier } = await req.json();
    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Adresse e-mail ou identifiant requis.' }, { status: 400 });
    }

    const cleanInput = identifier.trim().toLowerCase();

    // 1. Chercher le compte dans `profiles` (Directeur/compte agence)
    let accountId = '';
    let accountEmail = '';
    let accountName = '';
    let accountType: 'profile' | 'agency_member' = 'profile';

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .ilike('email', cleanInput)
      .eq('role', 'agence')
      .maybeSingle();

    if (profile) {
      accountId = profile.id;
      accountEmail = profile.email;
      accountName = profile.name || 'Directeur d’agence';
      accountType = 'profile';
    } else {
      // 2. Chercher dans `agency_members` (directeur ou personnel)
      const { data: member } = await supabase
        .from('agency_members')
        .select('id, name, email, staff_id, role, is_active')
        .or(`email.ilike.${cleanInput},staff_id.ilike.${cleanInput.toUpperCase()}`)
        .maybeSingle();

      if (member) {
        if (!member.is_active) {
          return NextResponse.json(
            { error: 'Ce compte a été désactivé. Veuillez contacter le support.' },
            { status: 403 }
          );
        }
        accountId = member.id;
        accountEmail = member.email || '';
        accountName = member.name || 'Membre Agence';
        accountType = 'agency_member';
      }
    }

    if (!accountId || !accountEmail) {
      // Pour éviter l'énumération de comptes, on simule une réponse réussie
      return NextResponse.json({
        success: true,
        message: 'Si ce compte existe, un code de récupération vous a été envoyé.',
        maskedEmail: cleanInput.includes('@') ? maskEmail(cleanInput) : 'votre adresse email',
      });
    }

    // 3. Générer un code OTP à 6 chiffres
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // 4. Hasher l'OTP avec sel
    const otpHash = crypto
      .createHmac('sha256', OTP_SECRET)
      .update(`${otp}:${accountId}:${expiresAt}`)
      .digest('hex');

    // Sauvegarder dans le cookie httpOnly sécurisé
    const cookiePayload = JSON.stringify({
      accountId,
      accountType,
      accountEmail,
      otpHash,
      expiresAt,
    });

    const cookieStore = await cookies();
    cookieStore.set('agency_reset_otp', Buffer.from(cookiePayload).toString('base64'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 min
    });

    // 5. Tenter l'envoi d'e-mail via Nodemailer ou Resend
    let emailSent = false;
    let devOtp: string | undefined = undefined;

    try {
      const nodemailer = await import('nodemailer');
      const gmailUser = process.env.GMAIL_USER || process.env.EMAIL_USER;
      const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD;

      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        });

        await transporter.sendMail({
          from: `"Moncolis Sécurité" <${gmailUser}>`,
          to: accountEmail,
          subject: 'Récupération de votre compte Agence - Moncolis',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; borderRadius: 12px;">
              <h2 style="color: #d97706; margin-top: 0;">Récupération de compte Agence</h2>
              <p>Bonjour <strong>${accountName}</strong>,</p>
              <p>Vous avez demandé la réinitialisation du mot de passe de votre espace Agence.</p>
              <p>Voici votre code de vérification sécurisé à usage unique :</p>
              <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a; margin: 20px 0; border-radius: 8px;">
                ${otp}
              </div>
              <p style="font-size: 13px; color: #64748b;">Ce code est valable pendant <strong>15 minutes</strong>. Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">Moncolis • Kinshasa, RDC</p>
            </div>
          `,
        });
        emailSent = true;
      }
    } catch (err: any) {
      console.warn('[reset-password] Échec Nodemailer, tentative Resend :', err?.message);
    }

    // Fallback Resend si Nodemailer non envoyé
    if (!emailSent && process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Moncolis <onboarding@resend.dev>',
            to: accountEmail,
            subject: 'Code de récupération Agence - Moncolis',
            text: `Votre code de vérification Moncolis est : ${otp} (valable 15 minutes).`,
          }),
        });
        emailSent = true;
      } catch (err: any) {
        console.warn('[reset-password] Échec Resend :', err?.message);
      }
    }

    // Si on est en développement ou si aucun SMTP n'est configuré, fournir devOtp pour éviter de bloquer l'utilisateur
    if (!emailSent || process.env.NODE_ENV !== 'production') {
      devOtp = otp;
      console.log(`[AGENCY RESET OTP] Code pour ${accountEmail}: ${otp}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Un code de confirmation a été envoyé à votre adresse e-mail.',
      maskedEmail: maskEmail(accountEmail),
      devOtp, // Fourni pour test / démo si SMTP distant indisponible
    });
  } catch (error: any) {
    console.error('[POST /api/agence/auth/reset-password/request]', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la demande.' }, { status: 500 });
  }
}
