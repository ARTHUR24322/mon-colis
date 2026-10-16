'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/utils/adminAuth';
import {
  ShoppingBag, Building2, Truck, Package, Shield, Users, User,
  Check, X, Ban, Clock, Search, RefreshCw, Info, ArrowLeft,
  CheckCircle2, UserCheck, UserX, ChevronDown, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type UserRole   = 'vendeur' | 'agence' | 'livreur' | 'point_relais' | 'superadmin';
type UserStatus = 'active' | 'suspended' | 'pending' | 'rejected';
type UserType   = 'profile' | 'drop_point_agent';

interface UserEntry {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  agencyStatus?: string;
  agencyId?: string;          // livreurs → agence parente
  dropPointName?: string;
  dropPointCommune?: string;
  agentNumber?: string;
  joinedDate: string;
  type: UserType;
}

// Agence enrichie avec ses livreurs
interface AgenceGroup {
  agence: UserEntry;
  livreurs: UserEntry[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  vendeur:      { label: 'Vendeur',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  Icon: ShoppingBag },
  agence:       { label: 'Agence',       color: '#f97316', bg: 'rgba(249,115,22,0.12)', Icon: Building2   },
  livreur:      { label: 'Livreur',      color: '#4ade80', bg: 'rgba(74,222,128,0.10)', Icon: Truck        },
  point_relais: { label: 'Point Relais', color: '#fb923c', bg: 'rgba(251,146,60,0.12)', Icon: Package      },
  superadmin:   { label: 'Super Admin',  color: '#f97316', bg: 'rgba(249,115,22,0.12)', Icon: Shield       },
};

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  active:    { label: 'Actif',      color: '#22c55e',              bg: 'rgba(34,197,94,0.12)',        Icon: CheckCircle2 },
  suspended: { label: 'Suspendu',   color: '#f97316',              bg: 'rgba(249,115,22,0.12)',       Icon: Ban          },
  pending:   { label: 'En attente', color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.06)',      Icon: Clock        },
  rejected:  { label: 'Refusé',     color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)',      Icon: X            },
};

// ─── Sous-composants ──────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: UserRole }) {
  const { label, color, bg, Icon } = ROLE_CONFIG[role];
  return (
    <span style={{
      background: bg, color, border: `1px solid ${color}40`,
      padding: '0.18rem 0.6rem', borderRadius: '20px',
      fontSize: '0.73rem', fontWeight: '700', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    }}>
      <Icon size={11} strokeWidth={2} />{label}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const { label, color, bg, Icon } = STATUS_CONFIG[status];
  return (
    <span style={{
      background: bg, color, border: `1px solid ${color}40`,
      padding: '0.18rem 0.6rem', borderRadius: '20px',
      fontSize: '0.73rem', fontWeight: '700',
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    }}>
      <Icon size={11} strokeWidth={2} />{label}
    </span>
  );
}

function ConfirmModal({
  open, title, message, confirmLabel, confirmColor, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string;
  confirmLabel: string; confirmColor: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'rgba(12,12,12,0.99)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '2rem', maxWidth: '420px', width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontWeight: '800' }}>{title}</h3>
        <p style={{ opacity: 0.65, fontSize: '0.88rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}>Annuler</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: 'none', background: confirmColor, color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: '700', boxShadow: `0 4px 16px ${confirmColor}50` }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ToastBar({ message, type }: { message: string; type: 'success' | 'error' }) {
  const Icon = type === 'success' ? Check : X;
  const color = type === 'success' ? '#22c55e' : '#f97316';
  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 2000, background: type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)', border: `1px solid ${color}60`, color, padding: '0.85rem 1.5rem', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Icon size={16} strokeWidth={2.5} />{message}
    </div>
  );
}

function StatCard({ label, value, color, Icon }: { label: string; value: number; color: string; Icon: LucideIcon }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1rem', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.35rem' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={color} strokeWidth={2} />
        </div>
      </div>
      <p style={{ fontSize: '1.6rem', fontWeight: '900', color, lineHeight: 1, margin: '0 0 0.2rem' }}>{value}</p>
      <p style={{ fontSize: '0.68rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{label}</p>
    </div>
  );
}

// ─── Bouton d'action suspend/reactive ────────────────────────────────────────
function ActionBtn({
  user, processing, onToggle,
}: {
  user: UserEntry;
  processing: boolean;
  onToggle: (u: UserEntry) => void;
}) {
  if (user.role === 'superadmin') {
    return <span style={{ fontSize: '0.72rem', opacity: 0.3, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Shield size={12} /> Protégé</span>;
  }
  if (user.status === 'pending') {
    return <span style={{ fontSize: '0.72rem', opacity: 0.45, display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}><Clock size={12} /> Adhésion</span>;
  }
  if (user.status === 'rejected') {
    return <span style={{ fontSize: '0.72rem', opacity: 0.35, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><X size={12} /> Refusé</span>;
  }

  const isActive = user.status === 'active';
  return (
    <button
      onClick={() => onToggle(user)}
      disabled={processing}
      style={{
        padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid',
        borderColor: isActive ? 'rgba(249,115,22,0.35)' : 'rgba(34,197,94,0.35)',
        background:  isActive ? 'rgba(249,115,22,0.08)'  : 'rgba(34,197,94,0.08)',
        color:       isActive ? '#f97316'               : '#22c55e',
        cursor: processing ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: '700',
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        transition: 'all 0.2s', whiteSpace: 'nowrap',
        opacity: processing ? 0.5 : 1,
      }}
    >
      {processing
        ? <RefreshCw size={12} className="animate-spin" />
        : isActive
          ? <><Ban size={12} /> Suspendre</>
          : <><CheckCircle2 size={12} /> Réactiver</>}
    </button>
  );
}

// ─── Ligne utilisateur générique ──────────────────────────────────────────────
function UserRow({
  user, processing, onToggle, indent = false,
}: {
  user: UserEntry;
  processing: boolean;
  onToggle: (u: UserEntry) => void;
  indent?: boolean;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 130px',
      padding: indent ? '0.75rem 1.25rem 0.75rem 2.5rem' : '1rem 1.25rem',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      alignItems: 'center', gap: '1rem',
      background: indent ? 'rgba(6,182,212,0.03)' : 'transparent',
      transition: 'background 0.2s',
    }}>
      {/* Utilisateur */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {indent && (
            <div style={{ width: '2px', height: '20px', background: 'rgba(6,182,212,0.3)', borderRadius: '2px', flexShrink: 0 }} />
          )}
          <div>
            <p style={{ fontWeight: '700', margin: 0, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </p>
            {user.agentNumber && (
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', fontFamily: 'monospace', color: '#f59e0b', opacity: 0.85 }}>Agent #{user.agentNumber}</p>
            )}
            {user.dropPointName && (
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Package size={11} /> {user.dropPointName} — {user.dropPointCommune}
              </p>
            )}
          </div>
        </div>
      </div>
      {/* Contact */}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email !== '—' ? user.email : user.phone !== '—' ? user.phone : '—'}
        </p>
        {user.email !== '—' && user.phone !== '—' && (
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', opacity: 0.45 }}>{user.phone}</p>
        )}
      </div>
      {/* Rôle */}
      <div><RoleBadge role={user.role} /></div>
      {/* Statut */}
      <div><StatusBadge status={user.status} /></div>
      {/* Date */}
      <div style={{ fontSize: '0.78rem', opacity: 0.5 }}>{user.joinedDate}</div>
      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ActionBtn user={user} processing={processing} onToggle={onToggle} />
      </div>
    </div>
  );
}

// ─── Bloc Agence + livreurs dépliables ────────────────────────────────────────
function AgenceBlock({
  group, processing, onToggle,
}: {
  group: AgenceGroup;
  processing: string | null;
  onToggle: (u: UserEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { agence, livreurs } = group;
  const activeLivreurs    = livreurs.filter(l => l.status === 'active').length;
  const suspendedLivreurs = livreurs.filter(l => l.status === 'suspended').length;

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Ligne agence */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 130px',
        padding: '1rem 1.25rem',
        alignItems: 'center', gap: '1rem',
        background: expanded ? 'rgba(249,115,22,0.04)' : 'transparent',
        transition: 'background 0.2s',
      }}>
        {/* Nom agence + bouton voir livreurs */}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: '800', margin: 0, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agence.name}
          </p>
          {/* Bouton "Voir les livreurs" */}
          {livreurs.length > 0 ? (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                marginTop: '0.35rem',
                background: expanded ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.08)',
                border: `1px solid rgba(6,182,212,${expanded ? '0.4' : '0.2'})`,
                color: '#06b6d4', borderRadius: '8px',
                padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: '700',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                transition: 'all 0.2s',
              }}
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Truck size={12} />
              {livreurs.length} livreur{livreurs.length > 1 ? 's' : ''}
              {activeLivreurs > 0 && (
                <span style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', borderRadius: '20px', padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                  {activeLivreurs} actif{activeLivreurs > 1 ? 's' : ''}
                </span>
              )}
              {suspendedLivreurs > 0 && (
                <span style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316', borderRadius: '20px', padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                  {suspendedLivreurs} susp.
                </span>
              )}
            </button>
          ) : (
            <span style={{ marginTop: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', opacity: 0.35 }}>
              <Truck size={11} /> Aucun livreur
            </span>
          )}
        </div>
        {/* Contact */}
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agence.email !== '—' ? agence.email : agence.phone !== '—' ? agence.phone : '—'}
          </p>
          {agence.email !== '—' && agence.phone !== '—' && (
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', opacity: 0.45 }}>{agence.phone}</p>
          )}
        </div>
        <div><RoleBadge role={agence.role} /></div>
        <div><StatusBadge status={agence.status} /></div>
        <div style={{ fontSize: '0.78rem', opacity: 0.5 }}>{agence.joinedDate}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ActionBtn user={agence} processing={processing === agence.id} onToggle={onToggle} />
        </div>
      </div>

      {/* Livreurs dépliables */}
      {expanded && livreurs.length > 0 && (
        <div style={{
          background: 'rgba(6,182,212,0.02)',
          borderTop: '1px solid rgba(6,182,212,0.1)',
          borderLeft: '3px solid rgba(6,182,212,0.25)',
        }}>
          {/* Header livreurs */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 130px',
            padding: '0.5rem 1.25rem 0.5rem 2.5rem',
            gap: '1rem',
            background: 'rgba(6,182,212,0.05)',
            borderBottom: '1px solid rgba(6,182,212,0.1)',
          }}>
            {['Livreur', 'Téléphone', 'Rôle', 'Statut', 'Inscrit', 'Actions'].map(col => (
              <span key={col} style={{ fontSize: '0.67rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#06b6d4', opacity: 0.7 }}>
                {col}
              </span>
            ))}
          </div>
          {livreurs.map(livreur => (
            <UserRow
              key={livreur.id}
              user={livreur}
              processing={processing === livreur.id}
              onToggle={onToggle}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function RolesPage() {
  const router = useRouter();
  const [users, setUsers]           = useState<UserEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast]           = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string;
    confirmLabel: string; confirmColor: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', confirmColor: '#f97316', onConfirm: () => {} });

  // Filtres
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | UserStatus>('all');
  // Onglets de vue
  const [activeView, setActiveView] = useState<'grouped' | 'all'>('grouped');

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/admin-x9k2');
  }, [router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles/users', {
        headers: { },
      });
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
      } else {
        showToast('Erreur chargement.', 'error');
      }
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Toggle status ──────────────────────────────────────────────────────────
  const handleToggleStatus = useCallback((user: UserEntry) => {
    const newActive = user.status === 'suspended';
    setConfirmModal({
      open: true,
      title: `${newActive ? 'Réactiver' : 'Suspendre'} ce compte`,
      message: `Vous êtes sur le point de ${newActive ? 'réactiver' : 'suspendre'} le compte "${user.name}" (${ROLE_CONFIG[user.role].label}).${!newActive ? '\n\nL\'utilisateur ne pourra plus se connecter.' : ''}`,
      confirmLabel: newActive ? 'Réactiver' : 'Suspendre',
      confirmColor: newActive ? '#22c55e' : '#f97316',
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setProcessing(user.id);
        try {
          const res = await fetch('/api/admin/roles/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ action: 'toggle-status', userId: user.id, userType: user.type, isActive: newActive }),
          });
          const json = await res.json();
          if (res.ok && json.success) {
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newActive ? 'active' : 'suspended' } : u));
            showToast(json.message || `Compte ${newActive ? 'réactivé' : 'suspendu'}.`);
          } else {
            showToast(json.error || 'Erreur.', 'error');
          }
        } catch {
          showToast('Erreur réseau.', 'error');
        } finally {
          setProcessing(null);
        }
      },
    });
  }, []);

  // ── Données dérivées ───────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     users.length,
    active:    users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    pending:   users.filter(u => u.status === 'pending').length,
    vendeurs:  users.filter(u => u.role === 'vendeur').length,
    agences:   users.filter(u => u.role === 'agence').length,
    livreurs:  users.filter(u => u.role === 'livreur').length,
    relais:    users.filter(u => u.role === 'point_relais').length,
  }), [users]);

  // Groupes agence → livreurs (vue regroupée)
  const agenceGroups = useMemo((): AgenceGroup[] => {
    const agences  = users.filter(u => u.role === 'agence');
    const livreurs = users.filter(u => u.role === 'livreur');

    return agences.map(agence => ({
      agence,
      livreurs: livreurs.filter(l => l.agencyId === agence.id),
    }));
  }, [users]);

  // Livreurs sans agence connue
  const livreursOrphelins = useMemo(() => {
    const agenceIds = new Set(users.filter(u => u.role === 'agence').map(u => u.id));
    return users.filter(u => u.role === 'livreur' && (!u.agencyId || !agenceIds.has(u.agencyId)));
  }, [users]);

  // Vue plate (tous les utilisateurs) — filtrable
  const allUsersFiltered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter(u => {
      const matchSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.agentNumber || '').includes(q) ||
        (u.dropPointName || '').toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || u.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [users, searchQuery, filterStatus]);

  // Filtres appliqués à la vue regroupée
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return agenceGroups.filter(g => {
      const agenceMatch = !q || g.agence.name.toLowerCase().includes(q) || g.agence.email.toLowerCase().includes(q);
      const livreurMatch = g.livreurs.some(l => !q || l.name.toLowerCase().includes(q) || l.phone.includes(q));
      const statusMatch = filterStatus === 'all' || g.agence.status === filterStatus;
      return (agenceMatch || livreurMatch) && statusMatch;
    });
  }, [agenceGroups, searchQuery, filterStatus]);

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '0.6rem 1rem', color: 'white',
    fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none',
  };

  const tableHeader = (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 130px', padding: '0.65rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', gap: '1rem' }}>
      {['Utilisateur', 'Contact', 'Rôle', 'Statut', 'Inscrit', 'Actions'].map(col => (
        <span key={col} style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.4 }}>{col}</span>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#020202', padding: '2rem', color: 'white', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {toast && <ToastBar message={toast.message} type={toast.type} />}
      <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(m => ({ ...m, open: false }))} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)', padding: '0.55rem 1rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={15} /> Retour
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
              <Users size={24} color="white" strokeWidth={2} />
            </div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '1.5rem', margin: 0 }}>Gestion des Rôles & Comptes</h1>
              <p style={{ opacity: 0.45, fontSize: '0.82rem', marginTop: '0.15rem' }}>Agences avec leurs livreurs · Vendeurs · Points Relais</p>
            </div>
          </div>
        </div>
        <button onClick={loadUsers} disabled={loading} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)', padding: '0.55rem 1.1rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem', opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        <StatCard label="Total comptes" value={stats.total}     color="rgba(255,255,255,0.8)" Icon={Users}       />
        <StatCard label="Actifs"        value={stats.active}    color="#22c55e"               Icon={UserCheck}   />
        <StatCard label="Suspendus"     value={stats.suspended} color="#f97316"               Icon={UserX}       />
        <StatCard label="En attente"    value={stats.pending}   color="rgba(255,255,255,0.5)" Icon={Clock}       />
        <StatCard label="Vendeurs"      value={stats.vendeurs}  color="#22c55e"               Icon={ShoppingBag} />
        <StatCard label="Agences"       value={stats.agences}   color="#f97316"               Icon={Building2}   />
        <StatCard label="Livreurs"      value={stats.livreurs}  color="#4ade80"               Icon={Truck}       />
        <StatCard label="Pts Relais"    value={stats.relais}    color="#fb923c"               Icon={Package}     />
      </div>

      {/* Onglets de vue + filtres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {/* Vue selector */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.25rem', gap: '0.25rem' }}>
          {([
            { key: 'grouped', Icon: Building2, label: 'Vue Agences + Livreurs' },
            { key: 'all',     Icon: Users,     label: 'Tous les comptes' },
          ] as const).map(({ key, Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              style={{
                padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: activeView === key ? '700' : '400',
                background: activeView === key ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: activeView === key ? '#f97316' : 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={14} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text" placeholder="Rechercher par nom, email..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: '2.5rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* Filtre statut */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="pending">En attente</option>
          <option value="rejected">Refusés</option>
        </select>
      </div>

      {/* Contenu */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '4rem', opacity: 0.5 }}>
          <RefreshCw size={28} className="animate-spin" />
          <p>Chargement des comptes...</p>
        </div>
      ) : (
        <>
          {/* ── VUE REGROUPÉE : Agences + Livreurs ─────────────────────────── */}
          {activeView === 'grouped' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Section Agences + leurs livreurs */}
              {filteredGroups.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <Building2 size={16} color="#f97316" />
                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#f97316' }}>
                      Agences & leurs livreurs
                    </h2>
                    <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)', padding: '0.15rem 0.55rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>
                      {filteredGroups.length}
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                    {tableHeader}
                    {filteredGroups.map(group => (
                      <AgenceBlock
                        key={group.agence.id}
                        group={group}
                        processing={processing}
                        onToggle={handleToggleStatus}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Livreurs sans agence */}
              {livreursOrphelins.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <Truck size={16} color="#f59e0b" />
                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#f59e0b' }}>
                      Livreurs sans agence assignée
                    </h2>
                    <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '0.15rem 0.55rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>
                      {livreursOrphelins.length}
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '16px', overflow: 'hidden' }}>
                    {tableHeader}
                    {livreursOrphelins.map(u => (
                      <UserRow key={u.id} user={u} processing={processing === u.id} onToggle={handleToggleStatus} />
                    ))}
                  </div>
                </section>
              )}

              {/* Section Vendeurs */}
              {(() => {
                const vendeurs = users.filter(u => u.role === 'vendeur');
                const filtered = vendeurs.filter(u => {
                  const q = searchQuery.toLowerCase();
                  const match = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                  const statusMatch = filterStatus === 'all' || u.status === filterStatus;
                  return match && statusMatch;
                });
                if (filtered.length === 0) return null;
                return (
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      <ShoppingBag size={16} color="#22c55e" />
                      <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#22c55e' }}>Vendeurs</h2>
                      <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', padding: '0.15rem 0.55rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>{filtered.length}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                      {tableHeader}
                      {filtered.map(u => <UserRow key={u.id} user={u} processing={processing === u.id} onToggle={handleToggleStatus} />)}
                    </div>
                  </section>
                );
              })()}

              {/* Section Points Relais */}
              {(() => {
                const relais = users.filter(u => u.role === 'point_relais');
                const filtered = relais.filter(u => {
                  const q = searchQuery.toLowerCase();
                  const match = !q || u.name.toLowerCase().includes(q) || (u.agentNumber || '').includes(q) || (u.dropPointName || '').toLowerCase().includes(q);
                  const statusMatch = filterStatus === 'all' || u.status === filterStatus;
                  return match && statusMatch;
                });
                if (filtered.length === 0) return null;
                return (
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      <Package size={16} color="#fb923c" />
                      <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#fb923c' }}>Agents Points Relais</h2>
                      <span style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)', padding: '0.15rem 0.55rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>{filtered.length}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                      {tableHeader}
                      {filtered.map(u => <UserRow key={u.id} user={u} processing={processing === u.id} onToggle={handleToggleStatus} />)}
                    </div>
                  </section>
                );
              })()}
            </div>
          )}

          {/* ── VUE PLATE : tous les comptes ─────────────────────────────────── */}
          {activeView === 'all' && (
            <>
              <p style={{ fontSize: '0.8rem', opacity: 0.45, marginBottom: '0.75rem' }}>
                {allUsersFiltered.length} compte{allUsersFiltered.length !== 1 ? 's' : ''} trouvé{allUsersFiltered.length !== 1 ? 's' : ''}
                {searchQuery || filterStatus !== 'all' ? ' (filtré)' : ''}
              </p>
              {allUsersFiltered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                  <User size={48} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: '700', fontSize: '1.1rem', margin: '0 0 0.35rem' }}>Aucun compte trouvé</p>
                  <p style={{ opacity: 0.5, fontSize: '0.85rem', margin: 0 }}>Modifiez vos filtres ou actualisez la page.</p>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                  {tableHeader}
                  {allUsersFiltered.map(u => (
                    <UserRow key={u.id} user={u} processing={processing === u.id} onToggle={handleToggleStatus} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Légende */}
      <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.9rem 1.25rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', opacity: 0.4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rôles :</span>
        {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][])
          .filter(([k]) => k !== 'superadmin')
          .map(([key, cfg]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', opacity: 0.65 }}>
              <cfg.Icon size={13} color={cfg.color} />
              <span style={{ color: cfg.color }}>{cfg.label}</span>
            </span>
          ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', opacity: 0.35 }}>
          <Info size={12} />
          Les adhésions en attente se valident depuis "Adhésions Agences" dans le dashboard.
        </div>
      </div>
    </div>
  );
}

