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

    const body = await request.json();
    const agencyId = body.agencyId || body.agency_id;

    if (!agencyId) {
      return NextResponse.json({ error: 'Agence requise.' }, { status: 400 });
    }

    // Récupérer le taux réel de l'agence ou du système
    let effectiveRate = 2400;
    try {
      const { data: ag } = await supabase
        .from('agencies')
        .select('taux_fc')
        .eq('id', agencyId)
        .maybeSingle();

      if (ag?.taux_fc) {
        effectiveRate = Number(ag.taux_fc);
      } else {
        const { data: sys } = await supabase
          .from('system_settings')
          .select('exchange_rate')
          .eq('id', 'global')
          .maybeSingle();
        if (sys?.exchange_rate) effectiveRate = Number(sys.exchange_rate);
      }
    } catch {}

    // Le frontend calcule toujours amountInCdf = amountUsd * rate et l'envoie dans `amount`.
    // Si `amountUsd` est présent et valide, on recalcule pour garantir la cohérence.
    // Si seul `amount` est fourni (déjà en CDF), on l'utilise directement sans reconversion.
    let rawAmount: number;
    if (body.amountUsd && Number(body.amountUsd) > 0) {
      rawAmount = Math.round(Number(body.amountUsd) * effectiveRate);
    } else if (body.amount && Number(body.amount) > 0) {
      rawAmount = Math.round(Number(body.amount)); // déjà en CDF
    } else {
      rawAmount = 0;
    }
    const amount = Math.round(rawAmount);
    const message = body.message;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
    }

    // Si on refait une demande expirée spécifique, supprimer l'ancienne pour qu'elle disparaisse
    if (body.previousRequestId) {
      await supabase
        .from('vendor_payment_requests')
        .delete()
        .eq('id', body.previousRequestId)
        .eq('vendor_id', session.userId);
    }

    // Nettoyer également les anciennes demandes déjà expirées pour cette agence
    await supabase
      .from('vendor_payment_requests')
      .delete()
      .eq('vendor_id', session.userId)
      .eq('agency_id', agencyId)
      .eq('status', 'EXPIRED');

    // Vérifier les demandes actives en cours (PENDING ou SEEN avec OTP valide)
    const { data: existingRequests } = await supabase
      .from('vendor_payment_requests')
      .select('id, status, message, created_at')
      .eq('vendor_id', session.userId)
      .eq('agency_id', agencyId)
      .in('status', ['PENDING', 'SEEN'])
      .order('created_at', { ascending: false });

    // Si une demande existe, vérifier si elle a expiré
    let hasActivePending = false;
    if (existingRequests && existingRequests.length > 0) {
      for (const reqItem of existingRequests) {
        let isExpired = false;
        try {
          if (reqItem.message) {
            const parsed = JSON.parse(reqItem.message);
            if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
              isExpired = true;
            }
          }
        } catch {
          // message standard
        }

        // Si créée il y a plus de 30 minutes sans OTP
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        if (new Date(reqItem.created_at) < thirtyMinsAgo) {
          isExpired = true;
        }

        if (isExpired) {
          await supabase
            .from('vendor_payment_requests')
            .update({ status: 'EXPIRED' })
            .eq('id', reqItem.id);
        } else {
          hasActivePending = true;
        }
      }
    }

    if (hasActivePending) {
      return NextResponse.json({
        error: 'Une demande de versement est déjà en cours auprès de cette agence. Vous pouvez la suivre dans votre écran Virements.'
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

    // Récupérer toutes les demandes (ne disparaissent jamais)
    const { data: requests, error } = await supabase
      .from('vendor_payment_requests')
      .select('id, agency_id, amount, status, message, reject_reason, created_at, resolved_at')
      .eq('vendor_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Vendor requests GET error:', error);
      return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
    }

    const agencyIds = [...new Set((requests ?? []).map(r => r.agency_id).filter(Boolean))];
    const profileMap = new Map<string, { name: string; phone: string }>();
    if (agencyIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', agencyIds);
      (profiles ?? []).forEach(p => profileMap.set(p.id, { name: p.name || 'Agence partenaire', phone: p.phone || '' }));
    }

    const now = new Date();

    // Normalisation des statuts explicites demandés :
    // 'en_attente' | 'qr_genere' | 'confirme' | 'expire' | 'annule'
    const enriched = (requests ?? []).map(r => {
      let explicitStatus: 'en_attente' | 'qr_genere' | 'confirme' | 'expire' | 'annule' = 'en_attente';
      let code: string | null = null;
      let expiresAt: string | null = null;

      try {
        if (r.message && r.message.startsWith('{')) {
          const parsed = JSON.parse(r.message);
          code = parsed.code || null;
          expiresAt = parsed.expiresAt || null;
        }
      } catch {
        // message texte brut
      }

      if (r.status === 'PAID') {
        explicitStatus = 'confirme';
      } else if (r.status === 'REJECTED') {
        explicitStatus = 'annule';
      } else if (r.status === 'EXPIRED') {
        explicitStatus = 'expire';
      } else if (r.status === 'SEEN') {
        const graceLimit = expiresAt ? new Date(new Date(expiresAt).getTime() + 30 * 60 * 1000) : null;
        if (graceLimit && graceLimit < now) {
          explicitStatus = 'expire';
        } else if (code) {
          explicitStatus = 'qr_genere';
        } else {
          explicitStatus = 'en_attente';
        }
      } else {
        explicitStatus = 'en_attente';
      }

      const agencyInfo = profileMap.get(r.agency_id);
      const agencyName = agencyInfo?.name || 'Agence partenaire';
      const agencyPhone = agencyInfo?.phone || '';

      const qrPayload = code ? JSON.stringify({
        type: 'VENDOR_PAYOUT',
        requestId: r.id,
        agencyId: r.agency_id,
        vendorId: session.userId,
        amount: r.amount,
        code,
      }) : null;

      const qrImageUrl = qrPayload
        ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrPayload)}`
        : null;

      return {
        id: r.id,
        agencyId: r.agency_id,
        agencyName,
        agencyPhone,
        amount: r.amount,
        status: explicitStatus,
        rawStatus: r.status,
        code,
        qrPayload,
        qrImageUrl,
        expiresAt,
        rejectReason: r.reject_reason,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
      };
    });

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    console.error('[GET /api/vendor/payments/request]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'vendeur') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID requis.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('vendor_payment_requests')
      .delete()
      .eq('id', id)
      .eq('vendor_id', session.userId);

    if (error) {
      console.error('[DELETE /api/vendor/payments/request] Erreur:', error);
      return NextResponse.json({ error: 'Erreur lors de la suppression.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/vendor/payments/request]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
