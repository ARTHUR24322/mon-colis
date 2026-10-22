import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    // Identifiant cible : peut être userId, agencyId ou driverId
    const targetIds = [session.userId];
    if (session.agencyId) targetIds.push(session.agencyId);
    if (session.driverId) targetIds.push(session.driverId);

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, type, read, link, metadata, created_at')
      .in('user_id', targetIds)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      // Si la table n'est pas encore créée en local ou distant, retourner liste vide
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const unreadCount = (notifications || []).filter(n => !n.read).length;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (err) {
    console.error('[GET /api/notifications]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, all } = body;

    const targetIds = [session.userId];
    if (session.agencyId) targetIds.push(session.agencyId);
    if (session.driverId) targetIds.push(session.driverId);

    if (all) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .in('user_id', targetIds)
        .eq('read', false);
    } else if (id) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .in('user_id', targetIds);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/notifications]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
