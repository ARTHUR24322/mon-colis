import { supabaseAdmin } from '@/utils/supabase/admin';

export type ActivityCategory = 'LOGIN' | 'PACKAGE' | 'CASH' | 'WAREHOUSE' | 'TEAM';

export interface AgencyActivityEntry {
  id: string;
  agency_id: string;
  category: ActivityCategory;
  action: string;
  actor_id?: string | null;
  actor_name: string;
  actor_role?: string | null;
  actor_staff_id?: string | null;
  actor_ip?: string | null;
  details: string;
  reference?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
  created_at: string;
}

/**
 * Enregistre une activité au sein de l'agence (Audit Trail)
 */
export async function logAgencyActivity(params: {
  agencyId: string;
  category: ActivityCategory;
  action: string;
  actorId?: string | null;
  actorName: string;
  actorRole?: string | null;
  actorStaffId?: string | null;
  actorIp?: string | null;
  details: string;
  reference?: string | null;
  status?: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
}): Promise<{ success: boolean }> {
  try {
    const payload = {
      action: `AGENCY_${params.category}_${params.action}`,
      actor_ip: params.actorIp || null,
      actor_id: params.actorId || params.agencyId,
      actor_name: params.actorName,
      target_role: 'agence',
      success: params.status !== 'FAILED',
      details: JSON.stringify({
        agencyId: params.agencyId,
        category: params.category,
        action: params.action,
        role: params.actorRole,
        staffId: params.actorStaffId,
        details: params.details,
        reference: params.reference,
        status: params.status || 'SUCCESS',
      }),
      created_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('security_logs').insert(payload);
    return { success: true };
  } catch (err) {
    console.warn('[logAgencyActivity] Failed to log activity:', err);
    return { success: false };
  }
}
