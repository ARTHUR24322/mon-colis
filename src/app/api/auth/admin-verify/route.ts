import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rateLimit';
import { enqueueNotification } from '@/lib/notification-outbox';

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 5, windowMs: 60_000, blockDurationMs: 15 * 60_000 });
    if (!rl.success) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Inconnue';
      await enqueueNotification({
        userId: 'superadmin-master-id',
        eventType: 'CONNEXION_SUSPECTE',
        payload: {
          identifier: 'Super Admin Login',
          attempts: '5+ échouées (bloqué)',
          ip,
        },
        dedupeKey: `CONNEXION_SUSPECTE:admin:${ip}:${Math.floor(Date.now() / (15 * 60 * 1000))}`,
      });

      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    const { email, password } = await request.json();
    
    const adminEmail = (process.env.ADMIN_EMAIL || 'Arthuradmindev@gmail.com').toLowerCase().trim();
    const adminHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminHash || !email || !password) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    if (email.toLowerCase().trim() !== adminEmail) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, adminHash);
    if (isValid) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
