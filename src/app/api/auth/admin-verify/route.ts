import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
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
