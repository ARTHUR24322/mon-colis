/**
 * POST /api/admin/drop-points/agents/reset-pin
 * Permet au Super Admin de changer/réinitialiser le code PIN (6 chiffres) d'un agent de Point Relais.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { getSession } from '@/lib/session-server';
import { dataService } from '@/lib/data-service';
import { logFinancialAudit } from '@/utils/auditLogger';
import { z } from 'zod';

const schema = z.object({
  agentId: z.string().trim().optional(),
  agentNumber: z.string().trim().optional(),
  dropPointId: z.string().trim().optional(),
  newPin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Le code PIN doit comporter exactement 6 chiffres.')
    .optional(),
  reason: z.string().trim().optional(),
  adminPin: z.string().optional(),
});

function verifyAdminPin(pin?: string): boolean {
  if (!pin) return false;
  const correctPin = process.env.ADVANCED_ADMIN_PIN || (process.env.NODE_ENV !== 'production' ? '0000' : null);
  return Boolean(correctPin && pin === correctPin);
}

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession();
    const mcSession = await getSession();

    const isSuperAdmin =
      adminSession?.role === 'superadmin' ||
      mcSession?.role === 'superadmin';

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Action strictement réservée au Super Admin.' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides.' },
        { status: 400 }
      );
    }

    const { agentId, agentNumber, dropPointId, newPin, reason, adminPin } = parsed.data;

    if (!agentId && !agentNumber && !dropPointId) {
      return NextResponse.json(
        { error: 'Veuillez spécifier un identifiant d\'agent (agentId, agentNumber) ou de point relais (dropPointId).' },
        { status: 400 }
      );
    }

    if (adminPin && !verifyAdminPin(adminPin)) {
      return NextResponse.json(
        { error: 'Code PIN de confirmation Super Admin incorrect.' },
        { status: 401 }
      );
    }

    const result = await dataService.resetDropPointAgentPin(
      { agentId, agentNumber, dropPointId },
      newPin
    );

    const adminName = adminSession?.email || mcSession?.name || 'Super Admin';

    try {
      await logFinancialAudit({
        action_type: 'DROP_POINT_PIN_RESET',
        actor_name: adminName,
        target_name: result.agent.dropPointName,
        notes: `Changement code PIN connexion (6 chiffres) pour l'agent #${result.agent.agentNumber} (${result.agent.name}) du Point Relais "${result.agent.dropPointName}". Motif: ${reason || 'Réinitialisation Super Admin'}`,
        status: 'COMPLETED',
      });
    } catch (e) {
      console.warn('[agents/reset-pin] Audit log warning:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Code PIN à 6 chiffres mis à jour avec succès pour ${result.agent.name} (#${result.agent.agentNumber}).`,
      agent: result.agent,
      plainPin: result.plainPin,
    });
  } catch (err: any) {
    console.error('[POST /api/admin/drop-points/agents/reset-pin]', err);
    return NextResponse.json(
      { error: err?.message || 'Erreur interne lors de la mise à jour du code PIN.' },
      { status: 500 }
    );
  }
}

