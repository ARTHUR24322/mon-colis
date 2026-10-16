import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import fs from 'fs';
import path from 'path';

function getPin(): string | null {
  if (process.env.ADVANCED_ADMIN_PIN) {
    return process.env.ADVANCED_ADMIN_PIN;
  }
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^ADVANCED_ADMIN_PIN=["']?(\d{4})["']?$/m);
      if (match) return match[1];
    }
  } catch {}

  // En production, refuser le code par défaut 0000 pour éviter toute brèche
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return '0000'; // Fallback uniquement en développement local
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Session admin requise' }, { status: 401 });
    }

    const { pin } = await req.json();
    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ success: false, error: 'Code PIN invalide (4 chiffres requis).' }, { status: 400 });
    }

    const correctPin = getPin();
    if (!correctPin) {
      return NextResponse.json({ 
        success: false, 
        error: 'ADVANCED_ADMIN_PIN non configuré sur le serveur de production.' 
      }, { status: 500 });
    }

    if (pin !== correctPin) {
      return NextResponse.json({ success: false, error: 'Code PIN incorrect.' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
  }
}
