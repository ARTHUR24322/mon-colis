/**
 * POST /api/drop-points/vendor-deposit
 * Body: { dropPointId, vendeurName, vendeurPhone, clientName, clientPhone, clientAddress, description? }
 * Creates a vendor deposit record and returns the pickup code.
 *
 * GET /api/drop-points/vendor-deposit?dropPointId=xxx
 * Returns all vendor deposits for a drop point.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      dropPointId: string;
      vendeurName: string;
      vendeurPhone: string;
      clientName: string;
      clientPhone: string;
      clientAddress: string;
      description?: string;
    };

    const { dropPointId, vendeurName, vendeurPhone, clientName, clientPhone, clientAddress } = body;

    if (!dropPointId || !vendeurName || !vendeurPhone || !clientName || !clientPhone || !clientAddress) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être remplis.' },
        { status: 400 }
      );
    }

    const deposit = await dataService.createVendorDeposit({
      dropPointId,
      vendeurName: vendeurName.trim(),
      vendeurPhone: vendeurPhone.trim(),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientAddress: clientAddress.trim(),
      description: body.description?.trim(),
    });

    return NextResponse.json({ success: true, deposit });
  } catch (err) {
    console.error('[POST /api/drop-points/vendor-deposit]', err);
    const message = err instanceof Error ? err.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const dropPointId = request.nextUrl.searchParams.get('dropPointId');
    if (!dropPointId) {
      return NextResponse.json({ error: 'dropPointId requis.' }, { status: 400 });
    }

    const deposits = await dataService.getVendorDepositsForDropPoint(dropPointId);
    return NextResponse.json({ success: true, deposits });
  } catch (err) {
    console.error('[GET /api/drop-points/vendor-deposit]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
