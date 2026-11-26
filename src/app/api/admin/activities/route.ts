import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { hasPermission } from '@/lib/adminPermissions';
import { supabaseAdmin } from '@/utils/supabase/admin';

export interface AdminActivityItem {
  id: string;
  category: 'LOGIN' | 'PACKAGE' | 'CASH' | 'WAREHOUSE' | 'AGENCY' | 'ADMIN';
  action: string;
  actionLabel: string;
  actorName: string;
  actorRole?: string;
  actorStaffId?: string;
  actorIp?: string;
  agencyId?: string;
  agencyName?: string;
  details: string;
  reference?: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
  createdAt: string;
}

export interface PlatformMemberStatus {
  id: string;
  name: string;
  type: 'AGENCY_STAFF' | 'ADMIN';
  role: string;
  staffId: string | null;
  agencyId?: string | null;
  agencyName?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin || !hasPermission(admin.role, 'canViewSecurityLogs')) {
      return NextResponse.json({ error: 'Accès réservé au Super Administrateur.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category')?.toUpperCase();
    const agencyParam = searchParams.get('agencyId');
    const actorParam = searchParams.get('actor');
    const searchParam = searchParams.get('search')?.toLowerCase().trim();
    const limitParam = parseInt(searchParams.get('limit') || '300', 10);

    // 1. Récupération des agences pour mapper les noms
    const { data: agenciesRaw } = await supabaseAdmin
      .from('agencies')
      .select('id, name, status, email, phone');
    const agencyNameMap = new Map((agenciesRaw || []).map(a => [a.id, a.name]));

    // 2. Récupération des membres d'agence
    const { data: agencyMembersRaw } = await supabaseAdmin
      .from('agency_members')
      .select('id, agency_id, name, email, phone, role, staff_id, is_active, last_login_at, created_at');

    // 3. Récupération des comptes administrateurs
    let adminAccounts: any[] = [];
    try {
      const { data: sysSettings } = await supabaseAdmin
        .from('system_settings')
        .select('admin_accounts')
        .eq('id', 'global')
        .single();
      if (sysSettings?.admin_accounts) {
        adminAccounts = JSON.parse(sysSettings.admin_accounts);
      }
    } catch {}

    // Combiner l'annuaire des personnels & administrateurs
    const members: PlatformMemberStatus[] = [];

    // Admins
    for (const adm of adminAccounts) {
      members.push({
        id: adm.id || adm.username,
        name: adm.displayName || adm.username,
        type: 'ADMIN',
        role: adm.role,
        staffId: null,
        agencyId: null,
        agencyName: 'Siège Central / Mon Colis',
        email: adm.email || null,
        phone: null,
        isActive: adm.isActive ?? true,
        lastLoginAt: adm.lastLoginAt || null,
        createdAt: adm.createdAt || new Date().toISOString(),
      });
    }

    // Personnels des agences
    for (const am of (agencyMembersRaw || [])) {
      members.push({
        id: am.id,
        name: am.name,
        type: 'AGENCY_STAFF',
        role: am.role,
        staffId: am.staff_id,
        agencyId: am.agency_id,
        agencyName: agencyNameMap.get(am.agency_id) || 'Agence inconnue',
        email: am.email,
        phone: am.phone,
        isActive: am.is_active ?? true,
        lastLoginAt: am.last_login_at || null,
        createdAt: am.created_at || new Date().toISOString(),
      });
    }

    const memberNameMap = new Map(members.map(m => [m.id, m.name]));
    const memberStaffIdMap = new Map(members.map(m => [m.id, m.staffId]));
    const memberAgencyMap = new Map(members.map(m => [m.id, m.agencyName]));

    // 4. Récupération des logs en parallèle à travers la plateforme
    const [
      securityLogsRes,
      packageLogsRes,
      financialAuditsRes,
      cashSessionsRes,
      warehouseMovementsRes,
    ] = await Promise.allSettled([
      // A. Connexions et événements de sécurité
      supabaseAdmin
        .from('security_logs')
        .select('id, action, actor_ip, actor_id, actor_name, target_role, success, details, created_at')
        .order('created_at', { ascending: false })
        .limit(200),

      // B. Audit complet des colis
      supabaseAdmin
        .from('package_audit_logs')
        .select('id, package_id, action, actor_name, actor_role, from_status, to_status, reason, details, created_at')
        .order('created_at', { ascending: false })
        .limit(200),

      // C. Audits financiers globaux
      supabaseAdmin
        .from('financial_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150),

      // D. Sessions de caisse agences
      supabaseAdmin
        .from('agency_cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(80),

      // E. Mouvements entrepôt
      supabaseAdmin
        .from('warehouse_stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80),
    ]);

    const activities: AdminActivityItem[] = [];

    // ── A. Traitement des logs de connexion et sécurité ───────────────────────
    if (securityLogsRes.status === 'fulfilled' && securityLogsRes.value.data) {
      for (const log of securityLogsRes.value.data) {
        let detailsText = log.details || '';
        let staffId = '';
        let role = '';
        let agencyName = '';

        try {
          if (detailsText.startsWith('{') && detailsText.endsWith('}')) {
            const parsed = JSON.parse(detailsText);
            detailsText = parsed.details || detailsText;
            staffId = parsed.staffId || '';
            role = parsed.role || '';
            agencyName = parsed.agencyName || '';
          }
        } catch {}

        const isSuccess = log.success;
        let actionLabel = 'Connexion réussie';
        if (log.action.includes('FAIL') || log.action.includes('ERROR')) {
          actionLabel = 'Échec de connexion';
        } else if (log.action.includes('DISABLED')) {
          actionLabel = 'Tentative sur compte désactivé';
        } else if (log.action.includes('RATE_LIMITED')) {
          actionLabel = 'Blocage tentatives excessives';
        } else if (log.action.includes('LOGOUT')) {
          actionLabel = 'Déconnexion session';
        }

        const matchedMember = members.find(m => m.name === log.actor_name || m.id === log.actor_id);
        const resolvedRole = role || matchedMember?.role || log.target_role || 'Utilisateur';
        const resolvedStaffId = staffId || matchedMember?.staffId || undefined;
        const resolvedAgency = agencyName || matchedMember?.agencyName || undefined;

        activities.push({
          id: `sec-${log.id}`,
          category: 'LOGIN',
          action: log.action,
          actionLabel,
          actorName: log.actor_name || 'Utilisateur',
          actorRole: resolvedRole,
          actorStaffId: resolvedStaffId,
          actorIp: log.actor_ip || undefined,
          agencyName: resolvedAgency,
          details: detailsText || (isSuccess ? 'Connexion validée' : 'Tentative refusée'),
          reference: resolvedStaffId || log.actor_ip || undefined,
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          createdAt: log.created_at,
        });
      }
    }

    // ── B. Traitement des logs de colis ──────────────────────────────────────
    if (packageLogsRes.status === 'fulfilled' && packageLogsRes.value.data) {
      for (const pl of packageLogsRes.value.data) {
        let label = 'Transition de statut colis';
        if (pl.action === 'AGENCY_ACCEPTED') label = 'Colis accepté par l’agence';
        else if (pl.action === 'AGENCY_REJECTED') label = 'Colis refusé par l’agence';
        else if (pl.action === 'DRIVER_ASSIGNED' || pl.action === 'ASSIGNED_TO_DRIVER') label = 'Livreur assigné';
        else if (pl.action === 'DELIVERED') label = 'Livraison validée (OTP)';
        else if (pl.action === 'SCAN_RECEPTION' || pl.action === 'SCAN_HANDOVER') label = 'Scan QR code & contrôle';
        else if (pl.action === 'DISPUTE_RAISED') label = 'Litige / Réclamation déclarée';
        else if (pl.action === 'DISPUTE_RESOLVED') label = 'Litige résolu';

        const matchedMember = members.find(m => m.name === pl.actor_name);
        const details = pl.details || pl.reason || `Passage de ${pl.from_status} à ${pl.to_status}`;

        activities.push({
          id: `pkg-${pl.id}`,
          category: 'PACKAGE',
          action: pl.action,
          actionLabel: label,
          actorName: pl.actor_name || 'Opérateur',
          actorRole: pl.actor_role || matchedMember?.role || 'Opérations',
          agencyName: matchedMember?.agencyName || undefined,
          details,
          reference: pl.package_id ? `Colis #${pl.package_id.slice(0, 8)}` : undefined,
          status: pl.action.includes('REJECT') || pl.action.includes('DISPUTE') ? 'WARNING' : 'SUCCESS',
          createdAt: pl.created_at,
        });
      }
    }

    // ── C. Audits financiers & reversements ──────────────────────────────────
    if (financialAuditsRes.status === 'fulfilled' && financialAuditsRes.value.data) {
      for (const fa of financialAuditsRes.value.data) {
        let label = 'Transaction financière';
        if (fa.action_type === 'CASH_SESSION_CLOSED') label = 'Clôture de session caisse agence';
        else if (fa.action_type === 'CASH_SESSION_OPENED') label = 'Ouverture de session caisse';
        else if (fa.action_type === 'VENDOR_PAYOUT' || fa.action_type === 'VERSEMENT_VENDEUR') label = 'Reversement au vendeur';
        else if (fa.action_type === 'DRIVER_CASH_DEPOSIT' || fa.action_type === 'DEPOT_LIVREUR') label = 'Encaissement dépôt livreur';
        else if (fa.action_type === 'COMMISSION_COLLECTED') label = 'Commission Mon Colis perçue';

        const amountStr = fa.amount_usd ? `$${Number(fa.amount_usd).toFixed(2)}` : fa.amount_cdf ? `${Number(fa.amount_cdf).toLocaleString('fr-FR')} FC` : '';
        const details = fa.notes ? `${fa.notes} ${amountStr ? `(${amountStr})` : ''}` : `Montant : ${amountStr}`;

        activities.push({
          id: `fin-${fa.id}`,
          category: 'CASH',
          action: fa.action_type,
          actionLabel: label,
          actorName: fa.actor_name || 'Responsable caisse',
          actorRole: 'Comptable',
          agencyName: agencyNameMap.get(fa.target_id) || agencyNameMap.get(fa.actor_id) || undefined,
          details,
          reference: fa.reference || fa.package_code || undefined,
          status: fa.status === 'COMPLETED' ? 'SUCCESS' : 'INFO',
          createdAt: fa.created_at,
        });
      }
    }

    // ── D. Sessions de caisse ────────────────────────────────────────────────
    if (cashSessionsRes.status === 'fulfilled' && cashSessionsRes.value.data) {
      for (const cs of cashSessionsRes.value.data) {
        const agName = agencyNameMap.get(cs.agency_id) || 'Agence';
        if (cs.closed_at) {
          activities.push({
            id: `cs-close-${cs.id}`,
            category: 'CASH',
            action: 'AGENCY_CASH_SESSION_CLOSED',
            actionLabel: `PV Clôture de caisse — ${agName}`,
            actorName: cs.closed_by || 'Caissier',
            actorRole: 'Caisse agence',
            agencyId: cs.agency_id,
            agencyName: agName,
            details: `Attendu: $${Number(cs.expected_usd || 0).toFixed(2)} / ${Number(cs.expected_cdf || 0).toLocaleString('fr-FR')} FC. Compté: $${Number(cs.counted_usd || 0).toFixed(2)} / ${Number(cs.counted_cdf || 0).toLocaleString('fr-FR')} FC.${cs.discrepancy_reason ? ` Motif écart : ${cs.discrepancy_reason}` : ''}`,
            reference: cs.session_reference || `PV-${cs.id.slice(0, 8).toUpperCase()}`,
            status: cs.has_discrepancy ? 'WARNING' : 'SUCCESS',
            createdAt: cs.closed_at,
          });
        }
      }
    }

    // ── E. Mouvements entrepôt ────────────────────────────────────────────────
    if (warehouseMovementsRes.status === 'fulfilled' && warehouseMovementsRes.value.data) {
      for (const wm of warehouseMovementsRes.value.data) {
        const agName = agencyNameMap.get(wm.agency_id) || 'Entrepôt';
        let label = 'Mouvement stock entrepôt';
        if (wm.movement_type === 'INBOUND' || wm.movement_type === 'RECEPTION') label = 'Entrée en stock rayon';
        else if (wm.movement_type === 'PICKING' || wm.movement_type === 'OUTBOUND') label = 'Picking préparation commande';
        else if (wm.movement_type === 'RETURN_RESTOCK') label = 'Réintégration retour colis';

        activities.push({
          id: `wm-${wm.id}`,
          category: 'WAREHOUSE',
          action: wm.movement_type || 'STOCK_MOVEMENT',
          actionLabel: `${label} (${agName})`,
          actorName: wm.operator_name || wm.actor_name || 'Magasinier',
          actorRole: 'Magasinier',
          agencyId: wm.agency_id,
          agencyName: agName,
          details: `Marchandise : ${wm.product_name || 'Article'} | Qté : ${wm.quantity || 1} | Emplacement : ${wm.shelf_location || wm.space_name || 'Rayon'}`,
          reference: wm.batch_number || wm.tracking_code || undefined,
          status: 'SUCCESS',
          createdAt: wm.created_at,
        });
      }
    }

    // ── F. Événements d'agences et équipes ────────────────────────────────────
    for (const mem of members) {
      if (mem.type === 'AGENCY_STAFF') {
        activities.push({
          id: `mem-create-${mem.id}`,
          category: 'AGENCY',
          action: 'STAFF_MEMBER_REGISTERED',
          actionLabel: `Nouveau personnel agence — ${mem.agencyName}`,
          actorName: mem.name,
          actorRole: mem.role,
          actorStaffId: mem.staffId || undefined,
          agencyName: mem.agencyName || undefined,
          details: `Collaborateur ${mem.name} assigné au rôle ${mem.role}.${mem.staffId ? ` Identifiant staff : ${mem.staffId}` : ''}`,
          reference: mem.staffId || mem.email || undefined,
          status: 'INFO',
          createdAt: mem.createdAt,
        });
      } else {
        activities.push({
          id: `adm-create-${mem.id}`,
          category: 'ADMIN',
          action: 'ADMIN_ACCOUNT_SETUP',
          actionLabel: `Compte administrateur actif — ${mem.name}`,
          actorName: mem.name,
          actorRole: mem.role,
          agencyName: 'Mon Colis Siège',
          details: `Administrateur avec privilèges : ${mem.role}`,
          reference: mem.email || mem.name,
          status: 'INFO',
          createdAt: mem.createdAt,
        });
      }
    }

    // 5. Tri chronologique décroissant
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 6. Filtrage
    let filtered = activities;

    if (categoryParam && categoryParam !== 'ALL') {
      filtered = filtered.filter(item => item.category === categoryParam);
    }

    if (agencyParam && agencyParam !== 'ALL') {
      filtered = filtered.filter(item => item.agencyId === agencyParam || item.agencyName?.toLowerCase() === agencyParam.toLowerCase());
    }

    if (actorParam && actorParam !== 'ALL') {
      filtered = filtered.filter(item =>
        item.actorName.toLowerCase().includes(actorParam.toLowerCase()) ||
        item.actorStaffId?.toLowerCase() === actorParam.toLowerCase()
      );
    }

    if (searchParam) {
      filtered = filtered.filter(item =>
        item.actionLabel.toLowerCase().includes(searchParam) ||
        item.actorName.toLowerCase().includes(searchParam) ||
        item.details.toLowerCase().includes(searchParam) ||
        (item.agencyName && item.agencyName.toLowerCase().includes(searchParam)) ||
        (item.reference && item.reference.toLowerCase().includes(searchParam)) ||
        (item.actorStaffId && item.actorStaffId.toLowerCase().includes(searchParam)) ||
        (item.actorIp && item.actorIp.toLowerCase().includes(searchParam))
      );
    }

    const paginated = filtered.slice(0, limitParam);

    // 7. KPIs de synthèse plateforme pour le Super Admin
    const now = new Date().getTime();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const logins24h = activities.filter(a => a.category === 'LOGIN' && new Date(a.createdAt).getTime() >= oneDayAgo).length;
    const logins7d = activities.filter(a => a.category === 'LOGIN' && new Date(a.createdAt).getTime() >= sevenDaysAgo).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalActivities: activities.length,
        loginsCount: activities.filter(a => a.category === 'LOGIN').length,
        packagesCount: activities.filter(a => a.category === 'PACKAGE').length,
        cashCount: activities.filter(a => a.category === 'CASH').length,
        warehouseCount: activities.filter(a => a.category === 'WAREHOUSE').length,
        agencyCount: activities.filter(a => a.category === 'AGENCY').length,
        adminCount: activities.filter(a => a.category === 'ADMIN').length,
        logins24h,
        logins7d,
      },
      members,
      agencies: (agenciesRaw || []).map(a => ({ id: a.id, name: a.name })),
      activities: paginated,
    });

  } catch (err) {
    console.error('[GET /api/admin/activities] Error:', err);
    return NextResponse.json({ error: 'Erreur lors de la récupération des activités plateforme.' }, { status: 500 });
  }
}
