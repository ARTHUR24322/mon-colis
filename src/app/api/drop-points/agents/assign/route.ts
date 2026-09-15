/**
 * POST /api/drop-points/agents/assign
 * Body: { colisId, agentNumber, driverId }
 * Driver assigns a parcel to a drop point via the agent's 9-digit number.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const { colisId, agentNumber, driverId } = await request.json() as {
      colisId: string;
      agentNumber: string;
      driverId: string;
    };

    if (!colisId || !agentNumber || !driverId) {
      return NextResponse.json({ error: 'colisId, agentNumber et driverId sont requis.' }, { status: 400 });
    }
    if (!/^\d{9}$/.test(agentNumber)) {
      return NextResponse.json({ error: 'Numéro agent invalide.' }, { status: 400 });
    }

    const result = await dataService.assignColisToDropPoint(colisId, agentNumber, driverId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: result.message, agent: result.agent });
  } catch (err) {
    console.error('[POST /api/drop-points/agents/assign]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
