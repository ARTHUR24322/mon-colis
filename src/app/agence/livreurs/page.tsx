'use client';

import { useState, useEffect } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  Truck, UserPlus, KeyRound, CheckCircle2, XCircle, RefreshCw,
  Search, Phone, ShieldCheck, AlertCircle, Eye, Lock, Edit2, ShieldAlert
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

interface DriverItem {
  id: string;
  name: string;
  phone: string;
  available: boolean;
  created_at: string;
}

export default function AgencyDriversPage() {
  const { user } = useAuth('agence');
  const { formatPrice } = useCurrency();
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canManage = hasAgencyPermission(userRole, 'canManageDrivers');

  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const filtered = drivers.filter(d => {
    const q = search.toLowerCase().trim();
    return !q || d.name.toLowerCase().includes(q) || d.phone.toLowerCase().includes(q);
  });

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Titre & Ajout */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Flotte des Livreurs Partenaires
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
              Gestion des coursiers affiliés à votre agence, attribution des courses et réinitialisation des accès PIN.
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

        {/* Tableau des Livreurs */}
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
                <th>Statut Activité</th>
                <th>Enrôlé le</th>
                {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ag-text-muted)' }}>
                    Aucun livreur affilié trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          backgroundColor: 'var(--ag-brand-subtle)', color: 'var(--ag-brand)',
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
                        <a href={`tel:${d.phone}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: '600' }}>
                          {d.phone}
                        </a>
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
                        {d.available ? 'Disponible en course' : 'Indisponible'}
                      </span>
                    </td>

                    <td style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </td>

                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => { setResetPinDriver(d); setNewPin(''); }}
                          style={{
                            padding: '6px 12px', borderRadius: '6px',
                            border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                            color: 'var(--ag-text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <KeyRound size={13} />
                          Changer Code PIN
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL ENRÔLER LIVREUR ────────────────────────────────────────── */}
      {createModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Enrôler un nouveau livreur
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Le livreur pourra se connecter sur son application mobile avec son numéro et ce code PIN à 4 chiffres.
            </p>

            {formError && (
              <div style={{
                backgroundColor: 'var(--ag-danger-bg)', color: 'var(--ag-danger)',
                border: '1px solid var(--ag-danger)', borderRadius: '8px', padding: '8px 12px',
                fontSize: '0.8rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDriver} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Nom complet du livreur *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Patrick Banza"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Numéro de téléphone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="081XXXXXXX ou +243..."
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Code PIN de connexion (4 chiffres) *
                </label>
                <input
                  type="password"
                  required
                  maxLength={4}
                  placeholder="1234"
                  value={formPin}
                  onChange={e => setFormPin(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', boxSizing: 'border-box',
                    textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.3em', fontWeight: '800'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
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
                    backgroundColor: 'var(--ag-brand)', color: '#fff', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  {formSubmitting ? 'Enrôlement...' : 'Créer l’accès livreur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL RESET PIN ──────────────────────────────────────────────── */}
      {resetPinDriver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
              Nouveau code PIN pour {resetPinDriver.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Entrez le nouveau code PIN à 4 chiffres :
            </p>

            <form onSubmit={handleResetPin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="password"
                required
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%', height: '48px', borderRadius: '8px',
                  border: '2px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                  color: 'var(--ag-text-primary)', textAlign: 'center', fontSize: '1.4rem',
                  letterSpacing: '0.3em', fontWeight: '900', boxSizing: 'border-box'
                }}
              />

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
                  disabled={pinSubmitting || newPin.length !== 4}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-brand)', color: '#fff', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  {pinSubmitting ? 'Mise à jour...' : 'Sauvegarder le PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 120,
          backgroundColor: toast.type === 'success' ? 'var(--ag-success)' : 'var(--ag-danger)',
          color: toast.type === 'success' ? '#000' : '#fff',
          padding: '10px 18px', borderRadius: '10px', fontWeight: '800',
          fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px', animation: 'agFadeIn 0.15s ease'
        }}>
          <CheckCircle2 size={16} />
          {toast.message}
        </div>
      )}
    </AgencyShell>
  );
}
