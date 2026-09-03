/**
 * POST /api/auth/logout
 * Efface le cookie de session (httpOnly) — déconnexion sécurisée
 */

import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session-server';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true, message: 'Déconnexion réussie.' });
}
