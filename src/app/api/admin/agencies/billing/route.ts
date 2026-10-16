import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { requireAdminSession } from '@/lib/adminSession';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { agencyId, billingType, billingValue } = body;

    if (!agencyId || !billingType || typeof billingValue !== 'number') {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    await dataService.updateAgencyBilling(agencyId, billingType, billingValue);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[agency-billing] handler error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
