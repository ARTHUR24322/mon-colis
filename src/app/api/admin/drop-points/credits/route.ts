/**
 * POST /api/admin/drop-points/credits
 * Superadmin recharge les crédits d'un Point Relais
 * Body: { dropPointId, amount }
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';
import { requireAdminSession } from '@/lib/adminSession';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { logFinancialAudit } from '@/utils/auditLogger';

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession();
    const mcSession = await getSession();

    const isSuperAdmin =
      adminSession?.role === 'superadmin' ||
      mcSession?.role === 'superadmin';

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Non autorisé. Session Super Admin requise.' }, { status: 401 });
    }

    const body = await request.json();
    const { dropPointId, amount } = body;

    const parsedAmount = typeof amount === 'number' ? amount : parseInt(String(amount || '0'), 10);

    if (!dropPointId || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'dropPointId et montant valide (> 0) sont requis.' }, { status: 400 });
    }

    // 1. Récupérer le point relais en base via supabaseAdmin (bypasse RLS)
    const { data: dp, error: fetchErr } = await supabaseAdmin
      .from('drop_points')
      .select('id, name, credits, code')
      .or(`id.eq.${dropPointId},code.eq.${dropPointId}`)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error('[credits] fetch drop_point error:', fetchErr);
    }

    const targetId = dp?.id || dropPointId;
    const currentCredits = Number(dp?.credits || 0);
    const newCredits = currentCredits + parsedAmount;

    // 2. Mettre à jour en base avec supabaseAdmin
    const { error: updateErr } = await supabaseAdmin
      .from('drop_points')
      .update({ credits: newCredits })
      .eq('id', targetId);

    if (updateErr) {
      console.error('[credits] update drop_point error:', updateErr);
      return NextResponse.json({ error: `Erreur lors de la mise à jour des crédits en base : ${updateErr.message}` }, { status: 500 });
    }

    // 3. Mettre à jour dans dataService (cache mémoire)
    await dataService.addDropPointCredits(targetId, parsedAmount);

    // 4. Journaliser dans les audits financiers
    const adminName = adminSession?.email || mcSession?.name || 'Super Admin';
    try {
      await logFinancialAudit({
        action_type: 'CREDIT_RECHARGE',
        actor_name: adminName,
        target_name: dp?.name || targetId,
        amount_usd: 0,
        notes: `Recharge de +${parsedAmount} crédits pour le Point Relais "${dp?.name || targetId}". Ancien solde : ${currentCredits}, Nouveau solde : ${newCredits} crédits.`,
        status: 'COMPLETED',
      });
    } catch (e) {
      console.warn('[credits] Audit error:', e);
    }

    return NextResponse.json({
      success: true,
      dropPointId: targetId,
      creditsAdded: parsedAmount,
      newCredits,
      message: `+${parsedAmount} crédits ajoutés avec succès à ${dp?.name || 'Point Relais'}.`,
    });
  } catch (err: any) {
    console.error('[POST /api/admin/drop-points/credits]', err);
    return NextResponse.json({ error: err?.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}
