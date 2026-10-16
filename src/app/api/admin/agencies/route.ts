import { NextRequest, NextResponse } from 'next/server';
import { dataService, AgencyStatus } from '@/lib/data-service';
import { requireAdminSession } from '@/lib/adminSession';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as AgencyStatus | null;

    const agencies = await dataService.getAgencies(statusParam || undefined);
    return NextResponse.json({ success: true, agencies });
  } catch (error) {
    console.error('Error fetching admin agencies:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des agences.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { agencyId, action, reason } = body as {
      agencyId: string;
      action: 'APPROVE' | 'REJECT' | 'SUSPEND';
      reason?: string;
    };

    if (!agencyId || !action) {
      return NextResponse.json({ error: 'Identifiant agence et action requis.' }, { status: 400 });
    }

    if (action === 'APPROVE') {
      await dataService.approveAgency(agencyId);
      return NextResponse.json({
        success: true,
        message: "L'agence a été approuvée avec succès. Elle peut désormais se connecter et opérer.",
      });
    }

    if (action === 'REJECT') {
      await dataService.rejectAgency(agencyId, reason);
      return NextResponse.json({
        success: true,
        message: "La demande d'adhésion de l'agence a été rejetée.",
      });
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (error) {
    console.error('Error processing agency action:', error);
    return NextResponse.json({ error: 'Erreur lors du traitement de la demande.' }, { status: 500 });
  }
}
