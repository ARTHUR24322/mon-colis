/**
 * GET & POST /api/agency/cash-sessions
 * Gestion et archivage certifié des sessions de caisse pour l'agence.
 * Sauvegarde dans agency_cash_sessions et financial_audits avec tolérance de schéma.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    let history: any[] = [];
    let currentSession: any = null;

    // 1. Essayer d'abord la table dédiée agency_cash_sessions
    try {
      const { data: dedicatedSessions, error: dedicatedErr } = await supabaseAdmin
        .from('agency_cash_sessions')
        .select('*')
        .eq('agency_id', session.agencyId)
        .order('opened_at', { ascending: false })
        .limit(60);

      if (!dedicatedErr && dedicatedSessions && dedicatedSessions.length > 0) {
        // Identifier la session ouverte en cours
        const openOne = dedicatedSessions.find(s => s.status === 'OPEN');
        if (openOne) {
          currentSession = {
            isOpen: true,
            id: openOne.id,
            openedAt: openOne.opened_at,
            openedBy: openOne.opened_by,
            openingFundUSD: Number(openOne.opening_fund_usd) || 0,
            openingFundCDF: Number(openOne.opening_fund_cdf) || 0,
            expectedUSD: Number(openOne.expected_usd) || Number(openOne.opening_fund_usd) || 0,
            expectedCDF: Number(openOne.expected_cdf) || Number(openOne.opening_fund_cdf) || 0,
          };
        }

        // Sessions clôturées pour l'historique
        const closed = dedicatedSessions.filter(s => s.status === 'CLOSED');
        history = closed.map(s => ({
          id: s.id,
          reference: s.reference || `PV-${s.id.slice(0, 8).toUpperCase()}`,
          openedAt: s.opened_at,
          closedAt: s.closed_at || s.created_at,
          openedBy: s.opened_by,
          closedBy: s.closed_by || s.opened_by || 'Agent Caisse',
          openingUSD: Number(s.opening_fund_usd) || 0,
          openingCDF: Number(s.opening_fund_cdf) || 0,
          expectedUSD: Number(s.expected_usd) || 0,
          expectedCDF: Number(s.expected_cdf) || 0,
          countedUSD: s.counted_usd != null ? Number(s.counted_usd) : Number(s.expected_usd) || 0,
          countedCDF: s.counted_cdf != null ? Number(s.counted_cdf) : Number(s.expected_cdf) || 0,
          diffUSD: Number(s.diff_usd) || 0,
          diffCDF: Number(s.diff_cdf) || 0,
          reason: s.discrepancy_reason || 'Aucun écart constaté.',
        }));
      }
    } catch {
      // Table non encore présente, continue vers audits
    }

    // 2. Récupérer aussi depuis financial_audits pour garantir un historique rétrocompatible
    try {
      const { data: auditRecords } = await supabaseAdmin
        .from('financial_audits')
        .select('id, reference, notes, created_at, actor_name, amount_usd, amount_cdf, target_id')
        .eq('action_type', 'CASH_SESSION_CLOSED')
        .order('created_at', { ascending: false })
        .limit(50);

      const auditHistory = (auditRecords || [])
        .filter((r: any) => {
          if (r.target_id === session.agencyId) return true;
          if (typeof r.notes === 'string' && r.notes.includes(session.agencyId!)) return true;
          return false;
        })
        .map((r: any) => {
          let parsedNote: any = {};
          try {
            parsedNote = typeof r.notes === 'string' && r.notes.startsWith('{')
              ? JSON.parse(r.notes)
              : {};
          } catch {}

          return {
            id: r.id,
            reference: r.reference || `PV-${r.id.slice(0, 8).toUpperCase()}`,
            closedAt: r.created_at,
            openedAt: parsedNote.openedAt || r.created_at,
            openedBy: parsedNote.openedBy || parsedNote.closedBy || r.actor_name || 'Agent Caisse',
            closedBy: parsedNote.closedBy || r.actor_name || 'Agent Caisse',
            openingUSD: parsedNote.openingUSD ?? 0,
            openingCDF: parsedNote.openingCDF ?? 0,
            expectedUSD: parsedNote.expectedUSD ?? 0,
            expectedCDF: parsedNote.expectedCDF ?? 0,
            countedUSD: parsedNote.countedUSD ?? (Number(r.amount_usd) || 0),
            countedCDF: parsedNote.countedCDF ?? (Number(r.amount_cdf) || 0),
            diffUSD: parsedNote.diffUSD ?? 0,
            diffCDF: parsedNote.diffCDF ?? 0,
            reason: parsedNote.reason || 'Aucun écart constaté.',
          };
        });

      // Fusionner en dédupliquant par reference ou id
      const seen = new Set(history.map(h => h.reference));
      for (const item of auditHistory) {
        if (!seen.has(item.reference)) {
          seen.add(item.reference);
          history.push(item);
        }
      }
    } catch (auditErr) {
      console.warn('[cash-sessions GET audit fallback]', auditErr);
    }

    // Trier du plus récent au plus ancien
    history.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

    return NextResponse.json({ history, currentSession });
  } catch (err) {
    console.error('[GET /api/agency/cash-sessions]', err);
    return NextResponse.json({ error: 'Erreur interne.', history: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, receipt, session: newSession } = body;

    // ── OUVERTURE D'UNE NOUVELLE SESSION ────────────────────────────────
    if (action === 'open' && newSession) {
      try {
        // Clôturer toute session encore 'OPEN' pour cette agence dans agency_cash_sessions
        await supabaseAdmin
          .from('agency_cash_sessions')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
            closed_by: newSession.openedBy || session.name || 'Système',
          })
          .eq('agency_id', session.agencyId)
          .eq('status', 'OPEN');

        // Insérer la nouvelle session ouverte
        await supabaseAdmin
          .from('agency_cash_sessions')
          .insert({
            agency_id: session.agencyId,
            opened_at: newSession.openedAt || new Date().toISOString(),
            opened_by: newSession.openedBy || session.name || 'Agent Caisse',
            opening_fund_usd: newSession.openingFundUSD || 0,
            opening_fund_cdf: newSession.openingFundCDF || 0,
            expected_usd: newSession.expectedUSD || newSession.openingFundUSD || 0,
            expected_cdf: newSession.expectedCDF || newSession.openingFundCDF || 0,
            status: 'OPEN',
            reference: `SESS-${Date.now().toString(36).toUpperCase()}`,
          });
      } catch (tableErr) {
        console.warn('[agency_cash_sessions open insert fallback]', tableErr);
      }

      return NextResponse.json({ success: true });
    }

    // ── CLÔTURE D'UNE SESSION EXISTANTE ─────────────────────────────────
    if (action === 'close' && receipt) {
      const pvReference = receipt.reference || receipt.id || `PV-${Date.now().toString(36).toUpperCase()}`;

      // 1. Tenter la mise à jour / insertion dans agency_cash_sessions
      try {
        // Vérifier s'il y a une session OPEN
        const { data: openRows } = await supabaseAdmin
          .from('agency_cash_sessions')
          .select('id')
          .eq('agency_id', session.agencyId)
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false })
          .limit(1);

        if (openRows && openRows.length > 0) {
          await supabaseAdmin
            .from('agency_cash_sessions')
            .update({
              status: 'CLOSED',
              reference: pvReference,
              closed_at: receipt.closedAt || new Date().toISOString(),
              closed_by: receipt.closedBy || session.name || 'Agent Caisse',
              expected_usd: receipt.expectedUSD || 0,
              expected_cdf: receipt.expectedCDF || 0,
              counted_usd: receipt.countedUSD || 0,
              counted_cdf: receipt.countedCDF || 0,
              diff_usd: receipt.diffUSD || 0,
              diff_cdf: receipt.diffCDF || 0,
              discrepancy_reason: receipt.reason || '',
            })
            .eq('id', openRows[0].id);
        } else {
          // Insérer directement la session clôturée
          await supabaseAdmin
            .from('agency_cash_sessions')
            .insert({
              agency_id: session.agencyId,
              reference: pvReference,
              opened_at: receipt.openedAt || new Date().toISOString(),
              opened_by: receipt.openedBy || receipt.closedBy || 'Agent Caisse',
              closed_at: receipt.closedAt || new Date().toISOString(),
              closed_by: receipt.closedBy || session.name || 'Agent Caisse',
              opening_fund_usd: receipt.openingUSD || 0,
              opening_fund_cdf: receipt.openingCDF || 0,
              expected_usd: receipt.expectedUSD || 0,
              expected_cdf: receipt.expectedCDF || 0,
              counted_usd: receipt.countedUSD || 0,
              counted_cdf: receipt.countedCDF || 0,
              diff_usd: receipt.diffUSD || 0,
              diff_cdf: receipt.diffCDF || 0,
              discrepancy_reason: receipt.reason || '',
              status: 'CLOSED',
            });
        }
      } catch (errTable) {
        console.warn('[agency_cash_sessions close update error]', errTable);
      }

      // 2. Archiver dans financial_audits (immuable)
      try {
        // Vérifier si target_id et actor_id existent dans profiles pour éviter toute violation de clé étrangère
        let validTargetId: string | null = null;
        let validActorId: string | null = null;

        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', session.agencyId)
          .maybeSingle();
        if (targetProfile) validTargetId = targetProfile.id;

        const { data: actorProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', session.userId)
          .maybeSingle();
        if (actorProfile) validActorId = actorProfile.id;

        const auditPayload = {
          idempotency_key: `CASH-CLOSE-${session.agencyId}-${Date.now()}`,
          action_type: 'CASH_SESSION_CLOSED',
          amount_usd: receipt.countedUSD || 0,
          amount_cdf: receipt.countedCDF || 0,
          exchange_rate_applied: 2400,
          actor_id: validActorId,
          actor_name: receipt.closedBy || session.name || 'Agent Caisse',
          target_id: validTargetId,
          target_name: session.name || 'Agence',
          target_role: 'agence',
          status: 'COMPLETED',
          reference: pvReference,
          notes: JSON.stringify({
            agencyId: session.agencyId,
            reference: pvReference,
            openedAt: receipt.openedAt,
            closedAt: receipt.closedAt,
            openedBy: receipt.openedBy || receipt.closedBy,
            closedBy: receipt.closedBy,
            openingUSD: receipt.openingUSD,
            openingCDF: receipt.openingCDF,
            expectedUSD: receipt.expectedUSD,
            expectedCDF: receipt.expectedCDF,
            countedUSD: receipt.countedUSD,
            countedCDF: receipt.countedCDF,
            diffUSD: receipt.diffUSD,
            diffCDF: receipt.diffCDF,
            reason: receipt.reason,
          }),
        };

        await supabaseAdmin.from('financial_audits').insert(auditPayload);
      } catch (auditErr) {
        console.warn('[financial_audits cash-session close error]', auditErr);
      }

      return NextResponse.json({ success: true, reference: pvReference });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/agency/cash-sessions]', err);
    return NextResponse.json({ error: 'Erreur enregistrement session.' }, { status: 500 });
  }
}
