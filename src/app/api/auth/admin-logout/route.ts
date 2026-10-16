/**
 * POST /api/auth/admin-logout
 * Supprime le cookie de session admin (admin_session).
 */
import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/adminSession';

export async function POST() {
  await clearAdminSessionCookie();
  return NextResponse.json({ success: true });
}
