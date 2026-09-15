/**
 * POST /api/drop-points/vendor-deposit/assign
 * Body: { pickupCode, agencyId }
 * Assigns an agency to collect a vendor deposit. Updates deposit status to AGENCY_ASSIGNED.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const { pickupCode, agencyId } = await request.json() as {
      pickupCode: string;
      agencyId: string;
    };

    if (!pickupCode || !agencyId) {
      return NextResponse.json(
        { error: 'pickupCode et agencyId sont requis.' },
        { status: 400 }
      );
    }

    const result = dataService.assignVendorDepositToAgency(pickupCode, agencyId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deposit: result.deposit, message: result.message });
  } catch (err) {
    console.error('[POST /api/drop-points/vendor-deposit/assign]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
