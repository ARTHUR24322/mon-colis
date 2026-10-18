'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  Package, Clock, AlertTriangle, CheckCircle2, TrendingUp,
  RefreshCw, ChevronRight, ArrowUpRight, Truck, MapPin,
  Building2, Filter, Download, Check, X, ShieldAlert
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ColisRow {
  id: string;
  trackingCode: string;
  clientName: string;
  clientCommune: string;
  vendeurName: string;
  status: string;
  prixColis: number;
  prixLivraison: number | null;
  driverName: string | null;
  date: string;
  paidByClient: boolean;
  isPrepaid: boolean;
}

// ─── Badge statut ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  'PENDING_AGENCY':        { label: 'En attente',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'ACCEPTED_BY_AGENCY':    { label: 'Accepté',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'REJECTED_BY_AGENCY':    { label: 'Refusé',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'ASSIGNED_TO_DRIVER':    { label: 'Assigné',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'IN_TRANSIT':            { label: 'En transit',    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'DEPOSITED_AT_DROP_POINT':{ label: 'Au relais',    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'DELIVERED':             { label: 'Livré',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'CANCELLED':             { label: 'Annulé',        color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  'IN_DISPUTE':            { label: 'Réclamation',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '6px',
      background: meta.bg, color: meta.color,
      fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

// ─── Carte KPI ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px',
      padding: '1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '70px', height: '70px', background: color, opacity: 0.07, borderRadius: '0 0 0 70px' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <div style={{ color, opacity: 0.8 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: '900', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#475569' }}>{sub}</div>}
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function AgenceDashboardHome() {
  const { user } = useAuth('agence');
  const { formatPrice } = useCurrency();
  const [colis, setColis] = useState<ColisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refusalModalColis, setRefusalModalColis] = useState<ColisRow | null>(null);
  const [refusalReason, setRefusalReason] = useState('');
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const refresh = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/agence/colis?limit=200', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setColis(data.colis || []);
      }
    } catch { /* silencieux */ }
    setLoading(false);
  };

  const handleAgencyAction = async (packageId: string, action: 'accept' | 'reject', reason?: string) => {
    setActionLoading(packageId);
    try {
      const res = await fetch(`/api/agence/colis/${packageId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionToast({ message: data.message || 'Action enregistrée', type: 'success' });
        setRefusalModalColis(null);
        setRefusalReason('');
        refresh();
      } else {
        setActionToast({ message: data.error || 'Erreur lors de l\'action', type: 'error' });
      }
    } catch {
      setActionToast({ message: 'Erreur réseau', type: 'error' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionToast(null), 3000);
    }
  };

  useEffect(() => { if (user?.id) refresh(); }, [user?.id]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const pending = colis.filter(c => c.status === 'PENDING_AGENCY').length;
    const inTransit = colis.filter(c => ['IN_TRANSIT', 'ASSIGNED_TO_DRIVER'].includes(c.status)).length;
    const delivered = colis.filter(c => c.status === 'DELIVERED').length;
    const disputes = colis.filter(c => c.status === 'IN_DISPUTE').length;
    return { pending, inTransit, delivered, disputes };
  }, [colis]);

  // ── Filtrage + recherche ──
  const filtered = useMemo(() => {
    return colis.filter(c => {
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchSearch = !search ||
        c.trackingCode.toLowerCase().includes(search.toLowerCase()) ||
        c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        c.vendeurName.toLowerCase().includes(search.toLowerCase()) ||
        c.clientCommune.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [colis, statusFilter, search]);

  // ── Pagination côté client ──
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Export CSV ──
  const exportCSV = () => {
    const headers = ['Code', 'Client', 'Commune', 'Vendeur', 'Statut', 'Prix marchandise', 'Prix livraison', 'Livreur', 'Date'];
    const rows = filtered.map(c => [
      c.trackingCode, c.clientName, c.clientCommune, c.vendeurName,
      STATUS_META[c.status]?.label || c.status,
      c.prixColis, c.prixLivraison ?? '',
      c.driverName || '', c.date,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `moncolis-agence-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', maxWidth: '1400px' }}>

      {/* ─── En-tête ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
            Tableau de bord
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#fff', margin: 0 }}>
            {user?.name || 'Agence'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.85rem', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.85rem', borderRadius: '8px',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              color: '#4ade80', fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            <Download size={14} />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <KpiCard label="À accepter" value={kpis.pending} sub="colis en attente de votre décision" color="#f59e0b" icon={<Clock size={20} />} />
        <KpiCard label="En transit" value={kpis.inTransit} sub="colis chez vos livreurs" color="#06b6d4" icon={<Truck size={20} />} />
        <KpiCard label="Livrés" value={kpis.delivered} sub="livraisons réussies" color="#10b981" icon={<CheckCircle2 size={20} />} />
        <KpiCard label="Réclamations" value={kpis.disputes} sub={kpis.disputes > 0 ? '⚠ Attention requise' : 'Aucun incident'} color={kpis.disputes > 0 ? '#ef4444' : '#64748b'} icon={<AlertTriangle size={20} />} />
      </div>

      {/* ─── Tableau des colis ─── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {/* Barre de filtre */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
        }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#fff', marginRight: '0.5rem' }}>
            Colis ({filtered.length})
          </h2>

          {/* Recherche */}
          <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '300px' }}>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%', height: '34px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: '0.82rem', padding: '0 0.75rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filtre statut */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'Tous' },
              { key: 'PENDING_AGENCY', label: 'En attente' },
              { key: 'IN_TRANSIT', label: 'En transit' },
              { key: 'DELIVERED', label: 'Livrés' },
              { key: 'IN_DISPUTE', label: 'Incidents' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setStatusFilter(f.key); setPage(1); }}
                style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none',
                  background: statusFilter === f.key ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                  color: statusFilter === f.key ? '#000' : '#94a3b8',
                  fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Code suivi', 'Client', 'Commune', 'Vendeur', 'Statut', 'Prix colis', 'Livraison', 'Livreur', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '0.65rem 1rem', textAlign: 'left',
                    color: '#475569', fontSize: '0.72rem', fontWeight: '700',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
                <th style={{ padding: '0.65rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>
                    Chargement...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>
                    Aucun colis trouvé
                  </td>
                </tr>
              ) : (
                paginated.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                  >
                    <td style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {c.trackingCode}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#fff', fontWeight: '600' }}>{c.clientName}</td>
                    <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>{c.clientCommune}</td>
                    <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>{c.vendeurName}</td>
                    <td style={{ padding: '0.65rem 1rem' }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: '0.65rem 1rem', color: '#4ade80', fontWeight: '700' }}>
                      {formatPrice(c.prixColis)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: c.prixLivraison ? '#fcd34d' : '#475569' }}>
                      {c.prixLivraison ? formatPrice(c.prixLivraison) : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>
                      {c.driverName || <span style={{ color: '#334155', fontStyle: 'italic' }}>Non assigné</span>}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#475569', whiteSpace: 'nowrap' }}>{c.date}</td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      {c.status === 'PENDING_AGENCY' ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleAgencyAction(c.id, 'accept')}
                            disabled={actionLoading === c.id}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: '4px 8px', borderRadius: '6px', border: 'none',
                              background: '#10b981', color: '#000', fontSize: '0.72rem',
                              fontWeight: '800', cursor: actionLoading === c.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Check size={12} /> Accepter
                          </button>
                          <button
                            onClick={() => {
                              setRefusalModalColis(c);
                              setRefusalReason('');
                            }}
                            disabled={actionLoading === c.id}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: '4px 8px', borderRadius: '6px',
                              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                              color: '#f87171', fontSize: '0.72rem',
                              fontWeight: '700', cursor: actionLoading === c.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <X size={12} /> Décliner
                          </button>
                        </div>
                      ) : (
                        <a
                          href={`/agence/dashboard/colis/${c.id}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                            color: '#f59e0b', fontSize: '0.75rem', fontWeight: '700', textDecoration: 'none',
                          }}
                        >
                          Détail <ChevronRight size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Page {page} / {totalPages} — {filtered.length} colis
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: 'none', color: page === 1 ? '#334155' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem' }}
              >← Précédent</button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: 'none', color: page === totalPages ? '#334155' : '#94a3b8', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.78rem' }}
              >Suivant →</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── TOAST NOTIFICATION ─── */}
      {actionToast && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1100,
          background: actionToast.type === 'success' ? '#10b981' : '#ef4444',
          color: actionToast.type === 'success' ? '#000' : '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '10px', fontWeight: '800',
          fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          {actionToast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {actionToast.message}
        </div>
      )}

      {/* ─── MODAL MOTIF DE REFUS ─── */}
      {refusalModalColis && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '16px',
            padding: '1.5rem', width: '100%', maxWidth: '420px', color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldAlert size={18} /> Décliner la prise en charge
              </h3>
              <button
                onClick={() => setRefusalModalColis(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Colis <strong>{refusalModalColis.trackingCode}</strong> vers <strong>{refusalModalColis.clientCommune}</strong>.
              <br />
              Le vendeur sera immédiatement notifié avec votre motif pour lui permettre de choisir une autre agence.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!refusalReason.trim()) return;
              handleAgencyAction(refusalModalColis.id, 'reject', refusalReason.trim());
            }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Motif obligatoire du refus :
              </label>
              <textarea
                required
                rows={3}
                value={refusalReason}
                onChange={e => setRefusalReason(e.target.value)}
                placeholder="Ex: Hors zone de livraison actuelle, capacité de transport saturée, colis trop lourd..."
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '0.82rem', marginBottom: '1.25rem', resize: 'none',
                }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRefusalModalColis(null)}
                  style={{
                    flex: 1, height: '42px', borderRadius: '8px',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!refusalReason.trim() || actionLoading === refusalModalColis.id}
                  style={{
                    flex: 1, height: '42px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff', fontWeight: '800', fontSize: '0.82rem',
                    cursor: !refusalReason.trim() || actionLoading === refusalModalColis.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading === refusalModalColis.id ? 'Envoi...' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input { outline: none; }
        input:focus { border-color: rgba(245,158,11,0.4) !important; }
      `}</style>
    </div>
  );
}
