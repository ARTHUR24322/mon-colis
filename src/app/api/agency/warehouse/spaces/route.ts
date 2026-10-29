/**
 * API /api/agency/warehouse/spaces
 * Gestion des offres et espaces de stockage d'une agence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : req.nextUrl.searchParams.get('agencyId');

    if (!agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data: spaces, error } = await supabase
      .from('agency_storage_spaces')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Agency spaces fetch warning:', error.message);
      return NextResponse.json({ spaces: [] });
    }

    return NextResponse.json({ spaces: spaces || [] });
  } catch (err: any) {
    console.error('[GET /api/agency/warehouse/spaces]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const agencyId = session?.role === 'agence' ? session.agencyId || session.userId : null;

    if (!agencyId && session?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      totalSlots,
      pricePerMonth,
      currency,
      dimensions,
      maxWeightPerSlot
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Le nom de l’espace est requis.' }, { status: 400 });
    }

    const total = parseInt(totalSlots, 10) || 1;

    const { data: created, error } = await supabase
      .from('agency_storage_spaces')
      .insert({
        agency_id: agencyId,
        name: name.trim(),
        description: description?.trim() || null,
        total_slots: total,
        available_slots: total,
        price_per_month: parseFloat(pricePerMonth) || 0,
        currency: currency === 'CDF' ? 'CDF' : 'USD',
        dimensions: dimensions?.trim() || null,
        max_weight_per_slot: parseFloat(maxWeightPerSlot) || null,
        is_active: true
      })
      .select('*')
      .single();

    if (error) {
      console.error('Create space error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, space: created });
  } catch (err: any) {
    console.error('[POST /api/agency/warehouse/spaces]', err);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
