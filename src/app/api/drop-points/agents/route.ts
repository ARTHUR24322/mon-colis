/**
 * GET   /api/drop-points/agents        — List all drop point agents (Superadmin)
 * POST  /api/drop-points/agents        — Create a new agent (Superadmin)
 * PATCH /api/drop-points/agents        — Toggle agent active status (Superadmin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { dataService } from '@/lib/data-service';


export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const dropPointId = searchParams.get('dropPointId') || undefined;
    const agents = await dataService.getDropPointAgents(dropPointId);
    return NextResponse.json({ agents });
  } catch (err) {
    console.error('[GET /api/drop-points/agents]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, dropPointId } = body as { name: string; dropPointId: string };

    if (!name?.trim() || !dropPointId?.trim()) {
      return NextResponse.json({ error: 'Nom et point de dépôt requis.' }, { status: 400 });
    }

    const result = await dataService.createDropPointAgent({ name: name.trim(), dropPointId });
    return NextResponse.json({
      success: true,
      agent: result.agent,
      plainPin: result.plainPin,
    });
  } catch (err: any) {
    console.error('[POST /api/drop-points/agents]', err);
    return NextResponse.json({ error: err?.message || 'Erreur interne.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const { agentId, isActive, newPin } = body as { agentId: string; isActive?: boolean; newPin?: string };

    if (!agentId) {
      return NextResponse.json({ error: 'agentId requis.' }, { status: 400 });
    }

    if (newPin) {
      const res = await dataService.resetDropPointAgentPin({ agentId }, newPin);
      return NextResponse.json({
        success: true,
        message: 'Code PIN mis à jour avec succès.',
        agent: res.agent,
        plainPin: res.plainPin,
      });
    }

    if (typeof isActive === 'boolean') {
      await dataService.setDropPointAgentStatus(agentId, isActive);
      return NextResponse.json({ success: true, message: `Statut agent mis à jour.` });
    }

    return NextResponse.json({ error: 'Action non reconnue (isActive ou newPin requis).' }, { status: 400 });
  } catch (err: any) {
    console.error('[PATCH /api/drop-points/agents]', err);
    return NextResponse.json({ error: err?.message || 'Erreur interne.' }, { status: 500 });
  }
}
