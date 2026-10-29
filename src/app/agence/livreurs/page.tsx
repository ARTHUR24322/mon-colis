'use client';

import { useState, useEffect, useMemo } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  Truck, UserPlus, KeyRound, CheckCircle2, XCircle, RefreshCw,
  Search, Phone, ShieldCheck, AlertCircle, Eye, Lock, Edit2, ShieldAlert,
  Wallet, DollarSign, ArrowUpRight, ArrowDownLeft, Clock, MapPin, X,
  Package, ChevronRight, Check, AlertTriangle
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

interface RecentCourse {
  id: string;
  trackingCode: string;
  clientName: string;
  clientCommune: string;
  status: string;
  packagePrice: number;
  deliveryPrice: number;
  collectedAmount: number;
  isPrepaid: boolean;
  paidByClient: boolean;
  date: string;
}

interface VersementHistoryItem {
  id: string;
  amount: number;
  status: string;
  type: string;
  note: string;
  created_at: string;
  resolved_at?: string;
}

interface DriverItem {
  id: string;
  name: string;
  phone: string;
  available: boolean;
  created_at: string;
  totalDeliveries: number;
  activeCourses: number;
  totalCollectedCash: number;
  totalDepositedCash: number;
  cashOwedToAgency: number;
  pendingDeposits: number;
  recentCourses: RecentCourse[];
  versementsHistory: VersementHistoryItem[];
}

interface FleetStats {
  totalDrivers: number;
  availableDrivers: number;
  totalFleetDeliveries: number;
  totalFleetActiveCourses: number;
  totalFleetCashOwed: number;
  totalFleetCashDeposited: number;
  totalPendingDeposits: number;
}

export default function AgencyDriversPage() {
  const { user } = useAuth('agence');
  const { formatPrice } = useCurrency();
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canManage = hasAgencyPermission(userRole, 'canManageDrivers');

  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Tiroir Détail Livreur
  const [selectedDriver, setSelectedDriver] = useState<DriverItem | null>(null);
  const [driverDetailTab, setDriverDetailTab] = useState<'activites' | 'versements'>('activites');

  // Modal Création Livreur
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formVehicle, setFormVehicle] = useState('Moto');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal Reset PIN
  const [resetPinDriver, setResetPinDriver] = useState<DriverItem | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agency/drivers', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
        if (data.stats) setStats(data.stats);

        // Mettre à jour selectedDriver si déjà ouvert
        if (selectedDriver) {
          const updated = (data.drivers || []).find((d: DriverItem) => d.id === selectedDriver.id);
          if (updated) setSelectedDriver(updated);
        }
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPin || formPin.length !== 4 || !/^\d{4}$/.test(formPin)) {
      setFormError('Le code PIN doit comporter exactement 4 chiffres.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/agency/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          phone: formPhone.trim(),
          pinCode: formPin,
          vehicle: formVehicle,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Livreur ajouté avec succès.', 'success');
        setCreateModalOpen(false);
        setFormName('');
        setFormPhone('');
        setFormPin('');
        fetchDrivers();
      } else {
        setFormError(data.error || 'Erreur lors de l’ajout du livreur.');
      }
    } catch {
      setFormError('Erreur réseau.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinDriver || !newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast('Le code PIN doit comporter 4 chiffres.', 'error');
      return;
    }

    setPinSubmitting(true);
    try {
      const res = await fetch(`/api/agency/drivers/${resetPinDriver.id}/reset-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: newPin }),
      });

      if (res.ok) {
        showToast(`Code PIN de ${resetPinDriver.name} mis à jour.`, 'success');
        setResetPinDriver(null);
        setNewPin('');
      } else {
        const data = await res.json();
        showToast(data.error || 'Erreur lors de la réinitialisation.', 'error');
      }
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setPinSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return drivers.filter(d => !q || d.name.toLowerCase().includes(q) || d.phone.toLowerCase().includes(q));
  }, [drivers, search]);

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Flotte des Livreurs &amp; Activités
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
              Suivi en temps réel des courses, livraisons, historique des versements de caisse et dettes envers l&apos;agence.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchDrivers}
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

            {canManage && (
              <button
                onClick={() => setCreateModalOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 16px', borderRadius: '8px',
                  backgroundColor: 'var(--ag-brand)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
                  boxShadow: '0 2px 6px var(--ag-brand-glow)'
                }}
              >
                <UserPlus size={16} />
                Enrôler un livreur
              </button>
            )}
          </div>
        </div>

        {/* ─── VUE GÉNÉRALE : KPIS DE TOUTE LA FLOTTE ───────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
          {/* 1. Livreurs Actifs */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)',
            display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>
                Flotte Active
              </span>
              <Truck size={18} color="var(--ag-brand)" />
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: '900', color: 'var(--ag-text-primary)' }}>
              {stats?.availableDrivers ?? 0} <span style={{ fontSize: '1rem', color: 'var(--ag-text-muted)', fontWeight: '600' }}>/ {stats?.totalDrivers ?? drivers.length}</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>
              Livreurs disponibles en tournée
            </span>
          </div>

          {/* 2. Total Livraisons Flotte */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)',
            display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>
                Livraisons Réalisées
              </span>
              <CheckCircle2 size={18} color="var(--ag-success)" />
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: '900', color: 'var(--ag-text-primary)' }}>
              {stats?.totalFleetDeliveries ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>
              {stats?.totalFleetActiveCourses ?? 0} courses en cours de route
            </span>
          </div>

          {/* 3. Cash Dû par la Flotte à l'Agence */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)',
            display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase' }}>
                Cash Dû à l&apos;Agence
              </span>
              <Wallet size={18} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: '900', color: (stats?.totalFleetCashOwed ?? 0) > 0 ? '#f59e0b' : 'var(--ag-success)' }}>
              {formatPrice(stats?.totalFleetCashOwed ?? 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>
              Espèces collectées (COD) en attente de dépôt
            </span>
          </div>

          {/* 4. Versements Déjà Encaissés */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '16px', boxShadow: 'var(--ag-card-shadow)',
            display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>
                Versements Encaissés
              </span>
              <DollarSign size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: '900', color: '#10b981' }}>
              {formatPrice(stats?.totalFleetCashDeposited ?? 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: (stats?.totalPendingDeposits ?? 0) > 0 ? '#f59e0b' : 'var(--ag-text-secondary)' }}>
              {(stats?.totalPendingDeposits ?? 0) > 0 ? `⚠️ ${formatPrice(stats?.totalPendingDeposits ?? 0)} en attente guichet` : 'Tous les dépôts sont régularisés'}
            </span>
          </div>
        </div>

        {/* Barre de recherche */}
        <div style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center',
          boxShadow: 'var(--ag-card-shadow)'
        }}>
          <Search size={16} style={{ color: 'var(--ag-text-muted)', marginRight: '10px' }} />
          <input
            type="text"
            placeholder="Rechercher un livreur par nom ou numéro de téléphone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', border: 'none', backgroundColor: 'transparent',
              color: 'var(--ag-text-primary)', fontSize: '0.88rem', outline: 'none'
            }}
          />
        </div>

        {/* ─── TABLEAU DES LIVREURS AVEC ACTIVITÉ & SOLDE ────────────────────── */}
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
                <th>Livreur</th>
                <th>Téléphone</th>
                <th>Disponibilité</th>
                <th>Livraisons</th>
                <th>Courses en cours</th>
                <th>Cash Dû à l&apos;Agence</th>
                <th>Versements Déposés</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ag-text-muted)' }}>
                    Aucun livreur affilié trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDriver(d)}
                    style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          backgroundColor: selectedDriver?.id === d.id ? 'var(--ag-brand)' : 'var(--ag-brand-subtle)',
                          color: selectedDriver?.id === d.id ? '#fff' : 'var(--ag-brand)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '800', fontSize: '0.85rem'
                        }}>
                          <Truck size={17} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--ag-text-primary)' }}>{d.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)' }}>ID: {d.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                        <Phone size={13} style={{ color: 'var(--ag-text-muted)' }} />
                        <span style={{ fontWeight: '600', color: 'var(--ag-text-secondary)' }}>
                          {d.phone || '—'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="agency-badge" style={{
                        backgroundColor: d.available ? 'var(--ag-success-bg)' : 'var(--ag-surface-hover)',
                        color: d.available ? 'var(--ag-success)' : 'var(--ag-text-muted)'
                      }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          backgroundColor: d.available ? 'var(--ag-success)' : 'var(--ag-text-muted)'
                        }} />
                        {d.available ? 'Disponible' : 'Indisponible'}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontWeight: '700', color: 'var(--ag-text-primary)', fontSize: '0.9rem' }}>
                        {d.totalDeliveries || 0}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', marginLeft: '4px' }}>livrées</span>
                    </td>

                    <td>
                      {d.activeCourses > 0 ? (
                        <span className="agency-badge" style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                          🚴 {d.activeCourses} en cours
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>0 course</span>
                      )}
                    </td>

                    <td>
                      <span style={{
                        fontWeight: '800', fontSize: '0.92rem',
                        color: d.cashOwedToAgency > 0 ? '#f59e0b' : 'var(--ag-success)'
                      }}>
                        {formatPrice(d.cashOwedToAgency)}
                      </span>
                      {d.pendingDeposits > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: '600' }}>
                          (dont {formatPrice(d.pendingDeposits)} en attente)
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{ fontWeight: '700', color: '#10b981', fontSize: '0.88rem' }}>
                        {formatPrice(d.totalDepositedCash)}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => setSelectedDriver(d)}
                          style={{
                            padding: '6px 10px', borderRadius: '6px',
                            border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                            color: 'var(--ag-brand)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Eye size={13} /> Activité
                        </button>
                        {canManage && (
                          <button
                            onClick={() => { setResetPinDriver(d); setNewPin(''); }}
                            style={{
                              padding: '6px 10px', borderRadius: '6px',
                              border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                              color: 'var(--ag-text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <KeyRound size={13} /> PIN
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PANNEAU LATÉRAL : DÉTAIL COMPLET DU LIVREUR (DRAWER) ─────────────── */}
      {selectedDriver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'flex-end', animation: 'agFadeIn 0.15s ease'
        }}>
          <div style={{
            width: '100%', maxWidth: '580px', height: '100%', backgroundColor: 'var(--ag-surface)',
            borderLeft: '1px solid var(--ag-border)', display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--ag-card-shadow-hover)', overflow: 'hidden'
          }}>
            {/* En-tête drawer */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--ag-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  backgroundColor: 'var(--ag-brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.1rem'
                }}>
                  <Truck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                    {selectedDriver.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ag-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{selectedDriver.phone || 'Sans numéro'}</span>
                    <span>•</span>
                    <span style={{ color: selectedDriver.available ? 'var(--ag-success)' : 'var(--ag-text-muted)', fontWeight: '700' }}>
                      {selectedDriver.available ? '● En service' : '○ Indisponible'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedDriver(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--ag-text-muted)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps défilable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Synthèse financière du livreur */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{
                  backgroundColor: 'var(--ag-surface-hover)', borderRadius: '10px', padding: '12px',
                  border: '1px solid var(--ag-border)'
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>
                    Livraisons
                  </span>
                  <div style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--ag-text-primary)', marginTop: '2px' }}>
                    {selectedDriver.totalDeliveries}
                  </div>
                </div>

                <div style={{
                  backgroundColor: selectedDriver.cashOwedToAgency > 0 ? 'rgba(245,158,11,0.1)' : 'var(--ag-surface-hover)',
                  borderRadius: '10px', padding: '12px',
                  border: `1px solid ${selectedDriver.cashOwedToAgency > 0 ? '#f59e0b' : 'var(--ag-border)'}`
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: selectedDriver.cashOwedToAgency > 0 ? '#f59e0b' : 'var(--ag-text-muted)', textTransform: 'uppercase' }}>
                    Cash Dû Agence
                  </span>
                  <div style={{ fontSize: '1.3rem', fontWeight: '900', color: selectedDriver.cashOwedToAgency > 0 ? '#f59e0b' : 'var(--ag-success)', marginTop: '2px' }}>
                    {formatPrice(selectedDriver.cashOwedToAgency)}
                  </div>
                </div>

                <div style={{
                  backgroundColor: 'var(--ag-surface-hover)', borderRadius: '10px', padding: '12px',
                  border: '1px solid var(--ag-border)'
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>
                    Total Versé
                  </span>
                  <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>
                    {formatPrice(selectedDriver.totalDepositedCash)}
                  </div>
                </div>
              </div>

              {/* Alerte si dépôt en attente de validation */}
              {selectedDriver.pendingDeposits > 0 && (
                <div style={{
                  backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#60a5fa' }}>
                    <Clock size={16} />
                    <span>Dépôt de <strong>{formatPrice(selectedDriver.pendingDeposits)}</strong> en attente de confirmation</span>
                  </div>
                  <a
                    href="/agence/versements"
                    style={{
                      padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--ag-brand)',
                      color: '#fff', fontSize: '0.74rem', fontWeight: '700', textDecoration: 'none'
                    }}
                  >
                    Valider en caisse →
                  </a>
                </div>
              )}

              {/* Onglets du tiroir */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--ag-border)', paddingBottom: '8px' }}>
                <button
                  onClick={() => setDriverDetailTab('activites')}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                    backgroundColor: driverDetailTab === 'activites' ? 'var(--ag-brand-subtle)' : 'transparent',
                    color: driverDetailTab === 'activites' ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
                    fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                  }}
                >
                  📦 Courses &amp; Livraisons ({selectedDriver.recentCourses?.length || 0})
                </button>
                <button
                  onClick={() => setDriverDetailTab('versements')}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                    backgroundColor: driverDetailTab === 'versements' ? 'var(--ag-brand-subtle)' : 'transparent',
                    color: driverDetailTab === 'versements' ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
                    fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                  }}
                >
                  💵 Historique des Versements ({selectedDriver.versementsHistory?.length || 0})
                </button>
              </div>

              {/* CONTENU ONGLET 1 : COURSES ET LIVRAISONS */}
              {driverDetailTab === 'activites' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(!selectedDriver.recentCourses || selectedDriver.recentCourses.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ag-text-muted)', fontSize: '0.85rem' }}>
                      Aucune course assignée à ce livreur.
                    </div>
                  ) : (
                    selectedDriver.recentCourses.map(c => (
                      <div
                        key={c.id}
                        style={{
                          backgroundColor: 'var(--ag-surface-hover)', border: '1px solid var(--ag-border)',
                          borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--ag-text-primary)' }}>
                            {c.trackingCode}
                          </span>
                          <span className="agency-badge" style={{
                            backgroundColor: c.status === 'DELIVERED' ? 'var(--ag-success-bg)' : 'rgba(59,130,246,0.12)',
                            color: c.status === 'DELIVERED' ? 'var(--ag-success)' : '#3b82f6',
                            fontSize: '0.7rem'
                          }}>
                            {c.status === 'DELIVERED' ? '✓ Livré' : c.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--ag-text-secondary)' }}>
                          <span>Destinataire : <strong>{c.clientName}</strong> ({c.clientCommune})</span>
                          <span>{c.date}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--ag-border)', paddingTop: '6px', marginTop: '2px', fontSize: '0.78rem' }}>
                          <span style={{ color: 'var(--ag-text-muted)' }}>Montant encaissé (COD) :</span>
                          <strong style={{ color: c.collectedAmount > 0 ? 'var(--ag-brand)' : 'var(--ag-text-muted)' }}>
                            {c.isPrepaid ? 'Prépayé ($0)' : formatPrice(c.collectedAmount)}
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* CONTENU ONGLET 2 : HISTORIQUE DES VERSEMENTS DE CAISSE */}
              {driverDetailTab === 'versements' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(!selectedDriver.versementsHistory || selectedDriver.versementsHistory.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ag-text-muted)', fontSize: '0.85rem' }}>
                      Aucun versement de caisse enregistré pour ce livreur.
                    </div>
                  ) : (
                    selectedDriver.versementsHistory.map(v => (
                      <div
                        key={v.id}
                        style={{
                          backgroundColor: 'var(--ag-surface-hover)', border: '1px solid var(--ag-border)',
                          borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--ag-text-primary)' }}>
                              {formatPrice(v.amount)}
                            </strong>
                            <span className="agency-badge" style={{
                              backgroundColor: v.status === 'PAID' ? 'var(--ag-success-bg)' : v.status === 'PENDING' ? 'var(--ag-warning-bg)' : 'var(--ag-danger-bg)',
                              color: v.status === 'PAID' ? 'var(--ag-success)' : v.status === 'PENDING' ? 'var(--ag-warning)' : 'var(--ag-danger)',
                              fontSize: '0.7rem'
                            }}>
                              {v.status === 'PAID' ? '✅ Encaissé en caisse' : v.status === 'PENDING' ? '⏳ En attente guichet' : v.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--ag-text-muted)', marginTop: '2px' }}>
                            {new Date(v.created_at).toLocaleString('fr-FR')} • {v.type === 'QR_DEPOSIT' ? 'Dépôt QR Code' : 'Dépôt Guichet'}
                          </div>
                        </div>

                        {v.note && v.note !== '—' && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-secondary)', fontFamily: 'monospace' }}>
                            {v.note}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Pied drawer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--ag-border)',
              display: 'flex', gap: '10px'
            }}>
              {selectedDriver.phone && (
                <a
                  href={`tel:${selectedDriver.phone}`}
                  style={{
                    flex: 1, height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                    backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    textDecoration: 'none', fontWeight: '700', fontSize: '0.82rem'
                  }}
                >
                  <Phone size={15} /> Appeler {selectedDriver.name}
                </a>
              )}
              {canManage && (
                <button
                  onClick={() => { setResetPinDriver(selectedDriver); setNewPin(''); }}
                  style={{
                    flex: 1, height: '40px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-brand)', color: '#fff',
                    fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <KeyRound size={15} /> Changer Code PIN
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ENRÔLEMENT LIVREUR ─────────────────────────────────────── */}
      {createModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
              Enrôler un Nouveau Livreur
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Le livreur recevra son code PIN pour se connecter à l&apos;application mobile Mon Colis.
            </p>

            {formError && (
              <div style={{
                backgroundColor: 'var(--ag-danger-bg)', border: '1px solid var(--ag-danger)',
                borderRadius: '8px', padding: '10px', fontSize: '0.8rem', color: 'var(--ag-danger)', marginBottom: '14px'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateDriver} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Nom complet du coursier
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Samuel Kalonji"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '0.88rem', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Numéro de Téléphone (Identifiant connexion)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex : 0812345678"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '0.88rem', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                    Type de Véhicule
                  </label>
                  <select
                    value={formVehicle}
                    onChange={e => setFormVehicle(e.target.value)}
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                      color: 'var(--ag-text-primary)', padding: '0 10px', fontSize: '0.85rem', boxSizing: 'border-box'
                    }}
                  >
                    <option value="Moto">Moto</option>
                    <option value="Vélo">Vélo</option>
                    <option value="Voiture">Voiture</option>
                    <option value="À pied">À pied</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                    Code PIN (4 chiffres)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={formPin}
                    onChange={e => setFormPin(e.target.value.replace(/\D/g, ''))}
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                      color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '0.88rem',
                      textAlign: 'center', letterSpacing: '4px', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                    backgroundColor: 'transparent', color: 'var(--ag-text-secondary)', fontWeight: '600'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-brand)', color: '#fff', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {formSubmitting ? 'Enrôlement...' : 'Valider l’enrôlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL RESET PIN ──────────────────────────────────────────────── */}
      {resetPinDriver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
              Réinitialiser Code PIN
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Nouveau code secret pour <strong>{resetPinDriver.name}</strong> :
            </p>

            <form onSubmit={handleResetPin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Nouveau PIN (4 chiffres)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="••••"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%', height: '44px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '1.2rem',
                    textAlign: 'center', letterSpacing: '6px', fontWeight: '800', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setResetPinDriver(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                    backgroundColor: 'transparent', color: 'var(--ag-text-secondary)', fontWeight: '600'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pinSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-brand)', color: '#fff', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {pinSubmitting ? 'Mise à jour...' : 'Confirmer le PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATION ────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 120,
          padding: '12px 20px', borderRadius: '10px',
          backgroundColor: toast.type === 'success' ? 'var(--ag-success)' : 'var(--ag-danger)',
          color: toast.type === 'success' ? '#000' : '#fff',
          fontWeight: '700', fontSize: '0.85rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'agFadeIn 0.2s ease'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </AgencyShell>
  );
}
