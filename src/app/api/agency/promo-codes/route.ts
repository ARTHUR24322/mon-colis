import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

const createPromoSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  discountPercent: z.number().min(1).max(100),
  expiresAt: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const { data, error } = await supabase
      .from('agency_promo_codes')
      .select('*')
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ codes: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const body = await request.json();
    const result = createPromoSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });

    const { error } = await supabase
      .from('agency_promo_codes')
      .insert({
        agency_id: session.agencyId,
        code: result.data.code,
        discount_percent: result.data.discountPercent,
        expires_at: result.data.expiresAt || null
      });

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ce code promo existe déjà.' }, { status: 400 });
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
