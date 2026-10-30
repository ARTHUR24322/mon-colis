import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, getAdvancedAdminPin } from '@/lib/adminSession';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Session admin requise.' }, { status: 401 });
    }

    // Seul le Super Admin général est autorisé à déverrouiller la zone critique
    if (admin.role !== 'superadmin') {
      return NextResponse.json({
        success: false,
        error: 'Action réservée exclusivement au Super Admin général.'
      }, { status: 403 });
    }

    const { pin } = await req.json();
    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ success: false, error: 'Code de sécurité requis.' }, { status: 400 });
    }

    const correctPin = getAdvancedAdminPin();
    if (!correctPin) {
      return NextResponse.json({
        success: false,
        error: 'ADVANCED_ADMIN_PIN non configuré dans l\'environnement serveur.'
      }, { status: 500 });
    }

    if (pin.trim() !== correctPin.trim()) {
      return NextResponse.json({ success: false, error: 'Code de sécurité incorrect.' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
  }
}
