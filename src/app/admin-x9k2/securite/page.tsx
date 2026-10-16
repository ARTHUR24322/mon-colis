'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/utils/adminAuth';
import {
  Shield, Lock, LockOpen, AlertTriangle, AlertCircle,
  Ban, Globe, User, RefreshCw, CheckCircle2, X, Check,
  Database, Key, FileText, Settings, Info, Lightbulb,
  ArrowLeft, ShieldAlert, ShieldCheck, Clock, Mail, Save
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SecurityAlert {
  id: string;
  type: 'failed_login' | 'suspicious_ip' | 'account_locked' | 'role_change' | 'suspension';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  detail: string;
  ip?: string;
  userId?: string;
  userName?: string;
  timestamp: string;
  resolved: boolean;
}

interface LoginAttempt {
  id: string;
  email?: string;
  role: string;
  ip: string;
  status: 'success' | 'failed' | 'blocked';
  timestamp: string;
  detail: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function severityColor(severity: SecurityAlert['severity']): string {
  return { low: '#22c55e', medium: '#fb923c', high: '#f97316', critical: '#f97316' }[severity];
}

function severityBg(severity: SecurityAlert['severity']): string {
  return {
    low:      'rgba(34,197,94,0.1)',
    medium:   'rgba(251,146,60,0.1)',
    high:     'rgba(249,115,22,0.1)',
    critical: 'rgba(249,115,22,0.18)',
  }[severity];
}

function severityLabel(severity: SecurityAlert['severity']): string {
  return { low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique' }[severity];
}

function TypeIcon({ type, color }: { type: SecurityAlert['type']; color: string }) {
  const props = { size: 18, color, strokeWidth: 2 };
  return {
    failed_login:   <Lock {...props} />,
    suspicious_ip:  <Globe {...props} />,
    account_locked: <Ban {...props} />,
    role_change:    <User {...props} />,
    suspension:     <ShieldAlert {...props} />,
  }[type];
}

function statusColor(status: LoginAttempt['status']): string {
  return { success: '#22c55e', failed: '#f97316', blocked: '#fb923c' }[status];
}

// ─── L'historique est désormais chargé depuis l'API ─────────────────────────────

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, color, active, icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  active?: boolean;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? color + '40' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '16px',
      padding: '1.25rem',
      textAlign: 'center',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: active ? `${color}18` : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={active ? color : 'rgba(255,255,255,0.3)'} strokeWidth={2} />
        </div>
      </div>
      <p style={{ fontSize: '1.8rem', fontWeight: '900', color: active ? color : 'rgba(255,255,255,0.4)', lineHeight: 1, margin: '0 0 0.25rem' }}>{value}</p>
      <p style={{ fontSize: '0.72rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{label}</p>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, onResolve }: { alert: SecurityAlert; onResolve: (id: string) => void }) {
  const color = severityColor(alert.severity);
  return (
    <div style={{
      background: alert.resolved ? 'rgba(255,255,255,0.02)' : severityBg(alert.severity),
      border: `1px solid ${alert.resolved ? 'rgba(255,255,255,0.06)' : color + '40'}`,
      borderRadius: '14px',
      padding: '1.1rem 1.3rem',
      display: 'flex',
      gap: '1rem',
      alignItems: 'flex-start',
      opacity: alert.resolved ? 0.5 : 1,
      transition: 'all 0.3s',
    }}>
      {/* Icon */}
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
        background: alert.resolved ? 'rgba(255,255,255,0.05)' : severityBg(alert.severity),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${alert.resolved ? 'rgba(255,255,255,0.06)' : color + '30'}`,
      }}>
        <TypeIcon type={alert.type} color={alert.resolved ? 'rgba(255,255,255,0.3)' : color} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <span style={{
            background: severityBg(alert.severity),
            color: color,
            border: `1px solid ${color}50`,
            padding: '0.15rem 0.55rem',
            borderRadius: '20px',
            fontSize: '0.7rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {severityLabel(alert.severity)}
          </span>
          {alert.ip && (
            <span style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
              padding: '0.15rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
            }}>
              {alert.ip}
            </span>
          )}
          {alert.resolved && (
            <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <Check size={12} /> Résolu
            </span>
          )}
        </div>
        <p style={{ fontWeight: '700', fontSize: '0.9rem', margin: '0 0 0.2rem' }}>{alert.message}</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>{alert.detail}</p>
        <p style={{ fontSize: '0.72rem', opacity: 0.4, marginTop: '0.4rem' }}>{timeAgo(alert.timestamp)}</p>
      </div>

      {/* Action */}
      {!alert.resolved && (
        <button
          onClick={() => onResolve(alert.id)}
          style={{
            flexShrink: 0,
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#22c55e',
            padding: '0.4rem 0.9rem',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: '700',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Check size={13} /> Résoudre
        </button>
      )}
    </div>
  );
}

// ─── Config Item ──────────────────────────────────────────────────────────────
function ConfigItem({ label, value, type }: { label: string; value: string; type: 'ok' | 'info' | 'warn' }) {
  const color = { ok: '#22c55e', info: '#60a5fa', warn: '#fb923c' }[type];
  const Icon = { ok: Check, info: Info, warn: AlertTriangle }[type];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <span style={{ fontSize: '0.82rem', opacity: 0.65 }}>{label}</span>
      <span style={{ color, fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <Icon size={13} strokeWidth={2.5} />
        {value}
      </span>
    </div>
  );
}

// ─── Section Tab ──────────────────────────────────────────────────────────────
function SectionTab({
  active, onClick, icon: Icon, label, color = '#f97316',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.7rem 1.2rem',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.875rem',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
        background: 'transparent',
        color: active ? color : 'rgba(255,255,255,0.5)',
        fontWeight: active ? '700' : '400',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </button>
  );
}

// ─── Page Principale ──────────────────────────────────────────────────────────
export default function SecuritePage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [activeSection, setActiveSection] = useState<'alerts' | 'history' | 'config'>('alerts');
  const [refreshing, setRefreshing] = useState(false);

  // Resend Config State
  const [resendKey, setResendKey] = useState('');
  const [resendStatus, setResendStatus] = useState<'loading' | 'configured' | 'not_configured'>('loading');
  const [savingResend, setSavingResend] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) router.replace('/admin-x9k2');
  }, [router]);

  const loadAlerts = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/security/alerts', {
        headers: { },
      });
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.alerts || []);
      }
    } catch (e) {
      console.error('Erreur chargement alertes:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadResendConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/resend', {
        headers: { },
      });
      if (res.ok) {
        const json = await res.json();
        setResendStatus(json.isConfigured ? 'configured' : 'not_configured');
        if (json.isConfigured) {
          setResendKey('********');
        }
      }
    } catch (e) {
      console.error('Erreur chargement config Resend:', e);
    }
  }, []);

  const loadLoginHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/security/logs', {
        headers: { },
      });
      if (res.ok) {
        const json = await res.json();
        const logs = json.logs.map((log: any) => ({
          id: log.id || Math.random().toString(),
          email: log.email,
          role: log.role,
          ip: log.ip,
          status: log.status,
          detail: log.detail,
          timestamp: log.created_at,
        }));
        setLoginHistory(logs);
      }
    } catch (e) {
      console.error('Erreur chargement historiques:', e);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    loadResendConfig();
    loadLoginHistory();
  }, [loadAlerts, loadResendConfig, loadLoginHistory]);

  const handleSaveResend = async () => {
    if (!resendKey || resendKey === '********') return;
    setSavingResend(true);
    try {
      const res = await fetch('/api/admin/config/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ resendApiKey: resendKey }),
      });
      if (res.ok) {
        setResendStatus('configured');
        setResendKey('********');
        alert('Configuration Resend mise à jour avec succès !');
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSavingResend(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
    try {
      await fetch('/api/admin/security/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ alertId, action: 'resolve' }),
      });
    } catch {/* silencieux */}
  };

  const handleResolveAll = () => {
    setAlerts(prev => prev.map(a => ({ ...a, resolved: true })));
  };

  // Stats
  const unresolvedCount  = alerts.filter(a => !a.resolved).length;
  const criticalCount    = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const highCount        = alerts.filter(a => a.severity === 'high' && !a.resolved).length;
  const failedLogins     = loginHistory.filter(l => l.status === 'failed').length;
  const blockedAttempts  = loginHistory.filter(l => l.status === 'blocked').length;

  const filteredAlerts = alerts.filter(a => {
    if (!showResolved && a.resolved) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#020202', padding: '2rem', color: 'white', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)', padding: '0.55rem 1rem', borderRadius: '10px',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          <ArrowLeft size={15} /> Retour
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #f97316, #c2410c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 8px 24px rgba(249,115,22,0.25)',
            }}>
              <Shield size={24} color="white" strokeWidth={2} />
            </div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '1.5rem', margin: 0 }}>Centre de Sécurité</h1>
              <p style={{ opacity: 0.45, fontSize: '0.82rem', marginTop: '0.15rem' }}>
                Surveillance des accès et alertes — Super Admin Moncolis
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadAlerts}
          disabled={refreshing}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)', padding: '0.55rem 1.1rem', borderRadius: '10px',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            opacity: refreshing ? 0.5 : 1, transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <KpiCard label="Alertes critiques"  value={criticalCount}   color="#ea580c" active={criticalCount > 0}  icon={ShieldAlert} />
        <KpiCard label="Alertes élevées"    value={highCount}        color="#f97316" active={highCount > 0}       icon={AlertCircle} />
        <KpiCard label="Tentatives échouées" value={failedLogins}   color="#fb923c" active={failedLogins > 0}    icon={LockOpen} />
        <KpiCard label="IPs bloquées"       value={blockedAttempts} color="#fb923c" active={blockedAttempts > 0} icon={Ban} />
        <KpiCard label="Alertes en attente" value={unresolvedCount} color="#8b5cf6" active={unresolvedCount > 0} icon={AlertTriangle} />
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.5rem', gap: '0.25rem', overflowX: 'auto' }}>
        <SectionTab active={activeSection === 'alerts'}  onClick={() => setActiveSection('alerts')}  icon={AlertCircle} label={`Alertes (${unresolvedCount})`} />
        <SectionTab active={activeSection === 'history'} onClick={() => setActiveSection('history')} icon={FileText}    label={`Historique connexions (${loginHistory.length})`} />
        <SectionTab active={activeSection === 'config'}  onClick={() => setActiveSection('config')}  icon={Settings}    label="Config sécurité" />
      </div>

      {/* ── SECTION: Alertes ─────────────────────────────────────────────────── */}
      {activeSection === 'alerts' && (
        <div>
          {/* Filtres */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  style={{
                    padding: '0.35rem 0.85rem', borderRadius: '20px', border: '1px solid',
                    borderColor: filterSeverity === sev ? (sev === 'all' ? '#f97316' : severityColor(sev as SecurityAlert['severity'])) : 'rgba(255,255,255,0.1)',
                    background: filterSeverity === sev ? (sev === 'all' ? 'rgba(249,115,22,0.12)' : severityBg(sev as SecurityAlert['severity'])) : 'transparent',
                    color: filterSeverity === sev ? (sev === 'all' ? '#f97316' : severityColor(sev as SecurityAlert['severity'])) : 'rgba(255,255,255,0.45)',
                    fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                  }}
                >
                  {sev === 'all' ? 'Toutes' : severityLabel(sev as SecurityAlert['severity'])}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', opacity: 0.65, cursor: 'pointer' }}>
                <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} style={{ accentColor: '#f97316' }} />
                Afficher résolues
              </label>
              {unresolvedCount > 0 && (
                <button
                  onClick={handleResolveAll}
                  style={{
                    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e',
                    padding: '0.35rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}
                >
                  <CheckCircle2 size={13} /> Tout résoudre
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '4rem', opacity: 0.5 }}>
              <RefreshCw size={28} className="animate-spin" />
              <p style={{ fontSize: '0.9rem' }}>Chargement des alertes...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
              <CheckCircle2 size={48} color="#22c55e" style={{ opacity: 0.6, margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: '700', fontSize: '1.1rem', margin: '0 0 0.35rem' }}>Aucune alerte active</p>
              <p style={{ opacity: 0.5, fontSize: '0.85rem', margin: 0 }}>Le système est sécurisé.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} onResolve={handleResolve} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: Historique connexions ───────────────────────────────────── */}
      {activeSection === 'history' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Journal des connexions récentes</h3>
            <p style={{ margin: '0.2rem 0 0', opacity: 0.45, fontSize: '0.78rem' }}>Dernières 24 heures — toutes les tentatives d'accès</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {['Statut', 'Utilisateur', 'Rôle', 'IP', 'Détail', 'Date'].map(col => (
                    <th key={col} style={{
                      padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem',
                      textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, fontWeight: '700',
                      background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loginHistory.map((attempt, i) => {
                  const color = statusColor(attempt.status);
                  const StatusIcon = attempt.status === 'success' ? Check : attempt.status === 'failed' ? X : Ban;
                  return (
                    <tr key={attempt.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700',
                          background: `${color}18`, color, border: `1px solid ${color}40`,
                        }}>
                          <StatusIcon size={11} strokeWidth={2.5} />
                          {attempt.status === 'success' ? 'Succès' : attempt.status === 'failed' ? 'Échec' : 'Bloqué'}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', opacity: 0.85 }}>{attempt.email || '—'}</span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                        <span style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                          {attempt.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: attempt.ip.startsWith('185') ? '#f97316' : 'rgba(255,255,255,0.6)' }}>
                          {attempt.ip}
                          {attempt.ip.startsWith('185') && (
                            <AlertTriangle size={11} color="#f97316" style={{ marginLeft: '0.3rem', display: 'inline', verticalAlign: 'middle' }} />
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle', maxWidth: '280px', opacity: 0.7, fontSize: '0.8rem' }}>
                        {attempt.detail}
                      </td>
                      <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle', whiteSpace: 'nowrap', opacity: 0.5, fontSize: '0.78rem' }}>
                        {timeAgo(attempt.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: Configuration sécurité ──────────────────────────────────── */}
      {activeSection === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Service Email (Resend) */}
          <ConfigCard icon={Mail} title="Service d'Email (OTP)" subtitle="Configuration de l'envoi des OTP via Resend">
            <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.4rem', fontWeight: '600' }}>
                    Clé API Resend
                  </label>
                  <input
                    type="text"
                    value={resendKey}
                    onChange={(e) => setResendKey(e.target.value)}
                    placeholder={resendStatus === 'configured' ? '********' : 're_...'}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button
                    onClick={handleSaveResend}
                    disabled={savingResend || !resendKey || resendKey === '********'}
                    style={{
                      background: '#f97316',
                      border: 'none',
                      color: 'white',
                      padding: '0.65rem 1.25rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: (savingResend || !resendKey || resendKey === '********') ? 'not-allowed' : 'pointer',
                      opacity: (savingResend || !resendKey || resendKey === '********') ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    {savingResend ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    {savingResend ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: resendStatus === 'configured' ? '#22c55e' : '#fb923c' }}>
                {resendStatus === 'loading' ? (
                  <>Vérification...</>
                ) : resendStatus === 'configured' ? (
                  <><CheckCircle2 size={13} /> Clé API configurée et active.</>
                ) : (
                  <><AlertTriangle size={13} /> Aucune clé configurée. Les OTP seront affichés dans la console serveur.</>
                )}
              </div>
            </div>
          </ConfigCard>

          {/* Brute force */}
          <ConfigCard icon={ShieldCheck} title="Protection Brute Force" subtitle="Paramètres de verrouillage des comptes">
            <ConfigItem label="Tentatives max avant blocage" value="3"          type="info" />
            <ConfigItem label="Durée de verrouillage"        value="30 secondes" type="info" />
            <ConfigItem label="Fenêtre de surveillance"      value="5 minutes"  type="info" />
            <ConfigItem label="IP blacklist automatique"     value="Non"        type="warn" />
          </ConfigCard>

          {/* Sessions */}
          <ConfigCard icon={Key} title="Sessions & Cookies" subtitle="Gestion des jetons d'authentification">
            <ConfigItem label="Durée session standard"    value="7 jours"            type="info" />
            <ConfigItem label="Type cookie"               value="httpOnly + Secure"  type="ok" />
            <ConfigItem label="SameSite"                  value="Lax"                type="info" />
            <ConfigItem label="Algorithme signature"      value="HMAC-SHA256"        type="ok" />
            <ConfigItem label="Session admin (OTP)"       value="Session unique (onglet)" type="ok" />
          </ConfigCard>

          {/* Mots de passe */}
          <ConfigCard icon={Lock} title="Hachage des Mots de Passe" subtitle="Standard de sécurité des credentials">
            <ConfigItem label="Algorithme actuel"   value="bcrypt (cost 12)"       type="ok" />
            <ConfigItem label="Migration legacy"    value="SHA-256 → bcrypt auto"  type="info" />
            <ConfigItem label="Admin password"      value="SHA-256 (env var)"      type="info" />
            <ConfigItem label="PIN livreurs/agents" value="bcrypt hashé en BDD"    type="ok" />
          </ConfigCard>

          {/* RLS */}
          <ConfigCard icon={Database} title="Politiques RLS Supabase" subtitle="Row Level Security — isolation des données">
            <ConfigItem label="Table profiles"         value="SELECT restreint par rôle"      type="ok" />
            <ConfigItem label="Table packages"         value="vendeur/agence/livreur isolés"  type="ok" />
            <ConfigItem label="Table agencies"         value="PENDING → APPROVED requis"      type="ok" />
            <ConfigItem label="Table drop_points"      value="Visible publiquement (lecture)"  type="info" />
            <ConfigItem label="Table drop_point_agents" value="Service role requis (écriture)" type="ok" />
            <ConfigItem label="Table system_settings"  value="Admin uniquement (écriture)"    type="ok" />
          </ConfigCard>

          {/* Tip */}
          <div style={{
            background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.25)',
            borderRadius: '14px', padding: '1.1rem 1.3rem',
            display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
          }}>
            <Lightbulb size={20} color="#fb923c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontWeight: '700', fontSize: '0.88rem', margin: '0 0 0.35rem' }}>Améliorations recommandées</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', opacity: 0.7, lineHeight: 1.8 }}>
                <li>Activer la table <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>security_alerts</code> dans Supabase pour la persistance</li>
                <li>Configurer des webhooks Supabase pour les events d'authentification</li>
                <li>Mettre en place une IP allowlist pour l'accès admin en production</li>
                <li>Activer les notifications email/SMS pour les alertes critiques</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Config Card ──────────────────────────────────────────────────────────────
function ConfigCard({
  icon: Icon, title, subtitle, children,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
          background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>{title}</p>
          <p style={{ opacity: 0.5, fontSize: '0.78rem', margin: '0.1rem 0 0' }}>{subtitle}</p>
        </div>
        <span style={{
          background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)',
          padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <Check size={11} strokeWidth={3} /> Actif
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', padding: '1.25rem' }}>
        {children}
      </div>
    </div>
  );
}

