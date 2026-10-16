import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { getSession } from '@/lib/session-server';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['livreur', 'agence', 'superadmin'].includes(session.role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { colisId, dropPointId, inaccessibilityNote } = body as {
      colisId: string;
      dropPointId: string;
      inaccessibilityNote: string;
    };

    if (!colisId || !dropPointId) {
      return NextResponse.json(
        { error: 'ID du colis et ID du point relais requis.' },
        { status: 400 }
      );
    }

    const res = await dataService.rerouteToDropPoint(
      colisId,
      dropPointId,
      inaccessibilityNote || 'Zone inaccessible / redirection demandée'
    );

    if (!res.success) {
      return NextResponse.json({ error: res.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: res.message,
      package: res.package,
    });
  } catch (error) {
    console.error('Error rerouting package to drop point:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la redirection vers le point relais.' },
      { status: 500 }
    );
  }
}
