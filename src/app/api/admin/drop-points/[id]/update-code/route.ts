/**
 * POST /api/admin/drop-points/[id]/update-code
 * Permet au Super Admin de modifier le code affiché d'un point relais (ex: DP-GOM-2778 -> DP-GOM-9999).
 * Règles de sécurité :
 *   - L'identifiant interne reste immuable (clé primaire 'id' intacte)
 *   - Unicité stricte du nouveau code (vérifié en DB)
 *   - Historique conservé dans drop_point_code_history
 *   - Journalisation dans les audits
 *   - Confirmation préalable de sécurité requise (PIN ou mot de passe admin)
 *   - Notification envoyée au gérant du point relais
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import { logFinancialAudit } from '@/utils/auditLogger';
import { z } from 'zod';

const updateCodeSchema = z.object({
  newCode: z.string().trim().min(3, 'Le nouveau code doit comporter au moins 3 caractères.')
    .regex(/^DP-[A-Z]{3,4}-[0-9A-Z]{3,6}$/i, 'Format de code recommandé : DP-COMMUNE-1234 (ex: DP-GOM-2778)'),
  reason: z.string().trim().min(3, 'Un motif de changement est obligatoire.'),
  adminPin: z.string().min(4, 'Confirmation de sécurité par PIN admin requise.'),
});

function verifyAdminPin(pin: string): boolean {
  const correctPin = process.env.ADVANCED_ADMIN_PIN || (process.env.NODE_ENV !== 'production' ? '0000' : null);
  return Boolean(correctPin && pin === correctPin);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await requireAdminSession();
    const mcSession = await getSession();

    const isSuperAdmin =
      adminSession?.role === 'superadmin' ||
      mcSession?.role === 'superadmin';

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Action strictement réservée au Super Admin.' }, { status: 403 });
    }

    const { id: dropPointId } = await params;
    const body = await request.json();
    const parsed = updateCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides.' },
        { status: 400 }
      );
    }

    const { newCode, reason, adminPin } = parsed.data;

    // 1. Vérification de sécurité (PIN Super Admin)
    if (!verifyAdminPin(adminPin)) {
      return NextResponse.json(
        { error: 'Code PIN de confirmation Super Admin incorrect.' },
        { status: 401 }
      );
    }

    // 2. Vérifier l'existence du point relais
    const { data: dp, error: dpErr } = await supabase
      .from('drop_points')
      .select('id, code, name, phone, manager_name')
      .eq('id', dropPointId)
      .maybeSingle();

    if (dpErr || !dp) {
      return NextResponse.json({ error: 'Point relais introuvable.' }, { status: 404 });
    }

    const currentCode = dp.code || dp.id;
    const normalizedNewCode = newCode.toUpperCase();

    if (currentCode === normalizedNewCode) {
      return NextResponse.json(
        { error: 'Le nouveau code est identique au code actuel.' },
        { status: 400 }
      );
    }

    // 3. Vérifier l'unicité du nouveau code
    const { data: existingWithCode } = await supabase
      .from('drop_points')
      .select('id, name')
      .or(`code.eq.${normalizedNewCode},id.eq.${normalizedNewCode}`)
      .neq('id', dropPointId)
      .maybeSingle();

    if (existingWithCode) {
      return NextResponse.json(
        { error: `Ce code (${normalizedNewCode}) est déjà attribué au point relais "${existingWithCode.name}".` },
        { status: 409 }
      );
    }

    // 4. Mettre à jour le code affiché
    const { error: updateErr } = await supabase
      .from('drop_points')
      .update({
        code: normalizedNewCode,
      })
      .eq('id', dropPointId);

    if (updateErr) {
      return NextResponse.json({ error: `Erreur lors de la mise à jour : ${updateErr.message}` }, { status: 500 });
    }

    // 5. Enregistrer l'ancien code dans l'historique
    const adminName = adminSession?.email || mcSession?.name || 'Super Admin';
    await supabase.from('drop_point_code_history').insert({
      drop_point_id: dropPointId,
      old_code: currentCode,
      new_code: normalizedNewCode,
      changed_by_name: adminName,
      reason,
    });

    // 6. Journaliser dans l'audit
    try {
      await logFinancialAudit({
        action_type: 'DROP_POINT_CODE_MODIFIED',
        actor_name: adminName,
        target_name: dp.name,
        notes: `Changement code point relais ${dp.name} : ${currentCode} → ${normalizedNewCode}. Motif: ${reason}`,
        status: 'COMPLETED',
      });
    } catch (e) {
      console.warn('[update-code] Audit error:', e);
    }

    // 7. Notification au gérant du point relais
    // Trouver les agents rattachés à ce drop point
    const { data: agents } = await supabase
      .from('drop_point_agents')
      .select('id, name')
      .eq('drop_point_id', dropPointId);

    if (agents && agents.length > 0) {
      for (const ag of agents) {
        await supabase.from('notifications').insert({
          user_id: ag.id,
          type: 'INFO',
          message: `Le code de votre point relais (${dp.name}) a été mis à jour par le Super Admin : ${normalizedNewCode} (ancien : ${currentCode}).`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Code du point relais modifié avec succès (${currentCode} → ${normalizedNewCode}).`,
      oldCode: currentCode,
      newCode: normalizedNewCode,
    });
  } catch (err: any) {
    console.error('[POST /api/admin/drop-points/[id]/update-code]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
