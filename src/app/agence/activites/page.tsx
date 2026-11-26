'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import {
  History,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Download,
  Users,
  Package,
  Wallet,
  Boxes,
  LogIn,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  ArrowUpDown,
  Hash,
  Laptop
} from 'lucide-react';
import {
  AGENCY_ROLE_LABELS,
  normalizeAgencyRole,
  hasAgencyPermission,
  AgencyRole
} from '@/lib/agencyPermissions';

interface ActivityItem {
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

interface StaffStatus {
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

interface ActivitySummary {
  totalActivities: number;
  loginsCount: number;
  packagesCount: number;
  cashCount: number;
  warehouseCount: number;
  teamCount: number;
  logins24h: number;
  logins7d: number;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Toutes les activités', icon: History },
  { id: 'LOGIN', label: 'Connexions personnels', icon: LogIn },
  { id: 'PACKAGE', label: 'Colis & Livraisons', icon: Package },
  { id: 'CASH', label: 'Caisse & Finances', icon: Wallet },
  { id: 'WAREHOUSE', label: 'Entrepôt & Stocks', icon: Boxes },
  { id: 'TEAM', label: 'Équipe & Accès', icon: Users },
] as const;

export default function AgencyActivitiesPage() {
  const { user } = useAuth('agence');
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canView = hasAgencyPermission(userRole, 'canViewAuditLogs');

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [members, setMembers] = useState<StaffStatus[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    totalActivities: 0,
    loginsCount: 0,
    packagesCount: 0,
    cashCount: 0,
    warehouseCount: 0,
    teamCount: 0,
    logins24h: 0,
    logins7d: 0,
  });

  // Filtres
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedActor, setSelectedActor] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStaffPanel, setShowStaffPanel] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agency/activities?limit=500');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        setMembers(data.members || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Erreur chargement journal activités:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchActivities();
    } else {
      setLoading(false);
    }
  }, [canView]);

  // Filtrage côté client
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (activeCategory !== 'ALL' && act.category !== activeCategory) {
        return false;
      }
      if (selectedActor !== 'ALL') {
        const matchName = act.actorName.toLowerCase() === selectedActor.toLowerCase();
        const matchStaffId = act.actorStaffId?.toLowerCase() === selectedActor.toLowerCase();
        if (!matchName && !matchStaffId) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchLabel = act.actionLabel?.toLowerCase().includes(q);
        const matchActor = act.actorName?.toLowerCase().includes(q);
        const matchDetails = act.details?.toLowerCase().includes(q);
        const matchRef = act.reference?.toLowerCase().includes(q);
        const matchStaff = act.actorStaffId?.toLowerCase().includes(q);
        if (!matchLabel && !matchActor && !matchDetails && !matchRef && !matchStaff) {
          return false;
        }
      }
      return true;
    });
  }, [activities, activeCategory, selectedActor, searchQuery]);

  const totalPages = Math.ceil(filteredActivities.length / pageSize) || 1;
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize]);

  // Export CSV
  const exportCSV = () => {
    if (filteredActivities.length === 0) return;

    const headers = ['Date', 'Heure', 'Categorie', 'Action', 'Collaborateur', 'Role', 'Identifiant Staff', 'IP', 'Details', 'Reference', 'Statut'];
    const rows = filteredActivities.map(a => {
      const d = new Date(a.createdAt);
      return [
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR'),
        a.category,
        `"${a.actionLabel.replace(/"/g, '""')}"`,
        `"${a.actorName.replace(/"/g, '""')}"`,
        a.actorRole || '',
        a.actorStaffId || '',
        a.actorIp || '',
        `"${a.details.replace(/"/g, '""')}"`,
        a.reference || '',
        a.status
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `journal_activites_agence_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'LOGIN':
        return { label: 'Connexion', bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', icon: LogIn };
      case 'PACKAGE':
        return { label: 'Colis', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', icon: Package };
      case 'CASH':
        return { label: 'Caisse', bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', icon: Wallet };
      case 'WAREHOUSE':
        return { label: 'Entrepôt', bg: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', icon: Boxes };
      case 'TEAM':
        return { label: 'Équipe', bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', icon: Users };
      default:
        return { label: category, bg: 'var(--ag-surface-hover)', color: 'var(--ag-text-secondary)', icon: History };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return { label: 'Succès', bg: 'var(--ag-success-bg)', color: 'var(--ag-success)', icon: CheckCircle2 };
      case 'FAILED':
        return { label: 'Échec / Rejet', bg: 'var(--ag-danger-bg)', color: 'var(--ag-danger)', icon: XCircle };
      case 'WARNING':
        return { label: 'Alerte / Écart', bg: 'var(--ag-warning-bg)', color: 'var(--ag-warning)', icon: AlertTriangle };
      case 'INFO':
      default:
        return { label: 'Information', bg: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', icon: Info };
    }
  };

  if (!canView) {
    return (
      <AgencyShell>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', textAlign: 'center', padding: '32px'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: 'var(--ag-danger-bg)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '16px'
          }}>
            <ShieldAlert size={32} color="var(--ag-danger)" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--ag-text-primary)', margin: '0 0 8px' }}>
            Accès Réservé à la Direction
          </h2>
          <p style={{ maxWidth: '480px', color: 'var(--ag-text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Le journal d'activités et d'audit interne est accessible uniquement au Directeur d'agence pour garantir la confidentialité et la surveillance opérationnelle.
          </p>
        </div>
      </AgencyShell>
    );
  }

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* ─── EN-TÊTE ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0, color: 'var(--ag-text-primary)' }}>
                Journal d'Activités &amp; Audit
              </h1>
              <span className="agency-badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
                <Shield size={12} /> Direction Agence
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
              Historique complet des opérations (« qui a fait quoi et quand ») et suivi des connexions des personnels de l'agence.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={exportCSV}
              disabled={filteredActivities.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                color: 'var(--ag-text-primary)', cursor: filteredActivities.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem', fontWeight: '600'
              }}
            >
              <Download size={14} />
              Exporter CSV ({filteredActivities.length})
            </button>
            <button
              onClick={fetchActivities}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid var(--ag-brand)', backgroundColor: 'var(--ag-brand)',
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem', fontWeight: '600'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
        </div>

        {/* ─── 4 CARTES KPI SYNTHÈSE ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {/* Total Activités */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>
                Total Événements
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <History size={16} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--ag-text-primary)' }}>
              {summary.totalActivities}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
              Tous types d'opérations confondus
            </div>
          </div>

          {/* Connexions Personnels */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase' }}>
                Connexions Collaborateurs
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogIn size={16} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#3b82f6' }}>
              {summary.logins24h} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--ag-text-muted)' }}>en 24h</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
              {summary.logins7d} sessions ouvertes sur les 7 derniers jours
            </div>
          </div>

          {/* Opérations Colis & Scans */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>
                Actions Colis &amp; Scans
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981' }}>
              {summary.packagesCount}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
              Réceptions, acceptations et livraisons
            </div>
          </div>

          {/* Caisse & Stock */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase' }}>
                Finances &amp; Stocks
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={16} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#f59e0b' }}>
              {summary.cashCount + summary.warehouseCount}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
              {summary.cashCount} clôtures/versements + {summary.warehouseCount} mouvements stock
            </div>
          </div>
        </div>

        {/* ─── VOLET DERNIÈRES CONNEXIONS DES PERSONNELS ─────────────────── */}
        <div style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '14px', boxShadow: 'var(--ag-card-shadow)', overflow: 'hidden'
        }}>
          <div
            onClick={() => setShowStaffPanel(!showStaffPanel)}
            style={{
              padding: '14px 18px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', cursor: 'pointer', borderBottom: showStaffPanel ? '1px solid var(--ag-border)' : 'none',
              backgroundColor: 'var(--ag-surface-hover)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="var(--ag-brand)" />
              <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--ag-text-primary)' }}>
                État de Connexion de l'Équipe ({members.length} collaborateur{members.length > 1 ? 's' : ''})
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>
              {showStaffPanel ? 'Masquer ▲' : 'Afficher ▼'}
            </span>
          </div>

          {showStaffPanel && (
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {members.map(m => {
                const roleMeta = AGENCY_ROLE_LABELS[m.role] || AGENCY_ROLE_LABELS.agent_comptoir;
                const hasLoggedIn = !!m.lastLoginAt;
                const lastLoginDate = m.lastLoginAt ? new Date(m.lastLoginAt) : null;
                
                return (
                  <div
                    key={m.id}
                    style={{
                      border: '1px solid var(--ag-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      backgroundColor: 'var(--ag-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          backgroundColor: roleMeta.badgeBg, color: roleMeta.badgeColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '800', fontSize: '0.78rem'
                        }}>
                          {(m.name?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.84rem', color: 'var(--ag-text-primary)' }}>
                            {m.name}
                          </div>
                          <span className="agency-badge" style={{ backgroundColor: roleMeta.badgeBg, color: roleMeta.badgeColor, fontSize: '0.68rem', padding: '1px 6px' }}>
                            {roleMeta.label}
                          </span>
                        </div>
                      </div>

                      <span className="agency-badge" style={{
                        backgroundColor: m.isActive ? 'var(--ag-success-bg)' : 'var(--ag-danger-bg)',
                        color: m.isActive ? 'var(--ag-success)' : 'var(--ag-danger)',
                        fontSize: '0.68rem'
                      }}>
                        {m.isActive ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.74rem', color: 'var(--ag-text-muted)', borderTop: '1px solid var(--ag-border)', paddingTop: '8px' }}>
                      {m.staffId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace', color: '#818cf8', fontWeight: '600' }}>
                          <Hash size={11} /> {m.staffId}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        {hasLoggedIn && lastLoginDate ? (
                          <span>
                            Dernière connexion : <strong>{lastLoginDate.toLocaleDateString('fr-FR')} à {lastLoginDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
                          </span>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: 'var(--ag-text-muted)' }}>Jamais connecté</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── BARRE D'OUTILS ET FILTRES ──────────────────────────────────── */}
        <div style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '14px', padding: '14px 18px', display: 'flex', flexDirection: 'column',
          gap: '14px', boxShadow: 'var(--ag-card-shadow)'
        }}>
          {/* Onglets Catégories */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              let count = summary.totalActivities;
              if (tab.id === 'LOGIN') count = summary.loginsCount;
              else if (tab.id === 'PACKAGE') count = summary.packagesCount;
              else if (tab.id === 'CASH') count = summary.cashCount;
              else if (tab.id === 'WAREHOUSE') count = summary.warehouseCount;
              else if (tab.id === 'TEAM') count = summary.teamCount;

              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveCategory(tab.id); setCurrentPage(1); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px', whiteSpace: 'nowrap',
                    border: isActive ? '1px solid var(--ag-brand)' : '1px solid var(--ag-border)',
                    backgroundColor: isActive ? 'var(--ag-brand-glow)' : 'transparent',
                    color: isActive ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
                    fontWeight: isActive ? '700' : '500', fontSize: '0.82rem', cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px',
                    backgroundColor: isActive ? 'var(--ag-brand)' : 'var(--ag-surface-hover)',
                    color: isActive ? '#fff' : 'var(--ag-text-muted)'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Recherche & Sélecteur Collaborateur */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Input recherche */}
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ag-text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Rechercher par action, collaborateur, référence, identifiant staff..."
                style={{
                  width: '100%', padding: '9px 12px 9px 34px', borderRadius: '8px',
                  border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                  color: 'var(--ag-text-primary)', fontSize: '0.82rem', outline: 'none'
                }}
              />
            </div>

            {/* Filtrer par collaborateur */}
            <select
              value={selectedActor}
              onChange={(e) => { setSelectedActor(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '9px 12px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                color: 'var(--ag-text-primary)', fontSize: '0.82rem', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="ALL">Tous les collaborateurs</option>
              {members.map(m => (
                <option key={m.id} value={m.name}>
                  {m.name} ({m.staffId ? `${m.staffId} - ` : ''}{AGENCY_ROLE_LABELS[m.role]?.label || m.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ─── TABLEAU DU JOURNAL D'ACTIVITÉS ─────────────────────────────── */}
        <div style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '14px', boxShadow: 'var(--ag-card-shadow)', overflow: 'hidden'
        }}>
          <table className="agency-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Date &amp; Heure</th>
                <th style={{ width: '120px' }}>Catégorie</th>
                <th style={{ width: '220px' }}>Auteur / Collaborateur</th>
                <th>Action Réalisée</th>
                <th>Détails &amp; Réf.</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--ag-text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                    <div>Chargement du journal d'activités...</div>
                  </td>
                </tr>
              ) : paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--ag-text-muted)' }}>
                    <History size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--ag-text-primary)' }}>
                      Aucun événement trouvé
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Modifiez les filtres de recherche ou la catégorie pour afficher d'autres activités.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((act) => {
                  const catBadge = getCategoryBadge(act.category);
                  const CatIcon = catBadge.icon;
                  const statBadge = getStatusBadge(act.status);
                  const dateObj = new Date(act.createdAt);

                  return (
                    <tr key={act.id}>
                      {/* Date & Heure */}
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--ag-text-primary)' }}>
                          {dateObj.toLocaleDateString('fr-FR')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)' }}>
                          {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* Catégorie */}
                      <td>
                        <span className="agency-badge" style={{ backgroundColor: catBadge.bg, color: catBadge.color, fontSize: '0.72rem' }}>
                          <CatIcon size={12} /> {catBadge.label}
                        </span>
                      </td>

                      {/* Auteur */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--ag-text-primary)', fontSize: '0.84rem' }}>
                            {act.actorName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--ag-text-muted)' }}>
                            {act.actorStaffId && (
                              <span style={{ fontFamily: 'monospace', color: '#818cf8', fontWeight: '600' }}>
                                #{act.actorStaffId}
                              </span>
                            )}
                            {act.actorRole && (
                              <span>• {act.actorRole}</span>
                            )}
                          </div>
                          {act.actorIp && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--ag-text-muted)', fontFamily: 'monospace' }}>
                              IP: {act.actorIp}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--ag-text-primary)' }}>
                          {act.actionLabel}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', fontFamily: 'monospace' }}>
                          {act.action}
                        </div>
                      </td>

                      {/* Détails & Réf */}
                      <td>
                        <div style={{ fontSize: '0.82rem', color: 'var(--ag-text-secondary)', maxWidth: '420px', lineHeight: '1.4' }}>
                          {act.details}
                        </div>
                        {act.reference && (
                          <div style={{ marginTop: '4px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: '1px 6px', borderRadius: '4px',
                              backgroundColor: 'var(--ag-surface-hover)', border: '1px solid var(--ag-border)',
                              fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--ag-brand)', fontWeight: '600'
                            }}>
                              Réf: {act.reference}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Statut */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="agency-badge" style={{ backgroundColor: statBadge.bg, color: statBadge.color, fontSize: '0.7rem', padding: '3px 8px' }}>
                          {statBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {!loading && filteredActivities.length > pageSize && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 18px', borderTop: '1px solid var(--ag-border)',
              backgroundColor: 'var(--ag-surface-hover)'
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                Affichage de {(currentPage - 1) * pageSize + 1} à {Math.min(currentPage * pageSize, filteredActivities.length)} sur {filteredActivities.length} activités
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '5px 12px', borderRadius: '6px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                    color: 'var(--ag-text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem', opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  Précédent
                </button>
                <span style={{ padding: '5px 10px', fontSize: '0.78rem', color: 'var(--ag-text-secondary)', display: 'flex', alignItems: 'center' }}>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '5px 12px', borderRadius: '6px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                    color: 'var(--ag-text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem', opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AgencyShell>
  );
}
