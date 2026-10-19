'use client';

import { useState, useEffect, useCallback } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import {
  Building2, Clock, Lock, Save, CheckCircle2,
  Plus, Trash2, DollarSign, Truck, MapPin, RefreshCw
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

interface CommunePrice {
  commune: string;
  price: number;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  borderRadius: '8px',
  border: '1px solid var(--ag-border)',
  backgroundColor: 'var(--ag-surface-hover)',
  color: 'var(--ag-text-primary)',
  padding: '0 12px',
  boxSizing: 'border-box',
  fontSize: '0.88rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: '700',
  marginBottom: '4px',
  color: 'var(--ag-text-secondary)',
};

export default function AgencyParametresPage() {
  const { user } = useAuth('agence');
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canManageSettings = hasAgencyPermission(userRole, 'canManageSettings');

  // ── Paramètres généraux ────────────────────────────────────────────────
  const [agencyName, setAgencyName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // ── Horaires d'exploitation ────────────────────────────────────────────
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:30');
  const [enforceHours, setEnforceHours] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  // ── Tarification par commune ───────────────────────────────────────────
  const [communePrices, setCommunePrices] = useState<CommunePrice[]>([]);
  const [newCommune, setNewCommune] = useState('');
  const [newCommunePrice, setNewCommunePrice] = useState('');
  const [pricePerKm, setPricePerKm] = useState('0');
  const [pricePerKg, setPricePerKg] = useState('0');
  const [tauxFC, setTauxFC] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(true);

  // ── Sécurité / Mot de passe ────────────────────────────────────────────
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Chargement initial des tarifs ──────────────────────────────────────
  const loadPricingSettings = useCallback(async () => {
    setLoadingPricing(true);
    try {
      const res = await fetch('/api/agency/settings');
      if (res.ok) {
        const data = await res.json();
        setCommunePrices(Array.isArray(data.communePrices) ? data.communePrices : []);
        setPricePerKm(String(data.pricePerKm ?? 0));
        setPricePerKg(String(data.pricePerKg ?? 0));
        if (data.tauxConversionFC) setTauxFC(String(data.tauxConversionFC));
      }
    } catch {
      // silencieux
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  useEffect(() => {
    loadPricingSettings();
  }, [loadPricingSettings]);

  // ── Ajout d'une commune ────────────────────────────────────────────────
  const handleAddCommune = () => {
    const trimmed = newCommune.trim();
    const price = parseFloat(newCommunePrice);
    if (!trimmed || isNaN(price) || price < 0) {
      showToast('Saisissez un nom de commune et un prix valide.', 'error');
      return;
    }
    const already = communePrices.findIndex(cp => cp.commune.toLowerCase() === trimmed.toLowerCase());
    if (already >= 0) {
      // Mise à jour
      const updated = [...communePrices];
      updated[already] = { commune: trimmed, price };
      setCommunePrices(updated);
    } else {
      setCommunePrices(prev => [...prev, { commune: trimmed, price }]);
    }
    setNewCommune('');
    setNewCommunePrice('');
  };

  const handleRemoveCommune = (idx: number) => {
    setCommunePrices(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateCommunePrice = (idx: number, price: number) => {
    const updated = [...communePrices];
    updated[idx] = { ...updated[idx], price };
    setCommunePrices(updated);
  };

  // ── Sauvegarde des tarifs ──────────────────────────────────────────────
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;
    setPricingLoading(true);

    try {
      const body: Record<string, unknown> = {
        communePrices,
        pricePerKm: parseFloat(pricePerKm) || 0,
        pricePerKg: parseFloat(pricePerKg) || 0,
      };
      if (tauxFC && parseFloat(tauxFC) > 0) {
        body.tauxConversionFC = parseFloat(tauxFC);
      }

      const res = await fetch('/api/agency/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast('Grille tarifaire enregistrée avec succès.', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Erreur lors de la sauvegarde.', 'error');
      }
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setPricingLoading(false);
    }
  };

  // ── Sauvegarde des règles d'exploitation ──────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;

    try {
      const res = await fetch('/api/agency/pro-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          require_manager_approval: requireApproval,
          enforce_hours: enforceHours,
          allowed_start_time: openingTime,
          allowed_end_time: closingTime,
        }),
      });
      if (res.ok) {
        showToast('Paramètres agence enregistrés avec succès.', 'success');
      } else {
        showToast('Erreur lors de la sauvegarde.', 'error');
      }
    } catch {
      showToast('Erreur réseau.', 'error');
    }
  };

  // ── Changement de mot de passe ─────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Le mot de passe doit faire au moins 6 caractères.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Les deux mots de passe ne correspondent pas.', 'error');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch('/api/agency/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Mot de passe mis à jour avec succès.', 'success');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(data.error || 'Erreur lors du changement de mot de passe.', 'error');
      }
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--ag-surface)',
    border: '1px solid var(--ag-border)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: 'var(--ag-card-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  };

  const sectionTitle = (icon: React.ReactNode, text: string) => (
    <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--ag-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      {text}
    </h3>
  );

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>

        {/* Titre */}
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
            Paramètres &amp; Configuration de l&apos;Agence
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
            Tarification par commune, horaires d&apos;ouverture, règles de sécurité et gestion du compte.
          </p>
        </div>

        {/* ── Section 1 : Tarification par commune ── */}
        <form onSubmit={handleSavePricing} style={cardStyle}>
          {sectionTitle(<DollarSign size={18} color="var(--ag-brand)" />, 'Grille Tarifaire de Livraison')}

          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ag-text-muted)', lineHeight: 1.5 }}>
            Ces tarifs sont utilisés pour calculer automatiquement le devis présenté aux vendeurs lors de la création d&apos;un colis.
            Le prix final = <strong>tarif commune</strong> + (poids × tarif/kg) + (distance × tarif/km).
          </p>

          {/* Tarifs globaux */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Prix par km (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerKm}
                onChange={e => setPricePerKm(e.target.value)}
                disabled={!canManageSettings}
                style={inputStyle}
                placeholder="Ex : 0.15"
              />
            </div>
            <div>
              <label style={labelStyle}>Prix par kg (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerKg}
                onChange={e => setPricePerKg(e.target.value)}
                disabled={!canManageSettings}
                style={inputStyle}
                placeholder="Ex : 0.50"
              />
            </div>
            <div>
              <label style={labelStyle}>Taux de conversion FC (optionnel)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={tauxFC}
                onChange={e => setTauxFC(e.target.value)}
                disabled={!canManageSettings}
                style={inputStyle}
                placeholder="Ex : 2850 (plafonné par l'admin)"
              />
            </div>
          </div>

          {/* Tableau des communes */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                <MapPin size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Tarifs par commune de destination ({communePrices.length} configuré{communePrices.length > 1 ? 's' : ''})
              </label>
              <button
                type="button"
                onClick={loadPricingSettings}
                title="Recharger depuis la base"
                style={{ background: 'none', border: 'none', color: 'var(--ag-text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {loadingPricing ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--ag-text-muted)', padding: '8px 0' }}>
                Chargement des tarifs...
              </div>
            ) : communePrices.length === 0 ? (
              <div style={{
                padding: '20px', textAlign: 'center',
                border: '1px dashed var(--ag-border)', borderRadius: '10px',
                color: 'var(--ag-text-muted)', fontSize: '0.8rem'
              }}>
                Aucune commune configurée. Ajoutez une commune ci-dessous pour que les devis vendeurs affichent automatiquement les tarifs.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                {communePrices.map((cp, idx) => (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 36px',
                    gap: '8px', alignItems: 'center',
                    padding: '8px 10px', borderRadius: '8px',
                    backgroundColor: 'var(--ag-surface-hover)',
                    border: '1px solid var(--ag-border)',
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--ag-text-primary)' }}>
                      📍 {cp.commune}
                    </span>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cp.price}
                        onChange={e => handleUpdateCommunePrice(idx, parseFloat(e.target.value) || 0)}
                        disabled={!canManageSettings}
                        style={{
                          ...inputStyle,
                          height: '32px',
                          paddingRight: '36px',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          color: 'var(--ag-brand)',
                        }}
                      />
                      <span style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        fontSize: '0.7rem', color: 'var(--ag-text-muted)', pointerEvents: 'none'
                      }}>USD</span>
                    </div>
                    {canManageSettings && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCommune(idx)}
                        style={{
                          height: '32px', width: '32px', borderRadius: '8px', border: 'none',
                          backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ajouter une commune */}
            {canManageSettings && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '8px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Nom de la commune (ex : Gombe)"
                  value={newCommune}
                  onChange={e => setNewCommune(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCommune())}
                  style={{ ...inputStyle, height: '38px' }}
                />
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Prix USD"
                    value={newCommunePrice}
                    onChange={e => setNewCommunePrice(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCommune())}
                    style={{ ...inputStyle, height: '38px', paddingRight: '36px' }}
                  />
                  <span style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.7rem', color: 'var(--ag-text-muted)', pointerEvents: 'none'
                  }}>USD</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddCommune}
                  style={{
                    height: '38px', padding: '0 14px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-brand)', color: '#fff',
                    fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            )}
          </div>

          {canManageSettings && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={pricingLoading}
                style={{
                  padding: '9px 22px', borderRadius: '8px', border: 'none',
                  backgroundColor: pricingLoading ? 'var(--ag-text-muted)' : 'var(--ag-brand)',
                  color: '#fff', fontWeight: '800', fontSize: '0.82rem',
                  cursor: pricingLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Save size={15} />
                {pricingLoading ? 'Enregistrement...' : 'Enregistrer la grille tarifaire'}
              </button>
            </div>
          )}
        </form>

        {/* ── Section 2 : Profil Agence ── */}
        <div style={{ ...cardStyle, gap: '14px' }}>
          {sectionTitle(<Building2 size={18} color="var(--ag-brand)" />, 'Profil & Coordonnées Agence')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nom de l&apos;agence</label>
              <input
                type="text"
                disabled={!canManageSettings}
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                style={{ ...inputStyle, fontWeight: '600' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Numéro de téléphone d&apos;accueil</label>
              <input
                type="tel"
                disabled={!canManageSettings}
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ── Section 3 : Horaires & Exploitation ── */}
        <form onSubmit={handleSaveSettings} style={cardStyle}>
          {sectionTitle(<Clock size={18} color="var(--ag-brand)" />, "Horaires d'Ouverture & Règles d'Exploitation")}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Heure d&apos;ouverture (Kinshasa)</label>
              <input
                type="time"
                disabled={!canManageSettings}
                value={openingTime}
                onChange={e => setOpeningTime(e.target.value)}
                style={{ ...inputStyle, fontWeight: '700' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Heure de fermeture (Kinshasa)</label>
              <input
                type="time"
                disabled={!canManageSettings}
                value={closingTime}
                onChange={e => setClosingTime(e.target.value)}
                style={{ ...inputStyle, fontWeight: '700' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                disabled={!canManageSettings}
                checked={enforceHours}
                onChange={e => setEnforceHours(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--ag-text-primary)' }}>
                  Bloquer les opérations hors des horaires d&apos;ouverture
                </span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>
                  Empêche les validations de versement ou clôtures de colis en dehors des heures de service.
                </p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                disabled={!canManageSettings}
                checked={requireApproval}
                onChange={e => setRequireApproval(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--ag-text-primary)' }}>
                  Exiger l&apos;approbation du responsable (Maker / Checker)
                </span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>
                  Pour tout versement supérieur à 50$ ou régularisation d&apos;écart de caisse.
                </p>
              </div>
            </label>
          </div>

          {canManageSettings && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'var(--ag-brand)', color: '#fff',
                  fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Save size={15} /> Enregistrer les règles
              </button>
            </div>
          )}
        </form>

        {/* ── Section 4 : Sécurité du compte ── */}
        <form onSubmit={handleChangePassword} style={cardStyle}>
          {sectionTitle(<Lock size={18} color="var(--ag-brand)" />, 'Sécurité du Compte & Mot de Passe')}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Mot de passe actuel</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={pwdLoading}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--ag-brand)', color: '#fff',
                fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              {pwdLoading ? 'Mise à jour...' : 'Modifier le mot de passe'}
            </button>
          </div>
        </form>
      </div>

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
