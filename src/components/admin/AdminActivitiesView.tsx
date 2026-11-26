'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Shield,
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
  Hash,
  Building2,
  Globe,
  Crown
} from 'lucide-react';
import { safeFormatDateTime } from '@/utils/dateUtils';

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

export interface ActivitySummary {
  totalActivities: number;
  loginsCount: number;
  packagesCount: number;
  cashCount: number;
  warehouseCount: number;
  agencyCount: number;
  adminCount: number;
  logins24h: number;
  logins7d: number;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Toutes les activités', icon: History },
  { id: 'LOGIN', label: 'Connexions & Sécurité', icon: LogIn },
  { id: 'PACKAGE', label: 'Colis & Livraisons', icon: Package },
  { id: 'CASH', label: 'Caisse & Finances', icon: Wallet },
  { id: 'WAREHOUSE', label: 'Entrepôt & Stocks', icon: Boxes },
  { id: 'AGENCY', label: 'Agences & Équipes', icon: Building2 },
  { id: 'ADMIN', label: 'Admins & Système', icon: Crown },
] as const;

export default function AdminActivitiesView({ onBack }: { onBack?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [members, setMembers] = useState<PlatformMemberStatus[]>([]);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    totalActivities: 0,
    loginsCount: 0,
    packagesCount: 0,
    cashCount: 0,
    warehouseCount: 0,
    agencyCount: 0,
    adminCount: 0,
    logins24h: 0,
    logins7d: 0,
  });

  // Filtres
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedAgency, setSelectedAgency] = useState<string>('ALL');
  const [selectedActor, setSelectedActor] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStaffPanel, setShowStaffPanel] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/activities?limit=500');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        setMembers(data.members || []);
        setAgencies(data.agencies || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Erreur chargement journal activités admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Filtrage côté client
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (activeCategory !== 'ALL' && act.category !== activeCategory) {
        return false;
      }
      if (selectedAgency !== 'ALL') {
        const matchAgencyId = act.agencyId === selectedAgency;
        const matchAgencyName = act.agencyName?.toLowerCase() === selectedAgency.toLowerCase();
        if (!matchAgencyId && !matchAgencyName) return false;
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
        const matchAgency = act.agencyName?.toLowerCase().includes(q);
        const matchDetails = act.details?.toLowerCase().includes(q);
        const matchRef = act.reference?.toLowerCase().includes(q);
        const matchStaff = act.actorStaffId?.toLowerCase().includes(q);
        const matchIp = act.actorIp?.toLowerCase().includes(q);
        if (!matchLabel && !matchActor && !matchAgency && !matchDetails && !matchRef && !matchStaff && !matchIp) {
          return false;
        }
      }
      return true;
    });
  }, [activities, activeCategory, selectedAgency, selectedActor, searchQuery]);

  const totalPages = Math.ceil(filteredActivities.length / pageSize) || 1;
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize]);

  // Export CSV
  const exportCSV = () => {
    if (filteredActivities.length === 0) return;

    const headers = ['Date', 'Heure', 'Categorie', 'Action', 'Acteur', 'Role', 'Entite / Agence', 'Identifiant Staff', 'IP', 'Details', 'Reference', 'Statut'];
    const rows = filteredActivities.map(a => {
      const d = new Date(a.createdAt);
      return [
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR'),
        a.category,
        `"${a.actionLabel.replace(/"/g, '""')}"`,
        `"${a.actorName.replace(/"/g, '""')}"`,
        a.actorRole || '',
        `"${(a.agencyName || 'Mon Colis').replace(/"/g, '""')}"`,
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
    link.setAttribute('download', `audit_plateforme_moncolis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'LOGIN':
        return { label: 'Connexion', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: LogIn };
      case 'PACKAGE':
        return { label: 'Colis', bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', icon: Package };
      case 'CASH':
        return { label: 'Caisse', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', icon: Wallet };
      case 'WAREHOUSE':
        return { label: 'Entrepôt', bg: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', icon: Boxes };
      case 'AGENCY':
        return { label: 'Agence', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', icon: Building2 };
      case 'ADMIN':
        return { label: 'Système', bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', icon: Crown };
      default:
        return { label: category, bg: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', icon: History };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return { label: 'Succès', bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', icon: CheckCircle2 };
      case 'FAILED':
        return { label: 'Échec / Rejet', bg: 'rgba(239, 68, 68, 0.18)', color: '#f87171', icon: XCircle };
      case 'WARNING':
        return { label: 'Alerte / Écart', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', icon: AlertTriangle };
      case 'INFO':
      default:
        return { label: 'Information', bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', icon: Info };
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ─── EN-TÊTE ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(168, 85, 247, 0.08))',
        border: '1px solid rgba(249, 115, 22, 0.3)',
        borderRadius: '16px', padding: '1.4rem 1.6rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f97316, #c2410c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0, boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)'
          }}>
            <History size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>
                Journal d'Activités &amp; Audit Global
              </h2>
              <span style={{
                background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.4)',
                padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '800'
              }}>
                SUPER ADMIN
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Surveillance continue de la plateforme : traçabilité des opérations (« qui a fait quoi et quand ») et suivi des connexions des personnels d'agences et administrateurs.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '0.55rem 1rem', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                color: '#cbd5e1', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600'
              }}
            >
              Retour
            </button>
          )}
          <button
            onClick={exportCSV}
            disabled={filteredActivities.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0.55rem 1rem', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
              color: '#fff', cursor: filteredActivities.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontWeight: '700'
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
              padding: '0.55rem 1rem', borderRadius: '8px',
              border: 'none', background: '#f97316',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontWeight: '800', boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ─── 4 CARTES KPI SYNTHÈSE SUPER ADMIN ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
        {/* Total Événements */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
              Total Événements Audit
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff' }}>
            {summary.totalActivities}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Traçabilité globale de toute la plateforme
          </div>
        </div>

        {/* Connexions Personnels & Admins */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#60a5fa', textTransform: 'uppercase' }}>
              Connexions Collaborateurs
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogIn size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#60a5fa' }}>
            {summary.logins24h} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>en 24h</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            {summary.logins7d} sessions ouvertes sur les 7 derniers jours
          </div>
        </div>

        {/* Opérations Colis & Scans */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#4ade80', textTransform: 'uppercase' }}>
              Actions Colis &amp; Scans
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#4ade80' }}>
            {summary.packagesCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Réceptions, acceptations, refus et livraisons
          </div>
        </div>

        {/* Flux Financiers & Entrepôt */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#fbbf24', textTransform: 'uppercase' }}>
              Caisse &amp; Stocks
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fbbf24' }}>
            {summary.cashCount + summary.warehouseCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            {summary.cashCount} sessions caisse/versements + {summary.warehouseCount} stock
          </div>
        </div>
      </div>

      {/* ─── VOLET ÉTAT DES CONNEXIONS DES PERSONNELS & ADMINS ─────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px', overflow: 'hidden'
      }}>
        <div
          onClick={() => setShowStaffPanel(!showStaffPanel)}
          style={{
            padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.2)',
            borderBottom: showStaffPanel ? '1px solid rgba(255,255,255,0.07)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} color="#f97316" />
            <span style={{ fontWeight: '800', fontSize: '0.88rem', color: '#fff' }}>
              État de Connexion des Personnels &amp; Administrateurs ({members.length} comptes audités)
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {showStaffPanel ? 'Masquer ▲' : 'Afficher ▼'}
          </span>
        </div>

        {showStaffPanel && (
          <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
            {members.map(m => {
              const isAdmin = m.type === 'ADMIN';
              const hasLoggedIn = !!m.lastLoginAt;
              const lastLoginDate = m.lastLoginAt ? new Date(m.lastLoginAt) : null;

              return (
                <div
                  key={m.id}
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px', padding: '10px 12px',
                    background: isAdmin ? 'rgba(249, 115, 22, 0.04)' : 'rgba(255,255,255,0.02)',
                    display: 'flex', flexDirection: 'column', gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: isAdmin ? 'rgba(249, 115, 22, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: isAdmin ? '#fb923c' : '#60a5fa',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '800', fontSize: '0.8rem'
                      }}>
                        {(m.name?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.84rem', color: '#fff' }}>
                          {m.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                          <span style={{
                            fontSize: '0.66rem', fontWeight: '700', padding: '1px 6px', borderRadius: '4px',
                            background: isAdmin ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: isAdmin ? '#fb923c' : '#4ade80'
                          }}>
                            {m.role}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            • {m.agencyName || 'Mon Colis'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.66rem', fontWeight: '700', padding: '2px 6px', borderRadius: '10px',
                      background: m.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: m.isActive ? '#4ade80' : '#f87171'
                    }}>
                      {m.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                    {m.staffId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace', color: '#818cf8', fontWeight: '600' }}>
                        <Hash size={10} /> {m.staffId}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} />
                      {hasLoggedIn && lastLoginDate ? (
                        <span>
                          Dernière connexion : <strong style={{ color: '#fff' }}>{lastLoginDate.toLocaleDateString('fr-FR')} à {lastLoginDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
                        </span>
                      ) : (
                        <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Jamais connecté</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── BARRE D'OUTILS ET FILTRES MULTIPLES ─────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem'
      }}>
        {/* Onglets Catégories */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            let count = summary.totalActivities;
            if (tab.id === 'LOGIN') count = summary.loginsCount;
            else if (tab.id === 'PACKAGE') count = summary.packagesCount;
            else if (tab.id === 'CASH') count = summary.cashCount;
            else if (tab.id === 'WAREHOUSE') count = summary.warehouseCount;
            else if (tab.id === 'AGENCY') count = summary.agencyCount;
            else if (tab.id === 'ADMIN') count = summary.adminCount;

            return (
              <button
                key={tab.id}
                onClick={() => { setActiveCategory(tab.id); setCurrentPage(1); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0.45rem 0.85rem', borderRadius: '8px', whiteSpace: 'nowrap',
                  border: isActive ? '1px solid #f97316' : '1px solid rgba(255,255,255,0.1)',
                  background: isActive ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255,255,255,0.02)',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontWeight: isActive ? '700' : '500', fontSize: '0.78rem', cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={13} color={isActive ? '#f97316' : '#94a3b8'} />
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '0.68rem', padding: '1px 5px', borderRadius: '8px',
                  background: isActive ? '#f97316' : 'rgba(255,255,255,0.08)',
                  color: '#fff', fontWeight: '700'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtres : Agence + Acteur + Recherche */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Recherche libre */}
          <div style={{ flex: 1.5, minWidth: '220px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Rechercher par action, acteur, agence, référence colis, IP..."
              style={{
                width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                color: '#fff', fontSize: '0.8rem', outline: 'none'
              }}
            />
          </div>

          {/* Filtre par Agence */}
          <select
            value={selectedAgency}
            onChange={(e) => { setSelectedAgency(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '0.45rem 0.75rem', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)',
              color: '#fff', fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="ALL">Toutes les agences</option>
            {agencies.map(ag => (
              <option key={ag.id} value={ag.id}>{ag.name}</option>
            ))}
          </select>

          {/* Filtre par Acteur */}
          <select
            value={selectedActor}
            onChange={(e) => { setSelectedActor(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '0.45rem 0.75rem', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)',
              color: '#fff', fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="ALL">Tous les acteurs</option>
            {members.map(m => (
              <option key={m.id} value={m.name}>
                {m.name} ({m.agencyName || 'Mon Colis'} - {m.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── TABLEAU PRINCIPAL DU JOURNAL D'ACTIVITÉS ──────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px', overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase', width: '130px' }}>Date &amp; Heure</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase', width: '110px' }}>Catégorie</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase', width: '220px' }}>Acteur &amp; Entité</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase' }}>Action Réalisée</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase' }}>Détails &amp; Réf.</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#94a3b8', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase', width: '100px' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                  <div>Chargement des activités de la plateforme...</div>
                </td>
              </tr>
            ) : paginatedActivities.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <History size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff' }}>
                    Aucune activité trouvée
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.7 }}>
                    Modifiez vos critères de recherche ou réinitialisez les filtres.
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
                  <tr key={act.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Date & Heure */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.8rem' }}>
                        {dateObj.toLocaleDateString('fr-FR')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>

                    {/* Catégorie */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700',
                        background: catBadge.bg, color: catBadge.color
                      }}>
                        <CatIcon size={11} /> {catBadge.label}
                      </span>
                    </td>

                    {/* Acteur & Entité */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem' }}>
                          {act.actorName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: '#94a3b8' }}>
                          <span style={{ color: '#fb923c', fontWeight: '600' }}>{act.agencyName || 'Siège'}</span>
                          {act.actorRole && <span>• {act.actorRole}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {act.actorStaffId && <span>#{act.actorStaffId}</span>}
                          {act.actorIp && <span>IP: {act.actorIp}</span>}
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem' }}>
                        {act.actionLabel}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {act.action}
                      </div>
                    </td>

                    {/* Détails & Réf. */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4', maxWidth: '450px' }}>
                        {act.details}
                      </div>
                      {act.reference && (
                        <div style={{ marginTop: '3px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            padding: '1px 6px', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            fontSize: '0.68rem', fontFamily: 'monospace', color: '#f97316', fontWeight: '600'
                          }}>
                            Réf: {act.reference}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Statut */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
                        fontSize: '0.7rem', fontWeight: '700',
                        background: statBadge.bg, color: statBadge.color
                      }}>
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
            padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Affichage de {(currentPage - 1) * pageSize + 1} à {Math.min(currentPage * pageSize, filteredActivities.length)} sur {filteredActivities.length} activités
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '0.35rem 0.8rem', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                  color: currentPage === 1 ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.75rem'
                }}
              >
                Précédent
              </button>
              <span style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.35rem 0.8rem', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                  color: currentPage === totalPages ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.75rem'
                }}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
