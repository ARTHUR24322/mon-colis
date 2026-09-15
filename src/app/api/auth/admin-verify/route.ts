import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { hash } = await request.json();
    
    // Fallback pour le dev, ou récup depuis env en prod
    const realHash = process.env.ADMIN_PASSWORD_HASH;

    if (!realHash) {
      console.warn("ADMIN_PASSWORD_HASH n'est pas défini dans l'environnement !");
      return NextResponse.json({ success: false, error: 'Configuration manquante' }, { status: 500 });
    }

    if (hash === realHash) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
