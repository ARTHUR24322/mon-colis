/**
 * GET /api/drop-points/[id]/dashboard
 * Returns all dashboard data for a drop point.
 * Uses dataService so packageMetaCache (in-memory status overrides) are respected.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { supabase } from '@/utils/supabase/client';
import { getSession } from '@/lib/session-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { id: dropPointId } = await params;
    if (!dropPointId) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

    // Use dataService so packageMetaCache status overrides are respected
    const [incomingVendor, incomingDriver, available, vendorDeposits, dpRes, agentRes] = await Promise.all([
      dataService.getIncomingVendorPackagesForDropPoint(dropPointId),
      dataService.getIncomingDriverPackagesForDropPoint(dropPointId),
      dataService.getAvailablePackagesForDropPoint(dropPointId),
      dataService.getVendorDepositsForDropPoint(dropPointId),
      supabase.from('drop_points')
        .select('id, name, credits, commune, address, phone, manager_name')
        .eq('id', dropPointId)
        .single(),
      supabase.from('drop_point_agents')
        .select('id, agent_number, name')
        .eq('drop_point_id', dropPointId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const agentNumber = agentRes.data?.agent_number || session.agentNumber || null;

    return NextResponse.json({
      success: true,
      incomingVendor,
      incomingDriver,
      available,
      vendorDeposits,
      dropPoint: dpRes.data ? {
        id: dpRes.data.id,
        name: dpRes.data.name,
        credits: dpRes.data.credits ?? 0,
        commune: dpRes.data.commune,
        address: dpRes.data.address,
        phone: dpRes.data.phone,
        managerName: dpRes.data.manager_name,
        agentNumber: agentNumber,
      } : null,
    });
  } catch (err) {
    console.error('[GET /api/drop-points/[id]/dashboard]', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
