/**
 * GET /api/livreur/[id]/dashboard
 * Fetch all packages for a specific driver (either by driverId or driver name)
 * Prevents client-side direct Supabase queries that crash in Next.js + Turbopack.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
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

    const { id: driverId } = await params;

    // Protection IDOR : un livreur ne peut pas espionner les courses d'un autre livreur
    if (session.role === 'livreur' && session.userId !== driverId && session.driverId !== driverId) {
      return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const driverName = searchParams.get('name') || '';

    if (!driverId) {
      return NextResponse.json({ error: 'Driver ID is required' }, { status: 400 });
    }

    // Try by ID first
    let packages = await dataService.getPackagesForDriver(driverId);
    
    // If empty and we have a name, fallback to searching by name
    if (packages.length === 0 && driverName) {
      packages = await dataService.getPackagesForDriver(driverName);
    }

    return NextResponse.json({ success: true, courses: packages });
  } catch (err) {
    console.error('[GET /api/livreur/[id]/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
