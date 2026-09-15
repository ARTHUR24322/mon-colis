/**
 * POST /api/drop-points/agents/confirm
 * Body: { colisId, agentId }
 * Drop point agent confirms physical reception of a parcel deposited by a driver.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const { colisId, agentId } = await request.json() as { colisId: string; agentId: string };

    if (!colisId || !agentId) {
      return NextResponse.json({ error: 'colisId et agentId sont requis.' }, { status: 400 });
    }

    const result = await dataService.confirmDropPointReception(colisId, agentId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[POST /api/drop-points/agents/confirm]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
