import { createClient } from '@supabase/supabase-js';

export async function logFinancialAudit(params: {
  action_type: string;
  amount_cdf?: number;
  amount_usd?: number;
  actor_id?: string;
  actor_name?: string;
  target_id?: string;
  target_name?: string;
  target_role?: string;
  status?: string;
  reference?: string;
  notes?: string;
}) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    await supabaseAdmin.from('financial_audits').insert({
      action_type: params.action_type,
      amount_cdf: params.amount_cdf || 0,
      amount_usd: params.amount_usd || 0,
      actor_id: params.actor_id,
      actor_name: params.actor_name,
      target_id: params.target_id,
      target_name: params.target_name,
      target_role: params.target_role,
      status: params.status || 'COMPLETED',
      reference: params.reference,
      notes: params.notes,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log financial audit:', err);
  }
}
