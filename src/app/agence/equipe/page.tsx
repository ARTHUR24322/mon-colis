'use client';

import { useState, useEffect } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import {
  Users, UserPlus, Shield, CheckCircle2, XCircle, Key,
  Mail, Phone, Lock, RefreshCw, AlertCircle, Edit2, ShieldAlert
} from 'lucide-react';
import {
  AGENCY_ROLE_LABELS,
  AGENCY_ROLE_PERMISSIONS,
  AgencyRole,
  hasAgencyPermission,
  normalizeAgencyRole
} from '@/lib/agencyPermissions';

interface AgencyMember {
  id: string;
  agency_id: string;
  email: string;
  phone: string | null;
  name: string;
  role: AgencyRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export default function AgencyTeamPage() {
  const { user } = useAuth('agence');
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const roleMeta = AGENCY_ROLE_LABELS[userRole];
  const canManage = hasAgencyPermission(userRole, 'canManageTeam');

  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMember, setEditMember] = useState<AgencyMember | null>(null);

  // Formulaire d'invitation / création
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<AgencyRole>('agent_comptoir');
  const [formPassword, setFormPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [newCredentialsModal, setNewCredentialsModal] = useState<{ email: string; pass: string } | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agency/team', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      const res = await fetch('/api/agency/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          phone: formPhone,
          role: formRole,
          password: formPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Erreur lors de la création');
        setFormSubmitting(false);
        return;
      }

      setModalOpen(false);
      if (data.initialPassword) {
        setNewCredentialsModal({ email: formEmail, pass: data.initialPassword });
      }
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormPassword('');
      fetchMembers();
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (member: AgencyMember) => {
    if (!canManage) return;
    try {
      const res = await fetch('/api/agency/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          is_active: !member.is_active,
        }),
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch {
      // Silencieux
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: AgencyRole) => {
    if (!canManage) return;
    try {
      const res = await fetch('/api/agency/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: memberId,
          role: newRole,
        }),
      });
      if (res.ok) {
        setEditMember(null);
        fetchMembers();
      }
    } catch {
      // Silencieux
    }
  };

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Titre & Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Équipe & Permissions
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
              Gestion nominative des collaborateurs de votre agence et contrôle d'accès strict (RBAC)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchMembers}
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
                onClick={() => setModalOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 16px', borderRadius: '8px',
                  backgroundColor: 'var(--ag-brand)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
                  boxShadow: '0 2px 6px var(--ag-brand-glow)'
                }}
              >
                <UserPlus size={16} />
                Inviter un collaborateur
              </button>
            )}
          </div>
        </div>

        {/* Message d'info si rôle lecture seule ou agent */}
        {!canManage && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            backgroundColor: 'var(--ag-surface-elevated)', border: '1px solid var(--ag-border)',
            borderRadius: '10px', padding: '12px 16px', fontSize: '0.82rem', color: 'var(--ag-text-secondary)'
          }}>
            <ShieldAlert size={18} color="var(--ag-brand)" />
            <span>
              Vous êtes connecté en tant que <strong>{roleMeta.label}</strong>. Seul le Directeur d'agence peut inviter ou modifier les collaborateurs.
            </span>
          </div>
        )}

        {/* Tableau des membres */}
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
                <th>Collaborateur</th>
                <th>Coordonnées</th>
                <th>Rôle Attribué</th>
                <th>Statut</th>
                <th>Dernière Connexion</th>
                {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const meta = AGENCY_ROLE_LABELS[member.role] || AGENCY_ROLE_LABELS.agent_comptoir;
                const isSelf = member.id === user?.id;

                return (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          backgroundColor: meta.badgeBg, color: meta.badgeColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '800', fontSize: '0.85rem'
                        }}>
                          {member.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--ag-text-primary)' }}>
                            {member.name} {isSelf && <span style={{ fontSize: '0.7rem', color: 'var(--ag-brand)' }}>(Vous)</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)' }}>
                            Membre depuis le {new Date(member.created_at).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                          <Mail size={12} style={{ color: 'var(--ag-text-muted)' }} />
                          {member.email}
                        </span>
                        {member.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>
                            <Phone size={11} />
                            {member.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="agency-badge" style={{ backgroundColor: meta.badgeBg, color: meta.badgeColor }}>
                        <Shield size={12} />
                        {meta.label}
                      </span>
                    </td>

                    <td>
                      <span className="agency-badge" style={{
                        backgroundColor: member.is_active ? 'var(--ag-success-bg)' : 'var(--ag-danger-bg)',
                        color: member.is_active ? 'var(--ag-success)' : 'var(--ag-danger)'
                      }}>
                        {member.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {member.is_active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>

                    <td style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>
                      {member.last_login_at
                        ? new Date(member.last_login_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                        : 'Jamais connecté'}
                    </td>

                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {!isSelf && (
                            <>
                              <button
                                onClick={() => setEditMember(member)}
                                title="Modifier le rôle"
                                style={{
                                  padding: '5px 8px', borderRadius: '6px',
                                  border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                                  color: 'var(--ag-text-secondary)', cursor: 'pointer', fontSize: '0.75rem'
                                }}
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                onClick={() => handleToggleActive(member)}
                                title={member.is_active ? 'Désactiver le compte' : 'Réactiver le compte'}
                                style={{
                                  padding: '5px 8px', borderRadius: '6px',
                                  border: '1px solid var(--ag-border)',
                                  backgroundColor: member.is_active ? 'var(--ag-danger-bg)' : 'var(--ag-success-bg)',
                                  color: member.is_active ? 'var(--ag-danger)' : 'var(--ag-success)',
                                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600'
                                }}
                              >
                                {member.is_active ? 'Désactiver' : 'Activer'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Matrice explicative des permissions */}
        <div style={{
          backgroundColor: 'var(--ag-surface)',
          border: '1px solid var(--ag-border)',
          borderRadius: '14px',
          padding: '20px',
          boxShadow: 'var(--ag-card-shadow)',
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '0 0 12px', color: 'var(--ag-text-primary)' }}>
            Matrice des Permissions par Rôle
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {(Object.keys(AGENCY_ROLE_LABELS) as AgencyRole[]).map(r => {
              const info = AGENCY_ROLE_LABELS[r];
              const perms = AGENCY_ROLE_PERMISSIONS[r];

              return (
                <div key={r} style={{
                  backgroundColor: 'var(--ag-surface-hover)',
                  border: '1px solid var(--ag-border)',
                  borderRadius: '10px',
                  padding: '14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="agency-badge" style={{ backgroundColor: info.badgeBg, color: info.badgeColor }}>
                      {info.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)', margin: '0 0 10px' }}>
                    {info.description}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.72rem', color: 'var(--ag-text-muted)', lineHeight: '1.6' }}>
                    {perms.canManageTeam && <li>Gérer l'équipe & rôles</li>}
                    {perms.canManageSettings && <li>Paramètres agence & tarifs</li>}
                    {perms.canEditPackages && <li>Accepter / refuser colis</li>}
                    {perms.canScanPackages && <li>Scanner & réceptions</li>}
                    {perms.canAssignDrivers && <li>Assigner les livreurs</li>}
                    {perms.canManageCashSessions && <li>Sessions de caisse & écarts</li>}
                    {perms.canExportReports && <li>Exports & rapports</li>}
                    {!perms.canEditPackages && !perms.canScanPackages && !perms.canManageCashSessions && <li>Consultation seule</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── MODAL INVITATION COLLABORATEUR ──────────────────────────────── */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            width: '100%', maxWidth: '480px', backgroundColor: 'var(--ag-surface)',
            border: '1px solid var(--ag-border)', borderRadius: '16px', padding: '24px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Ajouter un collaborateur
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 18px' }}>
              Créez un compte nominatif avec accès spécifique pour votre collaborateur.
            </p>

            {formError && (
              <div style={{
                backgroundColor: 'var(--ag-danger-bg)', color: 'var(--ag-danger)',
                border: '1px solid var(--ag-danger)', borderRadius: '8px', padding: '8px 12px',
                fontSize: '0.8rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Nom complet *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Jean Mutombo"
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
                  Adresse e-mail de connexion *
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborateur@agence.com"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  placeholder="+243..."
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
                  Rôle attribué *
                </label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as AgencyRole)}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', boxSizing: 'border-box', fontWeight: '600'
                  }}
                >
                  <option value="agent_comptoir">Agent de Comptoir (Réception & Scans)</option>
                  <option value="gestionnaire">Gestionnaire d'Exploitation (Colis & Livreurs)</option>
                  <option value="comptable">Comptable / Caisse (Finances & Versements)</option>
                  <option value="lecture_seule">Consultant (Lecture seule)</option>
                  <option value="directeur">Directeur Adjoint (Accès complet)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Mot de passe provisoire (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Laisser vide pour générer automatiquement"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'transparent',
                    color: 'var(--ag-text-secondary)', cursor: 'pointer', fontWeight: '600'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    backgroundColor: 'var(--ag-brand)', color: '#fff',
                    border: 'none', cursor: formSubmitting ? 'not-allowed' : 'pointer', fontWeight: '700'
                  }}
                >
                  {formSubmitting ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal affichage identifiants générés */}
      {newCredentialsModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            width: '100%', maxWidth: '420px', backgroundColor: 'var(--ag-surface)',
            border: '1px solid var(--ag-border)', borderRadius: '16px', padding: '24px',
            textAlign: 'center', boxShadow: 'var(--ag-card-shadow-hover)'
          }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              backgroundColor: 'var(--ag-success-bg)', color: 'var(--ag-success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
            }}>
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
              Collaborateur créé avec succès
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Transmettez ces identifiants de connexion à l'agent :
            </p>

            <div style={{
              backgroundColor: 'var(--ag-surface-hover)', border: '1px solid var(--ag-border)',
              borderRadius: '8px', padding: '12px', textAlign: 'left', marginBottom: '16px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>E-mail :</div>
              <div style={{ fontWeight: '700', marginBottom: '8px' }}>{newCredentialsModal.email}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>Mot de passe initial :</div>
              <div style={{ fontFamily: 'monospace', fontWeight: '800', color: 'var(--ag-brand)', fontSize: '1rem' }}>
                {newCredentialsModal.pass}
              </div>
            </div>

            <button
              onClick={() => setNewCredentialsModal(null)}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                backgroundColor: 'var(--ag-brand)', color: '#fff', border: 'none',
                fontWeight: '700', cursor: 'pointer'
              }}
            >
              Compris, j'ai noté les accès
            </button>
          </div>
        </div>
      )}

      {/* Modal Changement de rôle */}
      {editMember && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            width: '100%', maxWidth: '420px', backgroundColor: 'var(--ag-surface)',
            border: '1px solid var(--ag-border)', borderRadius: '16px', padding: '24px',
            boxShadow: 'var(--ag-card-shadow-hover)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
              Modifier le rôle de {editMember.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Sélectionnez les nouvelles responsabilités :
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {(Object.keys(AGENCY_ROLE_LABELS) as AgencyRole[]).map(r => {
                const meta = AGENCY_ROLE_LABELS[r];
                return (
                  <button
                    key={r}
                    onClick={() => handleUpdateRole(editMember.id, r)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '8px',
                      border: editMember.role === r ? '2px solid var(--ag-brand)' : '1px solid var(--ag-border)',
                      backgroundColor: editMember.role === r ? 'var(--ag-brand-subtle)' : 'var(--ag-surface-hover)',
                      cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--ag-text-primary)' }}>{meta.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)' }}>{meta.description}</div>
                    </div>
                    {editMember.role === r && <CheckCircle2 size={16} color="var(--ag-brand)" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setEditMember(null)}
              style={{
                width: '100%', padding: '8px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'transparent',
                color: 'var(--ag-text-secondary)', cursor: 'pointer', fontWeight: '600'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </AgencyShell>
  );
}
