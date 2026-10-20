/**
 * POST /api/vendor/payments/request
 * Le vendeur soumet une demande de versement à une agence.
 * Body: { agencyId, amount, message? }
 *
 * GET /api/vendor/payments/request
 * Historique des demandes du vendeur connecté.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { agencyId, amount, message } = await request.json();
    if (!agencyId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Agence et montant requis.' }, { status: 400 });
    }

    // Auto-expirer les demandes PENDING/SEEN de plus d'1 heure (déblocage automatique)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('vendor_payment_requests')
      .update({ status: 'EXPIRED' })
      .eq('vendor_id', session.userId)
      .eq('agency_id', agencyId)
      .in('status', ['PENDING', 'SEEN'])
      .lt('created_at', oneHourAgo);

    // Vérifier qu'il n'y a pas déjà une demande en cours (PENDING ou SEEN) pour cette agence
    const { data: existing } = await supabase
      .from('vendor_payment_requests')
      .select('id')
      .eq('vendor_id', session.userId)
      .eq('agency_id', agencyId)
      .in('status', ['PENDING', 'SEEN'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: 'Vous avez déjà une demande en attente de traitement auprès de cette agence. Réessayez dans 1 heure ou attendez la réponse de votre agence.'
      }, { status: 409 });
    }

    const { data: req, error: insertErr } = await supabase
      .from('vendor_payment_requests')
      .insert({
        vendor_id: session.userId,
        agency_id: agencyId,
        amount,
        message: message || null,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (insertErr || !req) {
      console.error('Vendor request insert error:', insertErr);
      return NextResponse.json({ error: 'Erreur lors de la création de la demande.' }, { status: 500 });
    }

    // Notifier l'agence de la demande de versement
    try {
      const { data: vendorProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.userId)
        .maybeSingle();

      const vendorName = vendorProfile?.name || session.name || 'Un vendeur';
      await supabase.from('notifications').insert({
        user_id: agencyId,
        type: 'VENDOR_PAYMENT_REQUESTED',
        message: `Demande de versement de ${amount.toLocaleString('fr-FR')} CDF de ${vendorName}`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (notifErr) {
      console.warn('Erreur notification agence:', notifErr);
    }

    return NextResponse.json({ success: true, requestId: req.id });
  } catch (err) {
    console.error('[POST /api/vendor/payments/request]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const [{ data: requests, error }, { data: activeOtps }] = await Promise.all([
      supabase
        .from('vendor_payment_requests')
        .select('id, agency_id, amount, status, message, reject_reason, created_at, resolved_at')
        .eq('vendor_id', session.userId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('payment_otps')
        .select('id, agency_id, amount, expires_at, created_at')
        .eq('vendor_id', session.userId)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
    ]);

    if (error) {
      console.error('Vendor requests GET error:', error);
      return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
    }

    const otpMap = new Map((activeOtps || []).map(o => [o.agency_id, o]));
    const enriched = (requests ?? []).map(r => ({
      ...r,
      activeOtp: otpMap.get(r.agency_id) || null
    }));

    return NextResponse.json({ requests: enriched, activeOtps: activeOtps ?? [] });
  } catch (err) {
    console.error('[GET /api/vendor/payments/request]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
