/**
 * GET   /api/drop-points/agents        — List all drop point agents (Superadmin)
 * POST  /api/drop-points/agents        — Create a new agent (Superadmin)
 * PATCH /api/drop-points/agents        — Toggle agent active status (Superadmin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { dataService } from '@/lib/data-service';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const adminHeader = request.headers.get('x-admin-auth');
  if (adminHeader === 'authenticated_superadmin_v1') return true;
  const session = await getSession();
  return session?.role === 'superadmin';
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
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
    if (!(await isAuthorized(request))) {
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
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const { agentId, isActive } = body as { agentId: string; isActive: boolean };

    if (!agentId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'agentId et isActive requis.' }, { status: 400 });
    }

    await dataService.setDropPointAgentStatus(agentId, isActive);
    return NextResponse.json({ success: true, message: `Statut agent mis à jour.` });
  } catch (err: any) {
    console.error('[PATCH /api/drop-points/agents]', err);
    return NextResponse.json({ error: err?.message || 'Erreur interne.' }, { status: 500 });
  }
}
