import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session-server';
import { hasPermission } from '@/lib/adminPermissions';

export async function GET(req: NextRequest) {
  const session = await getSession();
  
  if (!session || (!hasPermission(session.role as any, 'canManageSettings') && session.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: audits, error } = await supabaseAdmin
      .from('financial_audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet, return empty array to prevent crashing UI
        return NextResponse.json({ audits: [] });
      }
      console.error('Supabase error fetching financial_audits:', error);
      return NextResponse.json({ error: 'Erreur lors de la récupération du journal.' }, { status: 500 });
    }

    return NextResponse.json({ audits: audits || [] });
  } catch (err) {
    console.error('[financial-audits] error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
