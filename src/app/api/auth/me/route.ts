/**
 * GET /api/auth/me
 * Renvoie les informations de la session active, ou 401 si non authentifié.
 * Utilisé par les pages client pour vérifier la session côté serveur.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Non authentifié. Veuillez vous connecter.' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      role: session.role,
      name: session.name,
      email: session.email,
      phone: session.phone,
      agencyId: session.agencyId,
      agencyRole: session.agencyRole || (session.role === 'agence' ? 'directeur' : undefined),
      driverId: session.driverId,
      agentNumber: session.agentNumber,
      dropPointId: session.dropPointId || (session.role === 'point_relais' ? session.agencyId : undefined),
    },
  });
}
