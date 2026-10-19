'use client';

import { useState, useEffect } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  Settings, Building2, Clock, ShieldCheck, MapPin,
  Lock, Save, CheckCircle2, AlertCircle, Phone, DollarSign
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

export default function AgencyParametresPage() {
  const { user } = useAuth('agence');
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canManageSettings = hasAgencyPermission(userRole, 'canManageSettings');

  // Paramètres généraux
  const [agencyName, setAgencyName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState('Kinshasa, RDC');

  // Horaires
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:30');
  const [enforceHours, setEnforceHours] = useState(false);

  // Sécurité & Anti-fraude
  const [requireApproval, setRequireApproval] = useState(true);

  // Changement de mot de passe
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
        {/* Titre */}
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
            Paramètres & Sécurité de l'Agence
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
            Configuration des coordonnées, règles de sécurité d'exploitation et protection du compte.
          </p>
        </div>

        {/* Section 1 : Informations Générales */}
        <div style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '16px', padding: '24px', boxShadow: 'var(--ag-card-shadow)'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 16px', color: 'var(--ag-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="var(--ag-brand)" />
            Profil & Coordonnées Agence
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                Nom de l'agence
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)', padding: '0 12px',
                  boxSizing: 'border-box', fontWeight: '600'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                Numéro de téléphone d'accueil
              </label>
              <input
                type="tel"
                disabled={!canManageSettings}
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)', padding: '0 12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 2 : Horaires d'exploitation & Sécurité */}
        <form onSubmit={handleSaveSettings} style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '16px', padding: '24px', boxShadow: 'var(--ag-card-shadow)',
          display: 'flex', flexDirection: 'column', gap: '18px'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--ag-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--ag-brand)" />
            Horaires d'Ouverture & Règles d'Exploitation
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                Heure d'ouverture (Kinshasa)
              </label>
              <input
                type="time"
                disabled={!canManageSettings}
                value={openingTime}
                onChange={e => setOpeningTime(e.target.value)}
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)', padding: '0 12px',
                  boxSizing: 'border-box', fontWeight: '700'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                Heure de fermeture (Kinshasa)
              </label>
              <input
                type="time"
                disabled={!canManageSettings}
                value={closingTime}
                onChange={e => setClosingTime(e.target.value)}
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)', padding: '0 12px',
                  boxSizing: 'border-box', fontWeight: '700'
                }}
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
                  Bloquer les opérations hors des horaires d'ouverture
                </span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>
                  Empêche les validations de versement ou clôtures de colis en dehors des heures de service prévues.
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
                  Exiger l'approbation du responsable (Maker / Checker)
                </span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>
                  Pour tout versement supérieur à 50$ ou régularisation d'écart de caisse.
                </p>
              </div>
            </label>
          </div>

          {canManageSettings && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
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

        {/* Section 3 : Sécurité du compte (Mot de Passe) */}
        <form onSubmit={handleChangePassword} style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '16px', padding: '24px', boxShadow: 'var(--ag-card-shadow)',
          display: 'flex', flexDirection: 'column', gap: '14px'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--ag-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="var(--ag-brand)" />
            Sécurité du Compte & Mot de Passe
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                Mot de passe actuel
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)', padding: '0 12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                Nouveau mot de passe
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)', padding: '0 12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)', padding: '0 12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
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
