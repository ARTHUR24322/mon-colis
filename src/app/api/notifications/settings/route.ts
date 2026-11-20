/**
 * GET & PATCH /api/notifications/settings
 * Gestion des préférences d'alertes Telegram pour le Super Admin et les membres d'agence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import {
  getAllowedEventsForUser,
  NotificationEventType,
} from '@/types/telegram-notifications';
import { AgencyRole } from '@/lib/agencyPermissions';

function resolveUser(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return null;
  if (session.role === 'superadmin') {
    return {
      userId: 'superadmin-master-id',
      isSuperAdmin: true,
      agencyRole: null,
      agencyId: null,
    };
  }
  if (session.role === 'agence') {
    return {
      userId: session.userId,
      isSuperAdmin: false,
      agencyRole: (session.agencyRole as AgencyRole) || 'directeur',
      agencyId: session.agencyId || null,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET : Récupérer canal et préférences
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const session = await getSession();
    const user = resolveUser(session);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }

    // 1. Canal Telegram
    const { data: channel } = await supabaseAdmin
      .from('notification_channels')
      .select('id, enabled, verified_at, created_at')
      .eq('user_id', user.userId)
      .eq('channel', 'telegram')
      .maybeSingle();

    // 2. Événements autorisés selon le rôle
    const allowedEvents = getAllowedEventsForUser({
      isSuperAdmin: user.isSuperAdmin,
      agencyRole: user.agencyRole,
    });

    // 3. Préférences enregistrées
    const { data: savedPrefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('event_type, enabled')
      .eq('user_id', user.userId);

    const prefMap = new Map<string, boolean>();
    (savedPrefs || []).forEach((p) => {
      prefMap.set(p.event_type, p.enabled);
    });

    const eventsWithStatus = allowedEvents.map((evt) => ({
      type: evt.type,
      label: evt.label,
      description: evt.description,
      target: evt.target,
      enabled: prefMap.has(evt.type) ? prefMap.get(evt.type)! : evt.defaultEnabled,
    }));

    return NextResponse.json({
      channel: {
        linked: !!channel && channel.enabled && !!channel.verified_at,
        verified_at: channel?.verified_at ?? null,
        enabled: channel?.enabled ?? false,
      },
      events: eventsWithStatus,
    });
  } catch (err) {
    console.error('[GET /api/notifications/settings]', err);
    return NextResponse.json({ error: 'Erreur chargement réglages.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH : Sauvegarder les préférences
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    const user = resolveUser(session);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body as { preferences: Record<NotificationEventType, boolean> };

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Format de préférences invalide.' }, { status: 400 });
    }

    // Filtrer pour n'autoriser que les types autorisés pour ce rôle
    const allowedEvents = getAllowedEventsForUser({
      isSuperAdmin: user.isSuperAdmin,
      agencyRole: user.agencyRole,
    });
    const allowedTypes = new Set(allowedEvents.map((e) => e.type));

    const rowsToUpsert = Object.entries(preferences)
      .filter(([type]) => allowedTypes.has(type as NotificationEventType))
      .map(([type, enabled]) => ({
        user_id: user.userId,
        event_type: type,
        enabled: Boolean(enabled),
        updated_at: new Date().toISOString(),
      }));

    if (rowsToUpsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('notification_preferences')
        .upsert(rowsToUpsert, {
          onConflict: 'user_id,event_type',
        });

      if (error) {
        console.error('[PATCH /api/notifications/settings] error:', error);
        return NextResponse.json({ error: 'Erreur lors de la sauvegarde.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/notifications/settings]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
