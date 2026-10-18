/**
 * POST /api/admin/drop-points/[id]/regenerate-qr
 * Permet au Super Admin de régénérer un nouveau QR Code avec un jeton cryptographique aléatoire non devinable.
 * Invalide immédiatement l'ancien QR code.
 * Exige confirmation de sécurité (PIN Super Admin).
 * Journalise l'audit et notifie le gérant du point relais.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import { logFinancialAudit } from '@/utils/auditLogger';
import crypto from 'crypto';
import { z } from 'zod';

const regenSchema = z.object({
  adminPin: z.string().min(4, 'Code PIN Super Admin requis.'),
  reason: z.string().optional(),
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
    const parsed = regenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides.' },
        { status: 400 }
      );
    }

    const { adminPin, reason } = parsed.data;

    // 1. Vérification PIN
    if (!verifyAdminPin(adminPin)) {
      return NextResponse.json(
        { error: 'Code PIN de confirmation Super Admin incorrect.' },
        { status: 401 }
      );
    }

    // 2. Vérifier le point relais
    const { data: dp, error: dpErr } = await supabase
      .from('drop_points')
      .select('id, code, name, phone, qr_token')
      .eq('id', dropPointId)
      .maybeSingle();

    if (dpErr || !dp) {
      return NextResponse.json({ error: 'Point relais introuvable.' }, { status: 404 });
    }

    const oldToken = dp.qr_token || 'AUCUN';

    // 3. Générer un nouveau jeton aléatoire cryptographique non devinable (32 octets hex)
    const randomHex = crypto.randomBytes(24).toString('hex');
    const newQrToken = `MCL-DP-${(dp.code || dp.id).replace(/[^A-Z0-9]/gi, '')}-${randomHex}`;
    const rotatedAt = new Date().toISOString();

    // 4. Mettre à jour en base
    const { error: updateErr } = await supabase
      .from('drop_points')
      .update({
        qr_token: newQrToken,
        qr_rotated_at: rotatedAt,
      })
      .eq('id', dropPointId);

    if (updateErr) {
      return NextResponse.json({ error: `Erreur lors de la rotation du QR : ${updateErr.message}` }, { status: 500 });
    }

    // 5. Journaliser l'audit
    const adminName = adminSession?.email || mcSession?.name || 'Super Admin';
    try {
      await logFinancialAudit({
        action_type: 'DROP_POINT_QR_REGENERATED',
        actor_name: adminName,
        target_name: dp.name,
        notes: `Régénération QR Code pour ${dp.name} (${dp.code || dp.id}). Ancien token invalidé. Motif : ${reason || 'Rotation de sécurité'}`,
        status: 'COMPLETED',
      });
    } catch (e) {
      console.warn('[regenerate-qr] Audit log error:', e);
    }

    // 6. Notification aux agents du point relais
    const { data: agents } = await supabase
      .from('drop_point_agents')
      .select('id')
      .eq('drop_point_id', dropPointId);

    if (agents && agents.length > 0) {
      for (const ag of agents) {
        await supabase.from('notifications').insert({
          user_id: ag.id,
          type: 'WARNING',
          message: `Un nouveau QR Code officiel a été généré pour votre point relais (${dp.name}). L'ancien QR Code est immédiatement désactivé. Veuillez imprimer le nouveau QR Code depuis votre espace.`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Nouveau QR Code généré avec succès. L\'ancien QR code a été révoqué immédiatement.',
      dropPointId,
      dropPointName: dp.name,
      dropPointCode: dp.code || dp.id,
      newQrToken,
      qrRotatedAt: rotatedAt,
    });
  } catch (err: any) {
    console.error('[POST /api/admin/drop-points/[id]/regenerate-qr]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
