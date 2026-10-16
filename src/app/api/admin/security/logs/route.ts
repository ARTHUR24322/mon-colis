import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminSession } from '@/lib/adminSession';
import { hasPermission } from '@/lib/adminPermissions';

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin || !hasPermission(admin.role, 'canViewSecurityLogs')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: logsData, error } = await supabaseAdmin
      .from('login_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase error fetching login_logs:', error);
      return NextResponse.json({ error: 'Erreur lors de la récupération des logs.' }, { status: 500 });
    }

    return NextResponse.json({ logs: logsData || [] });
  } catch (err) {
    console.error('[security/logs] error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
