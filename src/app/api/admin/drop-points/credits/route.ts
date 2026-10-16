/**
 * POST /api/admin/drop-points/credits
 * Superadmin adds credits to a Point Relais
 * Body: { dropPointId, amount }
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { requireAdminSession } from '@/lib/adminSession';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { dropPointId, amount } = body;

    if (!dropPointId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'dropPointId et amount (> 0) sont requis' }, { status: 400 });
    }

    await dataService.addDropPointCredits(dropPointId, amount);

    return NextResponse.json({ success: true, dropPointId, creditsAdded: amount });
  } catch (err) {
    console.error('[drop-point-credits]', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
