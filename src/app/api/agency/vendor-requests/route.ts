/**
 * GET /api/agency/vendor-requests
 * Retourne toutes les demandes de versement des vendeurs pour l'agence connectée.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data: requests, error } = await supabase
      .from('vendor_payment_requests')
      .select(`
        id,
        vendor_id,
        amount,
        status,
        message,
        reject_reason,
        created_at,
        resolved_at
      `)
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Vendor requests fetch error:', error);
      return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
    }

    // Récupérer les profils des vendeurs et les OTPs actifs
    let enrichedRequests = requests ?? [];
    if (enrichedRequests.length > 0) {
      const vendorIds = [...new Set(enrichedRequests.map(r => r.vendor_id))];
      
      const [{ data: profiles }, { data: activeOtps }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, phone')
          .in('id', vendorIds),
        supabase
          .from('payment_otps')
          .select('id, vendor_id, amount, expires_at, created_at')
          .eq('agency_id', session.agencyId)
          .eq('used', false)
          .gte('expires_at', new Date().toISOString())
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const otpMap = new Map((activeOtps || []).map(o => [o.vendor_id, o]));
      
      enrichedRequests = enrichedRequests.map(req => ({
        ...req,
        vendor: profileMap.get(req.vendor_id) || { name: 'Vendeur Inconnu', phone: '' },
        activeOtp: otpMap.get(req.vendor_id) || null
      }));
    }

    // Marquer les PENDING comme SEEN (l'agence les a vus)
    const pendingIds = (requests ?? [])
      .filter(r => r.status === 'PENDING')
      .map(r => r.id);

    if (pendingIds.length > 0) {
      await supabase
        .from('vendor_payment_requests')
        .update({ status: 'SEEN' })
        .in('id', pendingIds);
    }

    const pendingCount = enrichedRequests.filter(r => r.status === 'PENDING').length;

    return NextResponse.json({ requests: enrichedRequests, pendingCount });
  } catch (err) {
    console.error('[GET /api/agency/vendor-requests]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
