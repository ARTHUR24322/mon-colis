import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminSession } from '@/lib/adminSession';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all drivers with their profiles and agency names
    const { data: drivers, error: driverErr } = await supabaseAdmin
      .from('drivers')
      .select(`
        id,
        profiles!drivers_id_fkey ( name, email ),
        agencies ( name )
      `);

    if (driverErr) throw driverErr;

    // 2. Fetch all delivered packages that were paid by client
    const { data: packages, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select('driver_id, item_price, delivery_price, status, is_prepaid')
      .eq('status', 'Livré');

    if (pkgErr) throw pkgErr;

    // 3. Fetch all PAID cash requests from drivers
    const { data: requests, error: reqErr } = await supabaseAdmin
      .from('driver_cash_requests')
      .select('driver_id, amount, status')
      .eq('status', 'PAID');

    if (reqErr) throw reqErr;

    // 4. Compute reconciliation for each driver
    const reconciliationData = drivers.map(d => {
      const driverId = d.id;
      const driverProfile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
      const driverName = driverProfile?.name || 'Livreur Inconnu';
      const agencyData = Array.isArray(d.agencies) ? d.agencies[0] : d.agencies;
      const agencyName = agencyData?.name || 'Aucune';

      // Expected Cash
      const driverPackages = packages.filter(p => p.driver_id === driverId);
      const expectedCash = driverPackages.reduce((acc, p) => {
        if (!p.is_prepaid) {
           return acc + (p.item_price || 0) + (p.delivery_price || 0);
        }
        return acc;
      }, 0);

      // Actual Deposited
      const driverDeposits = requests.filter(r => r.driver_id === driverId);
      const actualDeposited = driverDeposits.reduce((acc, r) => acc + (r.amount || 0), 0);

      const ecart = expectedCash - actualDeposited;

      return { driverId, driverName, agencyName, expectedCash, actualDeposited, ecart };
    });

    return NextResponse.json({ success: true, data: reconciliationData });
  } catch (err) {
    console.error('[GET /api/admin/reconciliation]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
