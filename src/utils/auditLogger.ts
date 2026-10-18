import { createClient } from '@supabase/supabase-js';

export interface FinancialAuditParams {
  action_type: string;
  amount_cdf?: number;
  amount_usd?: number;
  exchange_rate_applied?: number;
  idempotency_key?: string;
  actor_id?: string;
  actor_name?: string;
  target_id?: string;
  target_name?: string;
  target_role?: string;
  status?: string;
  reference?: string;
  package_id?: string;
  package_code?: string;
  mobile_money_ref?: string;
  notes?: string;
}

export async function logFinancialAudit(params: FinancialAuditParams): Promise<{ success: boolean; duplicate?: boolean }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase credentials missing for financial audit log');
      return { success: false };
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Taux de change appliqué (2800 FC par défaut ou celui fourni)
    const rate = Number(params.exchange_rate_applied || 2800);

    // Calcul de la devise de référence de stockage (USD) :
    let usd = Number(params.amount_usd || 0);
    let cdf = Number(params.amount_cdf || 0);

    if (usd === 0 && cdf > 0 && rate > 0) {
      usd = Math.round((cdf / rate) * 100) / 100;
    } else if (cdf === 0 && usd > 0 && rate > 0) {
      cdf = Math.round(usd * rate);
    }

    const insertPayload: Record<string, any> = {
      action_type: params.action_type,
      amount_usd: usd,
      amount_cdf: cdf,
      exchange_rate_applied: rate,
      actor_id: params.actor_id || null,
      actor_name: params.actor_name || 'Système',
      target_id: params.target_id || null,
      target_name: params.target_name || 'Bénéficiaire',
      target_role: params.target_role || null,
      status: params.status || 'COMPLETED',
      reference: params.reference || null,
      package_id: params.package_id || null,
      package_code: params.package_code || null,
      mobile_money_ref: params.mobile_money_ref || null,
      notes: params.notes || null,
      created_at: new Date().toISOString()
    };

    if (params.idempotency_key) {
      insertPayload.idempotency_key = params.idempotency_key;
    }

    const { error } = await supabaseAdmin.from('financial_audits').insert(insertPayload);

    if (error) {
      // Contrainte d'idempotence violée : doublon détecté
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('idempotency_key')) {
        console.warn(`[Audit Idempotence] Transaction déjà enregistrée avec la clé: ${params.idempotency_key}`);
        return { success: false, duplicate: true };
      }
      console.error('Failed to insert into financial_audits:', error);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to log financial audit:', err);
    return { success: false };
  }
}
