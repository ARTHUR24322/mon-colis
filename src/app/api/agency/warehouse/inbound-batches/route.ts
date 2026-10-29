/**
 * API /api/agency/warehouse/inbound-batches
 * Recherche et consultation des bons de dépôt (Inbound Batches) côté agence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : req.nextUrl.searchParams.get('agencyId');

    if (!agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const searchCode = req.nextUrl.searchParams.get('code')?.trim();
    const token = req.nextUrl.searchParams.get('token')?.trim();
    const status = req.nextUrl.searchParams.get('status');

    let query = supabase
      .from('warehouse_inbound_batches')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (token) {
      query = query.eq('qr_token', token);
    } else if (searchCode) {
      query = query.or(`batch_number.eq.${searchCode},qr_token.eq.${searchCode}`);
    } else if (status) {
      query = query.eq('status', status);
    }

    const { data: batches, error } = await query;

    if (error) {
      console.warn('Agency inbound batches fetch warning:', error.message);
      return NextResponse.json({ batches: [] });
    }

    const rawBatches = batches || [];
    const vendorIds = [...new Set(rawBatches.map(b => b.vendor_id).filter(Boolean))];
    const vendorMap = new Map<string, { name: string; phone: string }>();

    if (vendorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', vendorIds);
      (profiles || []).forEach(p => vendorMap.set(p.id, {
        name: p.name || 'Vendeur',
        phone: p.phone || ''
      }));
    }

    const enriched = rawBatches.map(b => {
      const v = vendorMap.get(b.vendor_id);
      return {
        id: b.id,
        batchNumber: b.batch_number,
        vendorId: b.vendor_id,
        vendorName: v?.name || 'Vendeur Partenaire',
        vendorPhone: v?.phone || '',
        agencyId: b.agency_id,
        status: b.status,
        items: b.items || [],
        totalItemsCount: b.total_items_count,
        receivedItemsCount: b.received_items_count,
        qrToken: b.qr_token,
        depositedAt: b.deposited_at,
        receivedAt: b.received_at,
        receivedBy: b.received_by,
        notes: b.notes,
        createdAt: b.created_at
      };
    });

    return NextResponse.json({ batches: enriched });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/inbound-batches]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
