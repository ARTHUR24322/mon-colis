import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabase } from '@/utils/supabase/client';
import { z } from 'zod';

const proSettingsSchema = z.object({
  requireManagerApproval: z.boolean().optional(),
  enforceHours: z.boolean().optional(),
  allowedStartTime: z.string().optional(),
  allowedEndTime: z.string().optional(),
  volumeDiscountEnabled: z.boolean().optional(),
  volumeThreshold: z.number().optional(),
  volumeDiscountPercent: z.number().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('agency_settings')
      .select('*')
      .eq('agency_id', session.agencyId)
      .single();

    if (error && error.code !== 'PGRST116') { // not found
      throw error;
    }

    return NextResponse.json({ settings: data || null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const result = proSettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // Convert camelCase to snake_case
    const payload: Record<string, any> = {};
    const d = result.data;
    if (d.requireManagerApproval !== undefined) payload.require_manager_approval = d.requireManagerApproval;
    if (d.enforceHours !== undefined) payload.enforce_hours = d.enforceHours;
    if (d.allowedStartTime !== undefined) payload.allowed_start_time = d.allowedStartTime;
    if (d.allowedEndTime !== undefined) payload.allowed_end_time = d.allowedEndTime;
    if (d.volumeDiscountEnabled !== undefined) payload.volume_discount_enabled = d.volumeDiscountEnabled;
    if (d.volumeThreshold !== undefined) payload.volume_threshold = d.volumeThreshold;
    if (d.volumeDiscountPercent !== undefined) payload.volume_discount_percent = d.volumeDiscountPercent;

    const { error: upsertErr } = await supabase
      .from('agency_settings')
      .upsert({ agency_id: session.agencyId, ...payload, updated_at: new Date().toISOString() });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
