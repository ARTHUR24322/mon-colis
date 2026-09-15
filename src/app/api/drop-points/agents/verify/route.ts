/**
 * POST /api/drop-points/agents/verify
 * Body: { agentNumber: string }
 * Used by the driver to verify an agent's 9-digit number before depositing a parcel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const { agentNumber } = await request.json() as { agentNumber: string };

    if (!agentNumber || agentNumber.length !== 9 || !/^\d{9}$/.test(agentNumber)) {
      return NextResponse.json({ error: 'Numéro agent invalide (9 chiffres requis).' }, { status: 400 });
    }

    const agent = await dataService.verifyAgentNumber(agentNumber);
    if (!agent) {
      return NextResponse.json({ error: 'Numéro agent introuvable ou désactivé.' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (err) {
    console.error('[POST /api/drop-points/agents/verify]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
