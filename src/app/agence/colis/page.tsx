'use client';

import { useState, useEffect, useMemo } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  Package, Clock, CheckCircle2, AlertTriangle, Truck,
  Search, Filter, RefreshCw, Download, ChevronRight, X,
  MapPin, User, Phone, Check, ShieldAlert, ArrowUpRight,
  ExternalLink, Printer, Calendar
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

interface ColisRow {
  id: string;
  trackingCode: string;
  clientName: string;
  clientCommune: string;
  clientAddress?: string;
  clientPhone?: string;
  vendeurName: string;
  vendeurPhone?: string;
  status: string;
  prixColis: number;
  prixLivraison: number | null;
  driverId?: string | null;
  driverName: string | null;
  date: string;
  paidByClient: boolean;
  isPrepaid: boolean;
  validationCode?: string;
}

interface DriverOption {
  id: string;
  name: string;
  phone: string;
  available: boolean;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  'PENDING_AGENCY':        { label: 'En attente',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'ACCEPTED_BY_AGENCY':    { label: 'Accepté',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'REJECTED_BY_AGENCY':    { label: 'Refusé',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'ASSIGNED_TO_DRIVER':    { label: 'Assigné',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'IN_TRANSIT':            { label: 'En cours',      color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'DEPOSITED_AT_DROP_POINT':{ label: 'Au relais',    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'DELIVERED':             { label: 'Livré',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'CANCELLED':             { label: 'Annulé',        color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  'IN_DISPUTE':            { label: 'Litige',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function AgencyColisPage() {
  const { user } = useAuth('agence');
  const { formatPrice } = useCurrency();
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canEdit = hasAgencyPermission(userRole, 'canEditPackages');
  const canAssign = hasAgencyPermission(userRole, 'canAssignDrivers');

  const [colis, setColis] = useState<ColisRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [communeFilter, setCommuneFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');

  // Panneau latéral (Drawer)
  const [selectedColis, setSelectedColis] = useState<ColisRow | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal refus
  const [refusalModalColis, setRefusalModalColis] = useState<ColisRow | null>(null);
  const [refusalReason, setRefusalReason] = useState('');

  const fetchColis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agence/colis?limit=250', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setColis(data.colis || []);
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/agency/drivers', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
      }
    } catch {
      // Silencieux
    }
  };

  useEffect(() => {
    fetchColis();
    fetchDrivers();
  }, []);

  // Extraire les communes uniques pour le filtre
  const communes = useMemo(() => {
    const set = new Set<string>();
    colis.forEach(c => {
      if (c.clientCommune) set.add(c.clientCommune);
    });
    return Array.from(set).sort();
  }, [colis]);

  // Filtrage
  const filtered = useMemo(() => {
    return colis.filter(c => {
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchCommune = communeFilter === 'all' || c.clientCommune === communeFilter;
      const matchDriver = driverFilter === 'all' || (driverFilter === 'unassigned' ? !c.driverName : c.driverName === driverFilter);
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        c.trackingCode.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.vendeurName.toLowerCase().includes(q) ||
        (c.clientCommune && c.clientCommune.toLowerCase().includes(q));

      return matchStatus && matchCommune && matchDriver && matchSearch;
    });
  }, [colis, statusFilter, communeFilter, driverFilter, search]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 3000);
  };

  const handleAction = async (packageId: string, action: 'accept' | 'reject' | 'assign_driver', extra?: any) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/agence/colis/${packageId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Action validée', 'success');
        setRefusalModalColis(null);
        setRefusalReason('');
        if (action === 'assign_driver' && selectedColis?.id === packageId) {
          setSelectedColis(prev => prev ? { ...prev, status: 'ASSIGNED_TO_DRIVER', driverName: data.driverName } : null);
        }
        fetchColis();
      } else {
        showToast(data.error || 'Erreur lors de l’action', 'error');
      }
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Code', 'Client', 'Commune', 'Vendeur', 'Statut', 'Prix Marchandise', 'Frais Livraison', 'Livreur', 'Date'];
    const rows = filtered.map(c => [
      c.trackingCode, c.clientName, c.clientCommune, c.vendeurName,
      STATUS_META[c.status]?.label || c.status,
      c.prixColis, c.prixLivraison ?? '',
      c.driverName || 'Non assigné', c.date
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `colis-agence-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Titre & Export */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Gestion des Colis & Dispatch
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
              Suivi en temps réel de tous les colis assignés à votre agence, dispatch et validation des livraisons.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchColis}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                color: 'var(--ag-text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                backgroundColor: 'var(--ag-success-bg)', border: '1px solid var(--ag-success)',
                color: 'var(--ag-success)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700'
              }}
            >
              <Download size={14} />
              Export ({filtered.length})
            </button>
          </div>
        </div>

        {/* Barre de Filtres Avancés */}
        <div style={{
          backgroundColor: 'var(--ag-surface)',
          border: '1px solid var(--ag-border)',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          boxShadow: 'var(--ag-card-shadow)',
        }}>
          {/* Recherche texte */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ag-text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher code tracking, client, commune..."
              style={{
                width: '100%', height: '38px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                color: 'var(--ag-text-primary)', paddingLeft: '34px', paddingRight: '12px',
                fontSize: '0.85rem', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Filtre Statut */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              height: '38px', borderRadius: '8px', border: '1px solid var(--ag-border)',
              backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
              padding: '0 12px', fontSize: '0.82rem', fontWeight: '600'
            }}
          >
            <option value="all">Tous les statuts ({colis.length})</option>
            <option value="PENDING_AGENCY">En attente de validation</option>
            <option value="ACCEPTED_BY_AGENCY">Accepté par l'agence</option>
            <option value="ASSIGNED_TO_DRIVER">Assigné à un livreur</option>
            <option value="IN_TRANSIT">En cours de livraison</option>
            <option value="DELIVERED">Livré avec succès</option>
            <option value="REJECTED_BY_AGENCY">Refusé par l'agence</option>
            <option value="IN_DISPUTE">Litige / Réclamation</option>
          </select>

          {/* Filtre Commune */}
          <select
            value={communeFilter}
            onChange={e => setCommuneFilter(e.target.value)}
            style={{
              height: '38px', borderRadius: '8px', border: '1px solid var(--ag-border)',
              backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
              padding: '0 12px', fontSize: '0.82rem', fontWeight: '600'
            }}
          >
            <option value="all">Toutes les communes</option>
            {communes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Filtre Livreur */}
          <select
            value={driverFilter}
            onChange={e => setDriverFilter(e.target.value)}
            style={{
              height: '38px', borderRadius: '8px', border: '1px solid var(--ag-border)',
              backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
              padding: '0 12px', fontSize: '0.82rem', fontWeight: '600'
            }}
          >
            <option value="all">Tous les livreurs</option>
            <option value="unassigned">Non assigné</option>
            {drivers.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>

          {(statusFilter !== 'all' || communeFilter !== 'all' || driverFilter !== 'all' || search) && (
            <button
              onClick={() => { setStatusFilter('all'); setCommuneFilter('all'); setDriverFilter('all'); setSearch(''); }}
              style={{
                height: '38px', padding: '0 12px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'transparent',
                color: 'var(--ag-text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600'
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Tableau Dense des Colis */}
        <div style={{
          backgroundColor: 'var(--ag-surface)',
          border: '1px solid var(--ag-border)',
          borderRadius: '14px',
          boxShadow: 'var(--ag-card-shadow)',
          overflow: 'hidden'
        }}>
          <table className="agency-table">
            <thead>
              <tr>
                <th>Code Colis</th>
                <th>Client / Destination</th>
                <th>Vendeur Expéditeur</th>
                <th>Statut</th>
                <th>Montant Marchandise</th>
                <th>Livreur Assigné</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ag-text-muted)' }}>
                    Aucun colis trouvé avec ces critères de recherche.
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const meta = STATUS_META[c.status] || { label: c.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedColis(c)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: '800', color: 'var(--ag-brand)', fontSize: '0.85rem' }}>
                          {c.trackingCode}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--ag-text-primary)' }}>{c.clientName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={11} /> {c.clientCommune || 'Kinshasa'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--ag-text-secondary)' }}>{c.vendeurName}</div>
                      </td>

                      <td>
                        <span className="agency-badge" style={{ backgroundColor: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                          {formatPrice(c.prixColis)}
                        </div>
                        {c.isPrepaid ? (
                          <span style={{ fontSize: '0.68rem', color: 'var(--ag-success)', fontWeight: '700' }}>✓ Payé d'avance</span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--ag-warning)', fontWeight: '700' }}>À encaisser</span>
                        )}
                      </td>

                      <td>
                        {c.driverName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Truck size={14} style={{ color: 'var(--ag-brand)' }} />
                            <span style={{ fontWeight: '600', fontSize: '0.8rem' }}>{c.driverName}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            Non assigné
                          </span>
                        )}
                      </td>

                      <td style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>
                        {c.date}
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {c.status === 'PENDING_AGENCY' && canEdit && (
                            <>
                              <button
                                onClick={() => handleAction(c.id, 'accept')}
                                disabled={actionLoading}
                                style={{
                                  padding: '4px 8px', borderRadius: '6px', border: 'none',
                                  backgroundColor: 'var(--ag-success)', color: '#000',
                                  fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer'
                                }}
                              >
                                Accepter
                              </button>
                              <button
                                onClick={() => { setRefusalModalColis(c); setRefusalReason(''); }}
                                disabled={actionLoading}
                                style={{
                                  padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--ag-danger)',
                                  backgroundColor: 'var(--ag-danger-bg)', color: 'var(--ag-danger)',
                                  fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer'
                                }}
                              >
                                Refuser
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setSelectedColis(c)}
                            style={{
                              padding: '4px 8px', borderRadius: '6px',
                              border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                              color: 'var(--ag-text-secondary)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                              display: 'inline-flex', alignItems: 'center', gap: '2px'
                            }}
                          >
                            Détails <ChevronRight size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PANNEAU LATÉRAL DE DÉTAIL DU COLIS (DRAWER) ──────────────────── */}
      {selectedColis && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(3px)', zIndex: 90, display: 'flex', justifyContent: 'flex-end'
        }} onClick={() => setSelectedColis(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px', height: '100vh',
              backgroundColor: 'var(--ag-surface)', borderLeft: '1px solid var(--ag-border)',
              boxShadow: 'var(--ag-card-shadow-hover)', display: 'flex', flexDirection: 'column',
              animation: 'agSlideInRight 0.2s ease-out'
            }}
          >
            {/* Header du drawer */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid var(--ag-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
                  Fiche Colis Agence
                </span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--ag-brand)', fontFamily: 'monospace' }}>
                  {selectedColis.trackingCode}
                </h2>
              </div>
              <button
                onClick={() => setSelectedColis(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--ag-text-muted)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenu du drawer défilant */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Statut actuel */}
              <div style={{
                padding: '14px', borderRadius: '12px',
                backgroundColor: 'var(--ag-surface-hover)', border: '1px solid var(--ag-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--ag-text-secondary)' }}>Statut du colis</span>
                <span className="agency-badge" style={{
                  backgroundColor: STATUS_META[selectedColis.status]?.bg || 'rgba(148,163,184,0.1)',
                  color: STATUS_META[selectedColis.status]?.color || '#94a3b8',
                  fontSize: '0.8rem'
                }}>
                  {STATUS_META[selectedColis.status]?.label || selectedColis.status}
                </span>
              </div>

              {/* Destinataire */}
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--ag-text-muted)' }}>
                  Destinataire (Client)
                </span>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--ag-text-primary)' }}>
                  {selectedColis.clientName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
                  <MapPin size={14} color="var(--ag-brand)" />
                  <span>{selectedColis.clientCommune} {selectedColis.clientAddress ? `— ${selectedColis.clientAddress}` : ''}</span>
                </div>
                {selectedColis.clientPhone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
                    <Phone size={14} color="var(--ag-brand)" />
                    <a href={`tel:${selectedColis.clientPhone}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: '600' }}>
                      {selectedColis.clientPhone}
                    </a>
                  </div>
                )}
              </div>

              {/* Expéditeur */}
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--ag-text-muted)' }}>
                  Expéditeur (Vendeur Partenaire)
                </span>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--ag-text-primary)' }}>
                  {selectedColis.vendeurName}
                </div>
                {selectedColis.vendeurPhone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
                    <Phone size={14} color="var(--ag-text-muted)" />
                    <span>{selectedColis.vendeurPhone}</span>
                  </div>
                )}
              </div>

              {/* Détail Financier */}
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--ag-text-muted)' }}>
                  Détail financier
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--ag-text-secondary)' }}>Prix marchandise :</span>
                  <strong style={{ color: 'var(--ag-text-primary)' }}>{formatPrice(selectedColis.prixColis)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--ag-text-secondary)' }}>Frais livraison :</span>
                  <strong style={{ color: 'var(--ag-brand)' }}>{selectedColis.prixLivraison ? formatPrice(selectedColis.prixLivraison) : 'Inclus / Fixe'}</strong>
                </div>
                <div style={{ height: '1px', backgroundColor: 'var(--ag-border)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                  <span style={{ fontWeight: '700', color: 'var(--ag-text-primary)' }}>Total à encaisser :</span>
                  <strong style={{ fontWeight: '900', color: selectedColis.isPrepaid ? 'var(--ag-success)' : 'var(--ag-brand)' }}>
                    {selectedColis.isPrepaid ? '0 (Prépayé)' : formatPrice(selectedColis.prixColis + (selectedColis.prixLivraison || 0))}
                  </strong>
                </div>
              </div>

              {/* Assignation Livreur */}
              {canAssign && (
                <div style={{
                  backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                  borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--ag-text-muted)' }}>
                    Assigner un livreur de votre agence
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={assigningDriverId}
                      onChange={e => setAssigningDriverId(e.target.value)}
                      style={{
                        flex: 1, height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                        backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
                        padding: '0 10px', fontSize: '0.82rem', fontWeight: '600'
                      }}
                    >
                      <option value="">Sélectionner un livreur...</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.phone ? `(${d.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!assigningDriverId || actionLoading}
                      onClick={() => handleAction(selectedColis.id, 'assign_driver', { driverId: assigningDriverId })}
                      style={{
                        padding: '0 16px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'var(--ag-brand)', color: '#fff',
                        fontWeight: '700', fontSize: '0.82rem', cursor: assigningDriverId ? 'pointer' : 'not-allowed',
                        opacity: assigningDriverId ? 1 : 0.6
                      }}
                    >
                      Assigner
                    </button>
                  </div>
                  {selectedColis.driverName && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>
                      Livreur actuellement en charge : <strong style={{ color: 'var(--ag-text-primary)' }}>{selectedColis.driverName}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pied du drawer avec actions */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--ag-border)',
              display: 'flex', gap: '10px'
            }}>
              {selectedColis.status === 'PENDING_AGENCY' && canEdit && (
                <>
                  <button
                    onClick={() => handleAction(selectedColis.id, 'accept')}
                    disabled={actionLoading}
                    style={{
                      flex: 1, height: '42px', borderRadius: '8px', border: 'none',
                      backgroundColor: 'var(--ag-success)', color: '#000',
                      fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem'
                    }}
                  >
                    Accepter la prise en charge
                  </button>
                  <button
                    onClick={() => { setRefusalModalColis(selectedColis); setRefusalReason(''); }}
                    disabled={actionLoading}
                    style={{
                      height: '42px', padding: '0 16px', borderRadius: '8px',
                      border: '1px solid var(--ag-danger)', backgroundColor: 'var(--ag-danger-bg)',
                      color: 'var(--ag-danger)', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem'
                    }}
                  >
                    Refuser
                  </button>
                </>
              )}

              <button
                onClick={() => window.print()}
                style={{
                  height: '42px', padding: '0 16px', borderRadius: '8px',
                  border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                  color: 'var(--ag-text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Printer size={16} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL MOTIF DE REFUS ─── */}
      {refusalModalColis && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 120,
          backgroundColor: 'var(--ag-modal-overlay)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-danger)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--ag-card-shadow-hover)'
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: '800', color: 'var(--ag-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} /> Décliner la prise en charge
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--ag-text-secondary)', lineHeight: 1.4 }}>
              Colis <strong>{refusalModalColis.trackingCode}</strong> vers <strong>{refusalModalColis.clientCommune}</strong>.
              Le vendeur recevra immédiatement ce motif pour réassigner le colis.
            </p>

            <form onSubmit={e => {
              e.preventDefault();
              if (!refusalReason.trim()) return;
              handleAction(refusalModalColis.id, 'reject', { reason: refusalReason.trim() });
            }}>
              <textarea
                required
                rows={3}
                value={refusalReason}
                onChange={e => setRefusalReason(e.target.value)}
                placeholder="Ex: Capacité de transport saturée, adresse hors zone couverte..."
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                  color: 'var(--ag-text-primary)', fontSize: '0.85rem', marginBottom: '16px',
                  resize: 'none', boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRefusalModalColis(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                    backgroundColor: 'transparent', color: 'var(--ag-text-secondary)', fontWeight: '600'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!refusalReason.trim() || actionLoading}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-danger)', color: '#fff', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  {actionLoading ? 'Envoi...' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {actionToast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 130,
          backgroundColor: actionToast.type === 'success' ? 'var(--ag-success)' : 'var(--ag-danger)',
          color: actionToast.type === 'success' ? '#000' : '#fff',
          padding: '10px 18px', borderRadius: '10px', fontWeight: '800',
          fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px', animation: 'agFadeIn 0.15s ease'
        }}>
          {actionToast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {actionToast.message}
        </div>
      )}
    </AgencyShell>
  );
}
