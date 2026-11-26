import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { hasAgencyPermission, AgencyRole } from '@/lib/agencyPermissions';

export interface ActivityItem {
  id: string;
  category: 'LOGIN' | 'PACKAGE' | 'CASH' | 'WAREHOUSE' | 'TEAM';
  action: string;
  actionLabel: string;
  actorName: string;
  actorRole?: string;
  actorStaffId?: string;
  actorIp?: string;
  details: string;
  reference?: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
  createdAt: string;
}

export interface StaffConnectionStatus {
  id: string;
  name: string;
  role: AgencyRole;
  staffId: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }

    // Seul le directeur d'agence a accès au journal d'audit complet
    if (!hasAgencyPermission(session.agencyRole, 'canViewAuditLogs')) {
      return NextResponse.json(
        { error: 'Accès restreint. Seul le directeur d’agence peut consulter le journal d’activités.' },
        { status: 403 }
      );
    }

    const agencyId = session.agencyId;
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category')?.toUpperCase();
    const actorParam = searchParams.get('actor');
    const searchParam = searchParams.get('search')?.toLowerCase().trim();
    const limitParam = parseInt(searchParams.get('limit') || '250', 10);

    // 1. Récupération des membres de l'agence (pour mapper les noms, rôles et états de connexion)
    const { data: membersRaw } = await supabaseAdmin
      .from('agency_members')
      .select('id, name, email, phone, role, staff_id, is_active, last_login_at, created_at')
      .eq('agency_id', agencyId);

    const members: StaffConnectionStatus[] = (membersRaw || []).map(m => ({
      id: m.id,
      name: m.name,
      role: m.role as AgencyRole,
      staffId: m.staff_id,
      email: m.email,
      phone: m.phone,
      isActive: m.is_active,
      lastLoginAt: m.last_login_at,
      createdAt: m.created_at,
    }));

    const memberIds = members.map(m => m.id);
    const memberNameMap = new Map(members.map(m => [m.id, m.name]));
    const memberRoleMap = new Map(members.map(m => [m.id, m.role]));
    const memberStaffIdMap = new Map(members.map(m => [m.id, m.staffId]));

    // 2. Requêtes d'audit en parallèle
    const [
      securityLogsRes,
      agencyPackagesRes,
      financialAuditsRes,
      cashSessionsRes,
      warehouseMovementsRes,
    ] = await Promise.allSettled([
      // A. Logs de sécurité & Connexions
      supabaseAdmin
        .from('security_logs')
        .select('id, action, actor_ip, actor_id, actor_name, target_role, success, details, created_at')
        .or(`actor_id.eq.${agencyId},details.ilike.%${agencyId}%`)
        .order('created_at', { ascending: false })
        .limit(150),

      // B. Colis de l'agence (pour récupérer leurs logs d'audit)
      supabaseAdmin
        .from('packages')
        .select('id, tracking_code')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(150),

      // C. Audits financiers & Caisse
      supabaseAdmin
        .from('financial_audits')
        .select('*')
        .or(`actor_id.eq.${agencyId},target_id.eq.${agencyId}`)
        .order('created_at', { ascending: false })
        .limit(100),

      // D. Sessions de caisse
      supabaseAdmin
        .from('agency_cash_sessions')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(50),

      // E. Mouvements de stock entrepôt
      supabaseAdmin
        .from('warehouse_stock_movements')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const activities: ActivityItem[] = [];

    // ── A. Traitement des logs de connexion et sécurité ───────────────────────
    if (securityLogsRes.status === 'fulfilled' && securityLogsRes.value.data) {
      for (const log of securityLogsRes.value.data) {
        let detailsText = log.details || '';
        let staffId = '';
        let role = '';

        // Si le détail contient du JSON enrichi
        try {
          if (detailsText.startsWith('{') && detailsText.endsWith('}')) {
            const parsed = JSON.parse(detailsText);
            detailsText = parsed.details || detailsText;
            staffId = parsed.staffId || '';
            role = parsed.role || '';
          }
        } catch { }

        const isSuccess = log.success;
        let actionLabel = 'Connexion au portail';
        if (log.action.includes('FAIL') || log.action.includes('ERROR')) {
          actionLabel = 'Échec de connexion';
        } else if (log.action.includes('DISABLED')) {
          actionLabel = 'Tentative sur compte désactivé';
        } else if (log.action.includes('RATE_LIMITED')) {
          actionLabel = 'Blocage tentatives excessives';
        }

        // Tenter de retrouver le rôle du membre
        const matchedMember = members.find(m => m.name === log.actor_name || m.id === log.actor_id);
        const resolvedRole = role || matchedMember?.role || log.target_role || 'collaborateur';
        const resolvedStaffId = staffId || matchedMember?.staffId || undefined;

        activities.push({
          id: `sec-${log.id}`,
          category: 'LOGIN',
          action: log.action,
          actionLabel,
          actorName: log.actor_name || 'Utilisateur',
          actorRole: resolvedRole,
          actorStaffId: resolvedStaffId || undefined,
          actorIp: log.actor_ip || undefined,
          details: detailsText || (isSuccess ? 'Session démarrée avec succès' : 'Tentative rejetée'),
          reference: resolvedStaffId || undefined,
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          createdAt: log.created_at,
        });
      }
    }

    // ── B. Traitement des logs de colis ──────────────────────────────────────
    if (agencyPackagesRes.status === 'fulfilled' && agencyPackagesRes.value.data) {
      const pkgs = agencyPackagesRes.value.data;
      if (pkgs.length > 0) {
        const pkgIds = pkgs.map(p => p.id);
        const pkgCodeMap = new Map(pkgs.map(p => [p.id, p.tracking_code]));

        const { data: pkgLogs } = await supabaseAdmin
          .from('package_audit_logs')
          .select('id, package_id, action, actor_name, actor_role, from_status, to_status, reason, details, created_at')
          .in('package_id', pkgIds)
          .order('created_at', { ascending: false })
          .limit(150);

        if (pkgLogs) {
          for (const pl of pkgLogs) {
            const tracking = pkgCodeMap.get(pl.package_id) || 'Colis';
            let label = 'Mise à jour statut colis';
            if (pl.action === 'AGENCY_ACCEPTED') label = 'Colis accepté par l’agence';
            else if (pl.action === 'AGENCY_REJECTED') label = 'Colis refusé par l’agence';
            else if (pl.action === 'DRIVER_ASSIGNED' || pl.action === 'ASSIGNED_TO_DRIVER') label = 'Assignation à un livreur';
            else if (pl.action === 'DELIVERED') label = 'Livraison achevée et validée';
            else if (pl.action === 'SCAN_RECEPTION' || pl.action === 'SCAN_HANDOVER') label = 'Scan et contrôle QR code';

            const details = pl.details || pl.reason || `Statut passé de ${pl.from_status} à ${pl.to_status}`;

            activities.push({
              id: `pkg-${pl.id}`,
              category: 'PACKAGE',
              action: pl.action,
              actionLabel: label,
              actorName: pl.actor_name || 'Agent exploitation',
              actorRole: pl.actor_role || 'gestionnaire',
              details,
              reference: tracking,
              status: pl.action.includes('REJECT') ? 'WARNING' : 'SUCCESS',
              createdAt: pl.created_at,
            });
          }
        }
      }
    }

    // ── C. Traitement des audits financiers & Caisse ──────────────────────────
    if (financialAuditsRes.status === 'fulfilled' && financialAuditsRes.value.data) {
      for (const fa of financialAuditsRes.value.data) {
        let label = 'Opération financière';
        if (fa.action_type === 'CASH_SESSION_CLOSED') label = 'Clôture de session de caisse';
        else if (fa.action_type === 'CASH_SESSION_OPENED') label = 'Ouverture de session de caisse';
        else if (fa.action_type === 'VENDOR_PAYOUT' || fa.action_type === 'VERSEMENT_VENDEUR') label = 'Versement validé au vendeur';
        else if (fa.action_type === 'DRIVER_CASH_DEPOSIT' || fa.action_type === 'DEPOT_LIVREUR') label = 'Encaissement dépôt livreur';

        const amountStr = fa.amount_usd ? `$${Number(fa.amount_usd).toFixed(2)}` : fa.amount_cdf ? `${fa.amount_cdf} FC` : '';
        const details = fa.notes ? `${fa.notes} ${amountStr ? `(${amountStr})` : ''}` : `Montant traité : ${amountStr}`;

        activities.push({
          id: `fin-${fa.id}`,
          category: 'CASH',
          action: fa.action_type,
          actionLabel: label,
          actorName: fa.actor_name || 'Agent caissier',
          actorRole: 'comptable',
          details,
          reference: fa.reference || fa.package_code || undefined,
          status: fa.status === 'COMPLETED' ? 'SUCCESS' : 'INFO',
          createdAt: fa.created_at,
        });
      }
    }

    // ── D. Traitement des sessions de caisse (si non déjà dans financial) ───────
    if (cashSessionsRes.status === 'fulfilled' && cashSessionsRes.value.data) {
      for (const cs of cashSessionsRes.value.data) {
        if (cs.closed_at) {
          activities.push({
            id: `cs-close-${cs.id}`,
            category: 'CASH',
            action: 'CASH_SESSION_CLOSED',
            actionLabel: 'Procès-Verbal de clôture caisse',
            actorName: cs.closed_by || 'Caissier',
            actorRole: 'comptable',
            details: `Session clôturée. Attendu: $${Number(cs.expected_usd || 0).toFixed(2)} / ${cs.expected_cdf || 0} FC. Compté: $${Number(cs.counted_usd || 0).toFixed(2)} / ${cs.counted_cdf || 0} FC.${cs.discrepancy_reason ? ` Motif écart : ${cs.discrepancy_reason}` : ''}`,
            reference: cs.session_reference || undefined,
            status: cs.has_discrepancy ? 'WARNING' : 'SUCCESS',
            createdAt: cs.closed_at,
          });
        }
      }
    }

    // ── E. Traitement des mouvements de stock entrepôt ─────────────────────────
    if (warehouseMovementsRes.status === 'fulfilled' && warehouseMovementsRes.value.data) {
      for (const wm of warehouseMovementsRes.value.data) {
        let label = 'Mouvement de stock entrepôt';
        if (wm.movement_type === 'INBOUND' || wm.movement_type === 'RECEPTION') label = 'Entrée en stock rayon';
        else if (wm.movement_type === 'PICKING' || wm.movement_type === 'OUTBOUND') label = 'Prélèvement picking commande';
        else if (wm.movement_type === 'RETURN_RESTOCK') label = 'Réintégration retour colis';

        activities.push({
          id: `wm-${wm.id}`,
          category: 'WAREHOUSE',
          action: wm.movement_type || 'STOCK_MOVEMENT',
          actionLabel: label,
          actorName: wm.operator_name || wm.actor_name || 'Magasinier',
          actorRole: 'magasinier',
          details: `Article : ${wm.product_name || 'Marchandise'} | Quantité : ${wm.quantity || 1} | Emplacement : ${wm.shelf_location || wm.space_name || 'Rayon'}`,
          reference: wm.batch_number || wm.tracking_code || undefined,
          status: 'SUCCESS',
          createdAt: wm.created_at,
        });
      }
    }

    // ── F. Ajout des événements d'équipe (création / invitation de collaborateurs)
    for (const mem of members) {
      activities.push({
        id: `team-create-${mem.id}`,
        category: 'TEAM',
        action: 'MEMBER_ADDED',
        actionLabel: 'Collaborateur rejoint l’agence',
        actorName: mem.name,
        actorRole: mem.role,
        actorStaffId: mem.staffId || undefined,
        details: `Compte ${mem.name} créé avec le rôle ${mem.role}.${mem.staffId ? ` Identifiant staff : ${mem.staffId}` : ''}`,
        reference: mem.staffId || mem.email,
        status: 'INFO',
        createdAt: mem.createdAt,
      });
    }

    // 3. Tri antéchronologique universel (le plus récent en premier)
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 4. Filtrage par critères de recherche
    let filtered = activities;

    if (categoryParam && categoryParam !== 'ALL') {
      filtered = filtered.filter(item => item.category === categoryParam);
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
        (item.reference && item.reference.toLowerCase().includes(searchParam)) ||
        (item.actorStaffId && item.actorStaffId.toLowerCase().includes(searchParam))
      );
    }

    // Appliquer la limite
    const paginated = filtered.slice(0, limitParam);

    // 5. Statistiques de synthèse pour les KPIs du directeur
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
        teamCount: activities.filter(a => a.category === 'TEAM').length,
        logins24h,
        logins7d,
      },
      members,
      activities: paginated,
    });

  } catch (err) {
    console.error('[GET /api/agency/activities] Error:', err);
    return NextResponse.json({ error: 'Erreur lors de la récupération des activités.' }, { status: 500 });
  }
}
