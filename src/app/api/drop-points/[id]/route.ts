import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

    const { data, error } = await supabase
      .from('drop_points')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Point relais introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      dropPoint: {
        id: data.id,
        name: data.name,
        commune: data.commune,
        address: data.address,
        phone: data.phone,
        managerName: data.manager_name,
        openingHours: data.opening_hours,
        isActive: data.is_active,
        credits: data.credits ?? 0,
      }
    });
  } catch (err) {
    console.error('[GET /api/drop-points/[id]]', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
