/**
 * GET /api/agency/cash-requests
 * Retourne toutes les demandes de versement des livreurs pour l'agence connectée.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data: requests, error } = await supabase
      .from('driver_cash_requests')
      .select(`
        id,
        driver_id,
        amount,
        status,
        note,
        reject_reason,
        created_at,
        resolved_at,
        driver:drivers(phone, profile:profiles(name))
      `)
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Cash requests fetch error:', error);
      return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
    }

    const pendingCount = (requests ?? []).filter(r => r.status === 'PENDING').length;

    return NextResponse.json({ requests: requests ?? [], pendingCount });
  } catch (err) {
    console.error('[GET /api/agency/cash-requests]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
