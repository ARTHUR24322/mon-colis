'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/utils/adminAuth';
import {
  Shield, Users, User, Check, X, Ban, RefreshCw, ArrowLeft,
  Plus, Key, Trash2, ChevronDown, Building2, Package,
  Eye, EyeOff, CheckCircle2, AlertTriangle, Info, Crown,
  Settings, Lock, Truck,
} from 'lucide-react';
import type { AdminRole } from '@/lib/adminPermissions';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/adminPermissions';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AdminAccount {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  lastLoginAt?: string;
}

// ─── Données des permissions (affichage) ──────────────────────────────────────
const PERMISSION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  canManageAgences:    { label: 'Gérer les agences',       icon: Building2   },
  canManageRelais:     { label: 'Gérer les points relais', icon: Package     },
  canManageVendeurs:   { label: 'Gérer les vendeurs',      icon: User        },
  canManageLivreurs:   { label: 'Gérer les livreurs',      icon: Truck       },
  canManageColis:      { label: 'Voir les colis',          icon: Package     },
  canViewSecurityLogs: { label: 'Centre de sécurité',      icon: Shield      },
  canManageAdmins:     { label: 'Gérer les admins',        icon: Crown       },
  canManageSettings:   { label: 'Paramètres système',      icon: Settings    },
  canViewDiagnostics:  { label: 'Diagnostique système',    icon: AlertTriangle },
};

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleAdminBadge({ role }: { role: AdminRole }) {
  const cfg = ROLE_LABELS[role];
  const Icon = role === 'superadmin' ? Crown : role === 'admin_agences' ? Building2 : Package;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}40`,
      padding: '0.2rem 0.65rem', borderRadius: '20px',
      fontSize: '0.73rem', fontWeight: '700',
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Carte permissions ────────────────────────────────────────────────────────
function PermissionsCard({ role }: { role: AdminRole }) {
  const perms = ROLE_PERMISSIONS[role];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px', padding: '1rem',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem',
    }}>
      {(Object.entries(PERMISSION_LABELS) as [string, { label: string; icon: React.ComponentType<{size?:number;color?:string}> }][]).map(([key, { label, icon: Icon }]) => {
        const active = perms[key as keyof typeof perms];
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', opacity: active ? 1 : 0.3 }}>
            <Icon size={13} color={active ? '#22c55e' : 'rgba(255,255,255,0.3)'} />
            <span style={{ color: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>{label}</span>
            {active
              ? <Check size={11} color="#22c55e" style={{ marginLeft: 'auto' }} />
              : <X     size={11} color="rgba(255,255,255,0.2)" style={{ marginLeft: 'auto' }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal Créer Admin ────────────────────────────────────────────────────────
function CreateAdminModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (admin: AdminAccount) => void;
}) {
  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [role,        setRole]        = useState<'admin_agences' | 'admin_relais'>('admin_agences');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showPerms,   setShowPerms]   = useState(false);

  const reset = () => {
    setUsername(''); setDisplayName(''); setEmail('');
    setPassword(''); setConfirmPass(''); setRole('admin_agences');
    setError(''); setShowPerms(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPass) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 8) { setError('Mot de passe trop court (min 8 caractères).'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ username, displayName, email, password, role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onCreated(json.admin);
        handleClose();
      } else {
        setError(json.error || 'Erreur lors de la création.');
      }
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 1rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
    color: 'white', fontFamily: 'inherit', fontSize: '0.875rem',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '1rem' }}>
      <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '2rem', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>
        {/* Header modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.1rem' }}>Créer un Administrateur</h3>
              <p style={{ margin: 0, opacity: 0.45, fontSize: '0.78rem' }}>Super Admin uniquement</p>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Rôle */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', opacity: 0.55, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rôle *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {(['admin_agences', 'admin_relais'] as const).map(r => {
                const cfg = ROLE_LABELS[r];
                const RIcon = r === 'admin_agences' ? Building2 : Package;
                const selected = role === r;
                return (
                  <button
                    key={r} type="button" onClick={() => setRole(r)}
                    style={{
                      padding: '0.85rem', borderRadius: '12px', cursor: 'pointer',
                      border: selected ? `2px solid ${cfg.color}` : '2px solid rgba(255,255,255,0.08)',
                      background: selected ? cfg.bg : 'rgba(255,255,255,0.03)',
                      textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <RIcon size={16} color={selected ? cfg.color : 'rgba(255,255,255,0.4)'} />
                      <span style={{ fontWeight: '700', fontSize: '0.82rem', color: selected ? cfg.color : 'rgba(255,255,255,0.7)' }}>{cfg.label}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.5, lineHeight: 1.4 }}>{cfg.description}</p>
                  </button>
                );
              })}
            </div>
            {/* Preview permissions */}
            <button
              type="button"
              onClick={() => setShowPerms(p => !p)}
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0' }}
            >
              <ChevronDown size={13} style={{ transform: showPerms ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              {showPerms ? 'Masquer' : 'Voir'} les permissions de ce rôle
            </button>
            {showPerms && <PermissionsCard role={role} />}
          </div>

          {/* Infos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', opacity: 0.55, marginBottom: '0.4rem' }}>Nom complet *</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jean Dupont" required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', opacity: 0.55, marginBottom: '0.4rem' }}>Identifiant *</label>
              <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))} placeholder="jean_dupont" required style={{ ...inputStyle, fontFamily: 'monospace' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', opacity: 0.55, marginBottom: '0.4rem' }}>Email (optionnel)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@moncolis.cd" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', opacity: 0.55, marginBottom: '0.4rem' }}>Mot de passe *</label>
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 caractères" required style={{ ...inputStyle, paddingRight: '2.5rem' }} />
              <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', marginTop: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0, display: 'flex', alignItems: 'center' }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', opacity: 0.55, marginBottom: '0.4rem' }}>Confirmer *</label>
              <input type={showPass ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Répéter le mot de passe" required style={{ ...inputStyle, borderColor: confirmPass && confirmPass !== password ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.12)' }} />
            </div>
          </div>

          {/* Force du mot de passe */}
          {password.length > 0 && (
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {[...Array(4)].map((_, i) => {
                const strength = password.length >= 16 ? 4 : password.length >= 12 ? 3 : password.length >= 8 ? 2 : 1;
                const colors = ['#f97316', '#f59e0b', '#f97316', '#22c55e'];
                return <div key={i} style={{ height: '3px', flex: 1, borderRadius: '2px', background: i < strength ? colors[strength - 1] : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />;
              })}
              <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                {password.length >= 16 ? 'Fort' : password.length >= 12 ? 'Bon' : password.length >= 8 ? 'Moyen' : 'Faible'}
              </span>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f97316', fontSize: '0.85rem' }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={handleClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '0.75rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: loading ? 0.7 : 1 }}>
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
              {loading ? 'Création...' : 'Créer l\'administrateur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Reset Password ─────────────────────────────────────────────────────
function ResetPasswordModal({
  admin, onClose, onDone,
}: {
  admin: AdminAccount | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newPass,  setNewPass]  = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  if (!admin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (newPass.length < 8)  { setError('Min. 8 caractères.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ id: admin.id, action: 'reset-password', newPassword: newPass }),
      });
      const json = await res.json();
      if (res.ok && json.success) { onDone(); onClose(); setNewPass(''); setConfirm(''); }
      else setError(json.error || 'Erreur.');
    } catch { setError('Erreur réseau.'); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 1rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
    color: 'white', fontFamily: 'inherit', fontSize: '0.875rem',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '18px', padding: '1.75rem', maxWidth: '400px', width: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
          <Key size={20} color="#f59e0b" />
          <div>
            <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1rem' }}>Réinitialiser le mot de passe</h3>
            <p style={{ margin: 0, opacity: 0.45, fontSize: '0.75rem' }}>{admin.displayName} (@{admin.username})</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Nouveau mot de passe" required style={{ ...inputStyle, paddingRight: '2.5rem' }} />
            <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}>
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <input type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirmer" required style={{ ...inputStyle, borderColor: confirm && confirm !== newPass ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.12)' }} />
          {error && <p style={{ color: '#f97316', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.65rem', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '0.65rem', borderRadius: '9px', border: 'none', background: '#f59e0b', color: 'black', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Key size={13} />}
              Réinitialiser
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Carte Admin ──────────────────────────────────────────────────────────────
function AdminCard({
  admin, onToggle, onResetPassword, onDelete, processing,
}: {
  admin: AdminAccount;
  onToggle:        (a: AdminAccount) => void;
  onResetPassword: (a: AdminAccount) => void;
  onDelete:        (a: AdminAccount) => void;
  processing:      boolean;
}) {
  const [showPerms, setShowPerms] = useState(false);
  const cfg = ROLE_LABELS[admin.role];
  const RoleIcon = admin.role === 'superadmin' ? Crown : admin.role === 'admin_agences' ? Building2 : Package;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${admin.isActive ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.2)'}`,
      borderRadius: '16px', padding: '1.25rem',
      opacity: processing ? 0.6 : 1, transition: 'all 0.2s',
    }}>
      {/* Header carte */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        {/* Avatar */}
        <div style={{
          width: '46px', height: '46px', borderRadius: '12px', flexShrink: 0,
          background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}10)`,
          border: `1px solid ${cfg.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RoleIcon size={22} color={cfg.color} />
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <p style={{ fontWeight: '800', fontSize: '1rem', margin: 0 }}>{admin.displayName}</p>
            <code style={{ fontSize: '0.75rem', opacity: 0.5, background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '5px' }}>@{admin.username}</code>
            {!admin.isActive && (
              <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Ban size={10} /> Suspendu
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            <RoleAdminBadge role={admin.role} />
            {admin.email && <span style={{ fontSize: '0.75rem', opacity: 0.45 }}>{admin.email}</span>}
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', opacity: 0.35 }}>
            Créé le {new Date(admin.createdAt).toLocaleDateString('fr-FR')} • par {admin.createdBy}
            {admin.lastLoginAt && ` • Dernière connexion ${new Date(admin.lastLoginAt).toLocaleDateString('fr-FR')}`}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          {/* Reset password */}
          <button
            onClick={() => onResetPassword(admin)}
            title="Réinitialiser le mot de passe"
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Key size={14} />
          </button>

          {/* Toggle status */}
          {admin.role !== 'superadmin' && (
            <button
              onClick={() => onToggle(admin)}
              disabled={processing}
              title={admin.isActive ? 'Suspendre' : 'Réactiver'}
              style={{
                width: '32px', height: '32px', borderRadius: '8px', cursor: processing ? 'not-allowed' : 'pointer',
                border: `1px solid ${admin.isActive ? 'rgba(249,115,22,0.3)' : 'rgba(34,197,94,0.3)'}`,
                background: admin.isActive ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                color: admin.isActive ? '#f97316' : '#22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {processing ? <RefreshCw size={13} className="animate-spin" /> : admin.isActive ? <Ban size={14} /> : <CheckCircle2 size={14} />}
            </button>
          )}

          {/* Supprimer */}
          {admin.role !== 'superadmin' && (
            <button
              onClick={() => onDelete(admin)}
              title="Supprimer cet admin"
              style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.05)', color: 'rgba(249,115,22,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Permissions toggle */}
      <button
        onClick={() => setShowPerms(p => !p)}
        style={{ marginTop: '0.85rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '0.73rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0' }}
      >
        <ChevronDown size={12} style={{ transform: showPerms ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        {showPerms ? 'Masquer' : 'Voir'} les permissions
      </button>
      {showPerms && <div style={{ marginTop: '0.5rem' }}><PermissionsCard role={admin.role} /></div>}
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function ToastBar({ message, type }: { message: string; type: 'success' | 'error' }) {
  const Icon = type === 'success' ? Check : X;
  const color = type === 'success' ? '#22c55e' : '#f97316';
  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 2000, background: type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)', border: `1px solid ${color}60`, color, padding: '0.85rem 1.5rem', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Icon size={16} strokeWidth={2.5} />{message}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AdminsPage() {
  const router = useRouter();
  const [admins,       setAdmins]       = useState<AdminAccount[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [processing,   setProcessing]   = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [resetTarget,  setResetTarget]  = useState<AdminAccount | null>(null);
  const [confirmDel,   setConfirmDel]   = useState<AdminAccount | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/admin-x9k2');
  }, [router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins', {
        headers: { },
      });
      if (res.ok) {
        const json = await res.json();
        setAdmins(json.admins || []);
      } else {
        showToast('Erreur chargement.', 'error');
      }
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  const handleToggle = async (admin: AdminAccount) => {
    setProcessing(admin.id);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ id: admin.id, action: 'toggle-status', isActive: !admin.isActive }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, isActive: !a.isActive } : a));
        showToast(json.message);
      } else showToast(json.error || 'Erreur.', 'error');
    } catch { showToast('Erreur réseau.', 'error'); }
    finally { setProcessing(null); }
  };

  const handleDelete = async (admin: AdminAccount) => {
    setConfirmDel(null);
    setProcessing(admin.id);
    try {
      const res = await fetch(`/api/admin/admins?id=${admin.id}`, {
        method: 'DELETE',
        headers: { },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAdmins(prev => prev.filter(a => a.id !== admin.id));
        showToast('Admin supprimé.');
      } else showToast(json.error || 'Erreur.', 'error');
    } catch { showToast('Erreur réseau.', 'error'); }
    finally { setProcessing(null); }
  };

  const subAdmins   = admins.filter(a => a.role !== 'superadmin');
  const superadmins = admins.filter(a => a.role === 'superadmin');

  return (
    <div style={{ minHeight: '100vh', background: '#020202', padding: '2rem', color: 'white', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {toast && <ToastBar message={toast.message} type={toast.type} />}

      {/* Create modal */}
      <CreateAdminModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={admin => { setAdmins(prev => [...prev, admin]); showToast(`Admin "${admin.displayName}" créé.`); }}
      />

      {/* Reset password modal */}
      <ResetPasswordModal
        admin={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={() => showToast('Mot de passe réinitialisé.')}
      />

      {/* Confirm delete */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '18px', padding: '1.75rem', maxWidth: '380px', width: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
              <Trash2 size={20} color="#f97316" />
              <h3 style={{ margin: 0, fontWeight: '800' }}>Supprimer cet admin</h3>
            </div>
            <p style={{ opacity: 0.65, fontSize: '0.88rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Êtes-vous sûr de vouloir supprimer définitivement <strong>"{confirmDel.displayName}"</strong> ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={() => handleDelete(confirmDel)} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: 'none', background: '#f97316', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)', padding: '0.55rem 1rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={15} /> Retour
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(245,158,11,0.25)' }}>
              <Crown size={24} color="white" strokeWidth={2} />
            </div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '1.5rem', margin: 0 }}>Gestion des Administrateurs</h1>
              <p style={{ opacity: 0.45, fontSize: '0.82rem', marginTop: '0.15rem' }}>Hiérarchie admin — Super Admin uniquement</p>
            </div>
          </div>
        </div>
        <button onClick={loadAdmins} disabled={loading} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)', padding: '0.55rem 1rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
        <button onClick={() => setShowCreate(true)} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
          <Plus size={16} /> Créer un admin
        </button>
      </div>

      {/* Schéma hiérarchique */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.72rem', opacity: 0.4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 1rem' }}>Hiérarchie des rôles</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {(['superadmin', 'admin_agences', 'admin_relais'] as AdminRole[]).map(role => {
            const cfg = ROLE_LABELS[role];
            const RoleIcon = role === 'superadmin' ? Crown : role === 'admin_agences' ? Building2 : Package;
            const count = admins.filter(a => a.role === role).length;
            return (
              <div key={role} style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RoleIcon size={18} color={cfg.color} />
                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <span style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}30`, padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800' }}>{count}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.73rem', opacity: 0.55, lineHeight: 1.5 }}>{cfg.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '4rem', opacity: 0.5 }}>
          <RefreshCw size={28} className="animate-spin" />
          <p>Chargement des administrateurs...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Super Admins */}
          {superadmins.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <Crown size={16} color="#f97316" />
                <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#f97316' }}>Super Administrateurs</h2>
                <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)', padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>{superadmins.length}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '0.3rem 0.75rem', borderRadius: '8px' }}>
                  <Lock size={12} color="rgba(255,255,255,0.35)" />
                  <span style={{ fontSize: '0.72rem', opacity: 0.4 }}>Non modifiable</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {superadmins.map(a => <AdminCard key={a.id} admin={a} onToggle={handleToggle} onResetPassword={setResetTarget} onDelete={setConfirmDel} processing={processing === a.id} />)}
              </div>
            </section>
          )}

          {/* Admins délégués */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <Users size={16} color="#8b5cf6" />
              <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#8b5cf6' }}>Admins délégués</h2>
              <span style={{ background: 'rgba(34,197,94,0.12)', color: '#8b5cf6', border: '1px solid rgba(249,115,22,0.25)', padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>{subAdmins.length}</span>
            </div>

            {subAdmins.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <Users size={40} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 1rem' }} />
                <p style={{ fontWeight: '700', fontSize: '1rem', margin: '0 0 0.4rem', opacity: 0.6 }}>Aucun admin délégué</p>
                <p style={{ opacity: 0.35, fontSize: '0.82rem', margin: '0 0 1.25rem' }}>Créez un admin pour déléguer la gestion des agences ou des points relais.</p>
                <button onClick={() => setShowCreate(true)} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', color: 'white', padding: '0.65rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={15} /> Créer le premier admin
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {subAdmins.map(a => <AdminCard key={a.id} admin={a} onToggle={handleToggle} onResetPassword={setResetTarget} onDelete={setConfirmDel} processing={processing === a.id} />)}
              </div>
            )}
          </section>

          {/* Aide */}
          <div style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '14px', padding: '1.1rem 1.4rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <Info size={18} color="#f97316" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', opacity: 0.7, lineHeight: 1.7 }}>
              <p style={{ margin: '0 0 0.3rem', fontWeight: '700', color: '#f97316', opacity: 1 }}>Comment fonctionne la délégation ?</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li><strong>Admin Agences</strong> — Accède uniquement à la section Agences, leurs livreurs, et les colis associés.</li>
                <li><strong>Admin Points Relais</strong> — Accède uniquement aux points relais, leurs agents, et les colis déposés.</li>
                <li>Les mots de passe des admins délégués peuvent être réinitialisés à tout moment par le Super Admin.</li>
                <li>Les admins délégués se connectent via la même page de connexion admin.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

