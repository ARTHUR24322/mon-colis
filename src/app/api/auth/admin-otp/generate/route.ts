import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { setAdminOtpMeta } from '@/lib/adminSession';
import type { AdminRole } from '@/lib/adminPermissions';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    const adminEmail = process.env.ADMIN_EMAIL || 'Arthuradmindev@gmail.com';
    const adminHash = process.env.ADMIN_PASSWORD_HASH;

    let targetRole = 'superadmin';
    let targetEmail = email.trim();
    let isSuperadmin = targetEmail.toLowerCase() === adminEmail.toLowerCase();
    
    if (!isSuperadmin) {
      // Check if it's a sub-admin
      const { loadAdmins, hashAdminPassword } = require('../../../admin/admins/route');
      const admins = await loadAdmins();
      const subAdmin = admins.find((a: any) => (a.email || '').toLowerCase() === targetEmail.toLowerCase() || a.username.toLowerCase() === targetEmail.toLowerCase());
      
      if (!subAdmin || !subAdmin.isActive) {
        return NextResponse.json({ success: false, error: 'Identifiants incorrects ou compte inactif' }, { status: 401 });
      }
      
      const pwdHash = hashAdminPassword(password);
      if (pwdHash !== subAdmin.passwordHash) {
        return NextResponse.json({ success: false, error: 'Identifiants incorrects' }, { status: 401 });
      }
      
      targetRole = subAdmin.role;
      targetEmail = subAdmin.email || targetEmail;
    } else {
      const activeHash = adminHash || process.env.ADMIN_PASSWORD_HASH;
      if (!activeHash) {
        return NextResponse.json({ success: false, error: 'Configuration admin manquante (ADMIN_PASSWORD_HASH).' }, { status: 500 });
      }

      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(password, activeHash);
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Identifiants incorrects' }, { status: 401 });
      }
    }

    // Generate 6 digit cryptographically secure OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    
    // Hash the OTP and store in cookie for verification
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      expires,
      path: '/'
    };

    // Stocker les métadonnées (role + email) dans un cookie httpOnly pour la route verify
    await setAdminOtpMeta({ role: targetRole as AdminRole, email: targetEmail });

    const createSuccessResponse = (extraData: any = {}) => {
      const response = NextResponse.json({ success: true, role: targetRole, targetEmail, ...extraData });
      response.cookies.set('admin_otp_hash', otpHash, cookieOptions);
      return response;
    };

    // Try to use Gmail via Nodemailer first
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: GMAIL_USER.trim(),
            pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '')
          }
        });

        await transporter.sendMail({
          from: `"Moncolis Admin" <${GMAIL_USER.trim()}>`,
          to: targetEmail,
          subject: 'Code OTP Admin - Moncolis',
          html: `<p>Votre code de connexion Administrateur est : <strong>${otp}</strong></p><p>Ce code est valable 5 minutes.</p>`
        });
        return createSuccessResponse();
      } catch (err) {
        console.warn('Nodemailer a échoué, bascule automatique sur Resend :', (err as Error).message);
      }
    }

    // Fallback to Resend if Gmail is not configured
    let RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/^RESEND_API_KEY=["']?(.*?)["']?$/m);
        if (match) {
          RESEND_API_KEY = match[1];
        }
      }
    }
    
    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Moncolis Admin <onboarding@resend.dev>',
          to: targetEmail,
          subject: 'Code OTP Admin - Moncolis',
          html: `<p>Votre code de connexion Administrateur est : <strong>${otp}</strong></p><p>Ce code est valable 5 minutes.</p>`
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Erreur de Resend API:', errorData);
        console.log('=============================================');
        console.log(`L'envoi d'e-mail a échoué. Code OTP de secours pour ${targetEmail} :`, otp);
        console.log('=============================================');
      }
      
      return createSuccessResponse();
    } else {
      // Aucun service d'envoi configuré
      if (process.env.NODE_ENV !== 'production') {
        console.log('=============================================');
        console.log(`[DEV MODE] Code OTP généré pour ${targetEmail} :`, otp);
        console.log('=============================================');
        return createSuccessResponse();
      }

      console.error('Aucun service email configuré (GMAIL ou RESEND_API_KEY manquant).');
      return NextResponse.json({ 
        success: false, 
        error: "Le service d'envoi du code OTP n'est pas configuré. Veuillez contacter l'administrateur système." 
      }, { status: 503 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
