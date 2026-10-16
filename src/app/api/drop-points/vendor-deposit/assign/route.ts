/**
 * POST /api/drop-points/vendor-deposit/assign
 * Body: { colisId, agencyId }
 * Assigns an agency to collect a vendor deposit (DB-backed via colisId).
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const { colisId, agencyId } = await request.json() as {
      colisId: string;
      agencyId: string;
    };

    if (!colisId || !agencyId) {
      return NextResponse.json(
        { error: 'colisId et agencyId sont requis.' },
        { status: 400 }
      );
    }

    const result = await dataService.assignVendorDepositToAgency(colisId, agencyId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[POST /api/drop-points/vendor-deposit/assign]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
