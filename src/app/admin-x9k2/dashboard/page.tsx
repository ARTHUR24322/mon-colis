'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, destroySession } from '@/utils/adminAuth';

// ─── Types ─────────────────────────────────────────────────────────────────
interface Agence {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'suspended';
  joinedDate: string;
  totalColis: number;
  tauxLivraison: number;
  livreurs: number;
  /** Commission rate Moncolis prélève sur chaque colis livré (0–1) */
  commissionRate: number;
  /** Le taux de conversion FC appliqué par l'agence */
  tauxConversionFC?: number;
}

interface Vendeur {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'suspended';
  joinedDate: string;
  totalColis: number;
  revenu: number;
}

interface ColisAdmin {
  id: string;
  clientName: string;
  vendeur: string;
  agence: string;
  agenceId: string;
  status: string;
  date: string;
  montant: number;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────
// Commission Moncolis : prélevée sur chaque colis LIVRE par l'agence
const AGENCES: Agence[] = [
  { id: 'A1', name: 'Express Delivery',   email: 'contact@express.fr',    phone: '+33 1 10 20 30 40', address: '12 Rue Rivoli, Paris',          status: 'active',    joinedDate: '2025-01-10', totalColis: 842, tauxLivraison: 96, livreurs: 8, commissionRate: 0.12, tauxConversionFC: 2850 },
  { id: 'A2', name: 'Mondial Logistique', email: 'info@mondial-log.fr',   phone: '+33 4 50 60 70 80', address: '5 Place Bellecour, Lyon',       status: 'active',    joinedDate: '2025-02-15', totalColis: 613, tauxLivraison: 91, livreurs: 5, commissionRate: 0.10, tauxConversionFC: 2800 },
  { id: 'A3', name: 'Chronopost Local',   email: 'admin@chrono-local.fr', phone: '+33 9 90 80 70 60', address: '3 Av. du Port, Marseille',      status: 'suspended', joinedDate: '2025-04-01', totalColis: 204, tauxLivraison: 78, livreurs: 2, commissionRate: 0.08, tauxConversionFC: 2850 },
  { id: 'A4', name: 'Relais Colis Pro',   email: 'rcp@relaiscolis.fr',    phone: '+33 5 30 40 50 60', address: '8 Cours Victor Hugo, Bordeaux', status: 'active',    joinedDate: '2025-06-20', totalColis: 118, tauxLivraison: 88, livreurs: 3, commissionRate: 0.09, tauxConversionFC: 2820 },
];

const VENDEURS: Vendeur[] = [
  { id: 'V1', name: 'Boutique Express',   email: 'boutique@express.fr',  status: 'active',    joinedDate: '2025-01-20', totalColis: 312, revenu: 1404 },
  { id: 'V2', name: 'Mode & Co',          email: 'mode@co.fr',           status: 'active',    joinedDate: '2025-03-05', totalColis: 187, revenu:  841 },
  { id: 'V3', name: 'Tech Shop DZ',       email: 'tech@shopdz.com',      status: 'active',    joinedDate: '2025-05-12', totalColis:  98, revenu:  441 },
  { id: 'V4', name: 'Bio Nature',         email: 'contact@bionature.fr', status: 'suspended', joinedDate: '2025-07-01', totalColis:  43, revenu:  193 },
];

const COLIS_ADMIN: ColisAdmin[] = [
  { id: 'COL-1029', clientName: 'Alice Dubois',     vendeur: 'Boutique Express', agence: 'Express Delivery',   agenceId: 'A1', status: 'En attente',  date: '2026-07-02', montant: 4.50 },
  { id: 'COL-1028', clientName: 'Jean-Pierre Noir', vendeur: 'Mode & Co',        agence: 'Mondial Logistique', agenceId: 'A2', status: 'Livre',       date: '2026-07-01', montant: 3.90 },
  { id: 'COL-1027', clientName: 'Fatou Diallo',     vendeur: 'Boutique Express', agence: 'Express Delivery',   agenceId: 'A1', status: 'En transit',  date: '2026-06-30', montant: 4.50 },
  { id: 'COL-1026', clientName: 'Thomas Remy',      vendeur: 'Tech Shop DZ',     agence: 'Mondial Logistique', agenceId: 'A2', status: 'Livre',       date: '2026-06-29', montant: 3.90 },
  { id: 'COL-1025', clientName: 'Amira Saidani',    vendeur: 'Mode & Co',        agence: 'Chronopost Local',   agenceId: 'A3', status: 'Refuse',      date: '2026-06-28', montant: 5.20 },
  { id: 'COL-1024', clientName: 'Lucas Bernard',    vendeur: 'Boutique Express', agence: 'Express Delivery',   agenceId: 'A1', status: 'Livre',       date: '2026-06-27', montant: 4.50 },
  { id: 'COL-1023', clientName: 'Nadia Hamdi',      vendeur: 'Tech Shop DZ',     agence: 'Relais Colis Pro',   agenceId: 'A4', status: 'Livre',       date: '2026-06-26', montant: 3.00 },
  { id: 'COL-1022', clientName: 'Pierre Legrand',   vendeur: 'Mode & Co',        agence: 'Express Delivery',   agenceId: 'A1', status: 'Accepte',     date: '2026-06-25', montant: 4.50 },
];

// ─── Status colors ─────────────────────────────────────────────────────────
const statusColor: Record<string, string> = {
  'En attente': '#f59e0b',
  'Accepte':    '#3b82f6',
  'Refuse':     '#ef4444',
  'Assigne':    '#8b5cf6',
  'En transit': '#06b6d4',
  'Livre':      '#10b981',
  'Annule':     '#6b7280',
};

// ─── Sub-component: KPI Card ────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '70px', height: '70px', background: color, opacity: 0.12, borderRadius: '0 0 0 70px' }} />
      <p style={{ fontSize: '0.78rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: '900', color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.35rem' }}>{sub}</p>}
    </div>
  );
}

// ─── Sub-component: Status badge ────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      background: active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
      color: active ? '#10b981' : '#ef4444',
      border: `1px solid ${active ? '#10b981' : '#ef4444'}`,
      padding: '0.2rem 0.65rem', borderRadius: '20px',
      fontSize: '0.75rem', fontWeight: '700',
    }}>
      {active ? 'Actif' : 'Suspendu'}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
// ─── Diagnostics types ─────────────────────────────────────────────────────
interface ServiceCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  latency: number; // ms
  detail: string;
}

interface LogEntry {
  id: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  time: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function randomLatency(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildServices(): ServiceCheck[] {
  const dbLat  = randomLatency(4, 22);
  const apiLat = randomLatency(8, 45);
  const stoLat = randomLatency(12, 60);
  const authLat = randomLatency(3, 18);
  return [
    { name: 'Base de donnees (Supabase)', status: dbLat  < 20 ? 'ok' : 'warn', latency: dbLat,  detail: 'PostgreSQL — pool 10/50 connexions actives' },
    { name: 'API Applicative',            status: apiLat < 40 ? 'ok' : 'warn', latency: apiLat, detail: 'Next.js API routes — 0 erreur 5xx derniere heure' },
    { name: 'Stockage Supabase Storage',  status: stoLat < 50 ? 'ok' : 'warn', latency: stoLat, detail: 'Bucket public — 2.4 GB utilises sur 10 GB' },
    { name: 'Service Auth',               status: authLat < 15 ? 'ok' : 'warn', latency: authLat, detail: 'JWT — sessions actives : 3' },
    { name: 'CDN / Edge',                 status: 'ok',                         latency: 2,      detail: 'Vercel Edge Network — 99.98% uptime 30 jours' },
  ];
}

const INITIAL_LOGS: LogEntry[] = [
  { id: 1, level: 'INFO',  message: 'Connexion admin etablie depuis 127.0.0.1',           time: '02:07:14' },
  { id: 2, level: 'INFO',  message: 'Colis COL-1029 cree par Boutique Express',            time: '02:04:52' },
  { id: 3, level: 'WARN',  message: 'Agence Chronopost Local — taux livraison sous 80%',   time: '01:58:33' },
  { id: 4, level: 'INFO',  message: 'Livreur Marc Dupont : statut passe a Indisponible',   time: '01:47:10' },
  { id: 5, level: 'ERROR', message: 'Tentative de connexion admin echouee (3/3) — IP bloquee 30s', time: '01:41:05' },
  { id: 6, level: 'INFO',  message: 'Colis COL-1028 marque Livre par Sophie Martin',       time: '01:30:21' },
  { id: 7, level: 'WARN',  message: 'Memoire heap > 70% — surveillance activee',           time: '01:22:47' },
  { id: 8, level: 'INFO',  message: 'Nouveau vendeur inscrit : Bio Nature',                time: '00:55:03' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'agences' | 'vendeurs' | 'colis' | 'diagnostique'>('overview');
  const [agences, setAgences]     = useState<Agence[]>(AGENCES);
  const [vendeurs, setVendeurs]   = useState<Vendeur[]>(VENDEURS);
  const [colis]                   = useState<ColisAdmin[]>(COLIS_ADMIN);
  const [colisFilter, setColisFilter] = useState('Tous');
  const [searchColis, setSearchColis] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [plafondFC, setPlafondFC] = useState(2850);

  // ── Diagnostics state ────────────────────────────────────────────────────
  const [services, setServices]   = useState<ServiceCheck[]>(buildServices);
  const [logs, setLogs]           = useState<LogEntry[]>(INITIAL_LOGS);
  const [uptime, setUptime]       = useState(0); // seconds since tab open
  const [memUsed, setMemUsed]     = useState<number | null>(null);
  const [memTotal, setMemTotal]   = useState<number | null>(null);
  const [connection, setConnection] = useState<string>('—');
  const [diagRefreshing, setDiagRefreshing] = useState(false);
  const logIdRef = useRef(INITIAL_LOGS.length + 1);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) router.replace('/admin-x9k2');
  }, [router]);

  // Uptime ticker
  useEffect(() => {
    const t = setInterval(() => setUptime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Live browser metrics
  useEffect(() => {
    const readMem = () => {
      const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
      if (perf.memory) {
        setMemUsed(Math.round(perf.memory.usedJSHeapSize / 1024 / 1024));
        setMemTotal(Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024));
      }
      const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
      if (nav.connection?.effectiveType) setConnection(nav.connection.effectiveType);
    };
    readMem();
    const t = setInterval(readMem, 2000);
    return () => clearInterval(t);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const handleDiagRefresh = useCallback(() => {
    setDiagRefreshing(true);
    setTimeout(() => {
      setServices(buildServices());
      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLogs(prev => [{ id: logIdRef.current++, level: 'INFO', message: 'Diagnostique systeme rafraichi manuellement', time: now }, ...prev.slice(0, 19)]);
      setDiagRefreshing(false);
    }, 900);
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalColis    = useMemo(() => colis.length, [colis]);
  const totalLivres   = useMemo(() => colis.filter(c => c.status === 'Livre').length, [colis]);
  const activeAgences = useMemo(() => agences.filter(a => a.status === 'active').length, [agences]);

  // Revenu = somme des commissions sur colis LIVRES uniquement
  const commissionByAgence = useMemo(() => {
    const map: Record<string, { name: string; rate: number; colisCount: number; revenu: number }> = {};
    agences.forEach(a => {
      map[a.id] = { name: a.name, rate: a.commissionRate, colisCount: 0, revenu: 0 };
    });
    colis.forEach(c => {
      if (c.status !== 'Livre') return;
      const agence = agences.find(a => a.id === c.agenceId);
      if (!agence) return;
      map[c.agenceId].colisCount++;
      map[c.agenceId].revenu += c.montant * agence.commissionRate;
    });
    return Object.values(map).filter(e => e.colisCount > 0).sort((a, b) => b.revenu - a.revenu);
  }, [colis, agences]);

  const revenuTotal = useMemo(
    () => commissionByAgence.reduce((s, e) => s + e.revenu, 0),
    [commissionByAgence]
  );

  const getCommission = (c: ColisAdmin) => {
    if (c.status !== 'Livre') return null;
    const agence = agences.find(a => a.id === c.agenceId);
    return agence ? c.montant * agence.commissionRate : null;
  };

  const filteredColis = useMemo(() => {
    return colis.filter(c => {
      const matchStatus = colisFilter === 'Tous' || c.status === colisFilter;
      const q = searchColis.toLowerCase();
      const matchSearch = !q || c.id.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q) || c.vendeur.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [colis, colisFilter, searchColis]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleAgenceStatus = (id: string) => {
    setAgences(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'active' ? 'suspended' : 'active' } : a));
  };

  const toggleVendeurStatus = (id: string) => {
    setVendeurs(prev => prev.map(v => v.id === id ? { ...v, status: v.status === 'active' ? 'suspended' : 'active' } : v));
  };

  const handleLogout = () => {
    destroySession();
    router.replace('/admin-x9k2');
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'overview',      label: 'Vue globale' },
    { key: 'agences',       label: `Agences (${agences.length})` },
    { key: 'vendeurs',      label: `Vendeurs (${vendeurs.length})` },
    { key: 'colis',         label: `Tous les colis (${colis.length})` },
    { key: 'diagnostique',  label: 'Diagnostique Systeme' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: '#020202' }}>

      {/* Sidebar */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '220px',
        background: 'rgba(10,10,10,0.95)', borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', zIndex: 50,
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5L12 1z" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ fontWeight: '800', fontSize: '0.9rem', margin: 0 }}>Moncolis</p>
              <p style={{ fontSize: '0.7rem', color: '#ef4444', margin: 0, fontWeight: '600' }}>Super Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left', fontSize: '0.875rem',
                background: activeTab === tab.key ? 'rgba(239,68,68,0.12)' : 'transparent',
                color: activeTab === tab.key ? '#ef4444' : 'rgba(255,255,255,0.55)',
                fontWeight: activeTab === tab.key ? '700' : '400',
                borderLeft: activeTab === tab.key ? '3px solid #ef4444' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {!confirmLogout ? (
            <button
              onClick={() => setConfirmLogout(true)}
              style={{
                width: '100%', padding: '0.6rem', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.82rem', transition: 'all 0.2s',
              }}
            >
              Deconnexion
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, textAlign: 'center', margin: 0 }}>Confirmer ?</p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={handleLogout} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: '700' }}>Oui</button>
                <button onClick={() => setConfirmLogout(false)} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' }}>Non</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: '220px', padding: '2rem', minHeight: '100vh' }}>

        {/* Page header */}
        <div style={{ marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h1 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>
            {tabs.find(t => t.key === activeTab)?.label}
          </h1>
          <p style={{ opacity: 0.45, marginTop: '0.25rem', fontSize: '0.85rem' }}>
            Panneau d'administration — acces restreint
          </p>
        </div>

        {/* ── TAB: Overview ────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <KpiCard label="Total colis"       value={totalColis}    sub="Depuis le debut"                       color="#22c55e" />
              <KpiCard label="Livres"             value={totalLivres}   sub={`${Math.round(totalLivres/totalColis*100)}% de taux`} color="#10b981" />
              <KpiCard label="Commission Moncolis" value={`${revenuTotal.toFixed(2)} USD`} sub="Sur colis livres uniquement" color="#f59e0b" />
              <KpiCard label="Agences actives"    value={activeAgences} sub={`sur ${agences.length} total`}        color="#ef4444" />
              <KpiCard label="Vendeurs"           value={vendeurs.filter(v => v.status === 'active').length} sub="comptes actifs" color="#8b5cf6" />
            </div>

            {/* Commission breakdown by agency */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Revenus par agence — commissions percues</h3>
                <p style={{ margin: '0.2rem 0 0', opacity: 0.45, fontSize: '0.78rem' }}>Uniquement sur les colis au statut Livre</p>
              </div>
              {commissionByAgence.length === 0 ? (
                <p style={{ padding: '2rem', textAlign: 'center', opacity: 0.4, fontSize: '0.875rem' }}>Aucun colis livre pour le moment.</p>
              ) : (
                commissionByAgence.map((entry, i) => {
                  const pct = revenuTotal > 0 ? (entry.revenu / revenuTotal) * 100 : 0;
                  return (
                    <div key={entry.name} style={{
                      padding: '1rem 1.5rem',
                      borderBottom: i < commissionByAgence.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
                    }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#ef4444,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem', flexShrink: 0 }}>
                        {entry.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <p style={{ fontWeight: '600', fontSize: '0.875rem', margin: 0 }}>{entry.name}</p>
                        <p style={{ opacity: 0.45, fontSize: '0.75rem', margin: 0 }}>{entry.colisCount} colis livres · Taux {Math.round(entry.rate * 100)}%</p>
                      </div>
                      <div style={{ width: '160px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', opacity: 0.55, marginBottom: '0.3rem' }}>
                          <span>{pct.toFixed(1)}% du total</span>
                          <span style={{ fontWeight: '700', color: '#f59e0b' }}>{entry.revenu.toFixed(2)} USD</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#f59e0b,#fcd34d)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Total commissions percues :</span>
                <span style={{ fontWeight: '900', fontSize: '1.1rem', color: '#f59e0b' }}>{revenuTotal.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Activity table (recent colis) */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Activite recente</h3>
                <button onClick={() => setActiveTab('colis')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}>
                  Voir tout
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['ID', 'Client', 'Agence', 'Montant', 'Commission', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', opacity: 0.4, fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COLIS_ADMIN.slice(0, 5).map((c, i) => {
                    const comm = getCommission(c);
                    return (
                      <tr key={c.id}
                        style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '0.9rem 1.25rem', color: '#ef4444', fontWeight: '600', whiteSpace: 'nowrap' }}>{c.id}</td>
                        <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>{c.clientName}</td>
                        <td style={{ padding: '0.9rem 1.25rem', opacity: 0.7, whiteSpace: 'nowrap' }}>{c.agence}</td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '600', color: '#22c55e', whiteSpace: 'nowrap' }}>{c.montant.toFixed(2)} USD</td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '700', color: comm !== null ? '#f59e0b' : 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
                          {comm !== null ? `+${comm.toFixed(2)} USD` : '—'}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <span style={{ background: statusColor[c.status] || '#6b7280', color: 'white', padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Global parameters for FC conversion ceiling */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', marginTop: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '700' }}>Parametres Globaux</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>Plafond du taux de change (Franc Congolais)</label>
                  <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.8rem' }}>Valeur maximale de conversion USD/FC que les agences peuvent definir.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '300px' }}>
                    <input
                      type="number"
                      value={plafondFC}
                      onChange={e => setPlafondFC(Number(e.target.value) || 0)}
                      style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', flex: 1 }}
                    />
                    <span style={{ fontWeight: '700', opacity: 0.6 }}>FC pour 1 USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Agences ─────────────────────────────────────────────────── */}
        {activeTab === 'agences' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {agences.map(a => (
              <div key={a.id} style={{
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${a.status === 'suspended' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '14px', padding: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '800', fontSize: '1.1rem', color: 'white',
                }}>
                  {a.name.charAt(0)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '1rem' }}>{a.name}</strong>
                    <StatusBadge active={a.status === 'active'} />
                  </div>
                  <p style={{ opacity: 0.5, fontSize: '0.8rem', margin: 0 }}>{a.email} · {a.phone}</p>
                  <p style={{ opacity: 0.4, fontSize: '0.75rem', margin: '0.2rem 0 0' }}>{a.address}</p>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#22c55e', margin: 0 }}>{a.totalColis}</p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Colis</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#f59e0b', margin: 0 }}>{a.tauxLivraison}%</p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Taux livraison</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#8b5cf6', margin: 0 }}>{a.livreurs}</p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Livreurs</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#f59e0b', margin: 0 }}>{Math.round(a.commissionRate * 100)}%</p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Commission</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.1rem', color: '#fcd34d', margin: 0 }}>
                      {(commissionByAgence.find(e => e.name === a.name)?.revenu ?? 0).toFixed(2)} USD
                    </p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Verse a Moncolis</p>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.1rem', color: '#0ea5e9', margin: 0 }}>{a.tauxConversionFC ?? '—'}</p>
                    <p style={{ opacity: 0.6, fontSize: '0.7rem', margin: 0 }}>Taux FC (1 USD)</p>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => toggleAgenceStatus(a.id)}
                  style={{
                    padding: '0.5rem 1.1rem', borderRadius: '9999px', border: 'none',
                    background: a.status === 'active' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    color: a.status === 'active' ? '#ef4444' : '#10b981',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', fontSize: '0.82rem',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  {a.status === 'active' ? 'Suspendre' : 'Reactiver'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: Vendeurs ────────────────────────────────────────────────── */}
        {activeTab === 'vendeurs' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {vendeurs.map(v => (
              <div key={v.id} style={{
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${v.status === 'suspended' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '14px', padding: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '800', fontSize: '1.1rem', color: 'white',
                }}>
                  {v.name.charAt(0)}
                </div>

                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '1rem' }}>{v.name}</strong>
                    <StatusBadge active={v.status === 'active'} />
                  </div>
                  <p style={{ opacity: 0.5, fontSize: '0.8rem', margin: 0 }}>{v.email}</p>
                  <p style={{ opacity: 0.4, fontSize: '0.75rem', margin: '0.2rem 0 0' }}>
                    Inscrit le {new Date(v.joinedDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#22c55e', margin: 0 }}>{v.totalColis}</p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Colis</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#f59e0b', margin: 0 }}>{v.revenu} EUR</p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Revenu</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleVendeurStatus(v.id)}
                  style={{
                    padding: '0.5rem 1.1rem', borderRadius: '9999px', border: 'none',
                    background: v.status === 'active' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    color: v.status === 'active' ? '#ef4444' : '#10b981',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', fontSize: '0.82rem',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  {v.status === 'active' ? 'Suspendre' : 'Reactiver'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: Colis ───────────────────────────────────────────────────── */}
        {activeTab === 'colis' && (
          <div className="animate-fade-in">
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                className="input-field"
                placeholder="Rechercher (ID, client, vendeur...)"
                value={searchColis}
                onChange={e => setSearchColis(e.target.value)}
                style={{ flex: 1, minWidth: '200px', padding: '0.55rem 1rem', fontSize: '0.875rem' }}
              />
              <select
                value={colisFilter}
                onChange={e => setColisFilter(e.target.value)}
                className="input-field"
                style={{ padding: '0.55rem 0.9rem', width: 'auto', fontSize: '0.875rem' }}
              >
                {['Tous', 'En attente', 'Accepte', 'En transit', 'Livre', 'Refuse', 'Annule'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['ID Colis', 'Client', 'Vendeur', 'Agence', 'Date', 'Montant', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '1rem 1.25rem', textAlign: 'left', opacity: 0.4, fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredColis.map((c, i) => (
                    <tr key={c.id}
                      style={{ borderBottom: i < filteredColis.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '1rem 1.25rem', color: '#ef4444', fontWeight: '700' }}>{c.id}</td>
                      <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>{c.clientName}</td>
                      <td style={{ padding: '1rem 1.25rem', opacity: 0.7 }}>{c.vendeur}</td>
                      <td style={{ padding: '1rem 1.25rem', opacity: 0.7 }}>{c.agence}</td>
                      <td style={{ padding: '1rem 1.25rem', opacity: 0.55, whiteSpace: 'nowrap' }}>{new Date(c.date).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: '#22c55e' }}>{c.montant.toFixed(2)} USD</td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ background: statusColor[c.status] || '#6b7280', color: 'white', padding: '0.22rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredColis.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', opacity: 0.4 }}>
                        Aucun colis ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '0.75rem', opacity: 0.4, fontSize: '0.8rem' }}>{filteredColis.length} colis affiche(s)</p>
          </div>
        )}

        {/* ── TAB: Diagnostique ────────────────────────────────────────────── */}
        {activeTab === 'diagnostique' && (
          <div className="animate-fade-in">

            {/* Header + Refresh */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ opacity: 0.5, fontSize: '0.82rem', margin: 0 }}>Derniere mise a jour automatique : en temps reel</p>
              </div>
              <button
                onClick={handleDiagRefresh}
                disabled={diagRefreshing}
                style={{
                  padding: '0.55rem 1.2rem', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.12)',
                  background: diagRefreshing ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
                  color: diagRefreshing ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                  cursor: diagRefreshing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '600',
                  transition: 'all 0.2s',
                }}
              >
                {diagRefreshing ? 'Actualisation...' : 'Actualiser'}
              </button>
            </div>

            {/* Live metrics row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
              {/* Uptime */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.25rem' }}>
                <p style={{ fontSize: '0.72rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Session ouverte</p>
                <p style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: '800', color: '#22c55e', margin: 0 }}>{formatUptime(uptime)}</p>
                <p style={{ fontSize: '0.72rem', opacity: 0.4, marginTop: '0.3rem' }}>hh:mm:ss</p>
              </div>

              {/* JS Heap */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.25rem' }}>
                <p style={{ fontSize: '0.72rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Memoire JS (heap)</p>
                {memUsed !== null ? (
                  <>
                    <p style={{ fontSize: '1.4rem', fontWeight: '800', color: memUsed > memTotal! * 0.7 ? '#f59e0b' : '#10b981', margin: 0 }}>{memUsed} MB</p>
                    <div style={{ marginTop: '0.5rem', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.round(memUsed / memTotal! * 100))}%`, background: memUsed > memTotal! * 0.7 ? '#f59e0b' : '#10b981', borderRadius: '2px', transition: 'width 1s ease' }} />
                    </div>
                    <p style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '0.3rem' }}>sur {memTotal} MB limit</p>
                  </>
                ) : (
                  <p style={{ fontSize: '0.82rem', opacity: 0.4, margin: 0 }}>Non disponible (Firefox / Safari)</p>
                )}
              </div>

              {/* Connexion */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.25rem' }}>
                <p style={{ fontSize: '0.72rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Connexion reseau</p>
                <p style={{ fontSize: '1.4rem', fontWeight: '800', color: '#3b82f6', margin: 0, textTransform: 'uppercase' }}>{connection}</p>
                <p style={{ fontSize: '0.72rem', opacity: 0.4, marginTop: '0.3rem' }}>Network Information API</p>
              </div>

              {/* Services OK */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.25rem' }}>
                <p style={{ fontSize: '0.72rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Services operationnels</p>
                <p style={{ fontSize: '1.4rem', fontWeight: '800', color: services.every(s => s.status === 'ok') ? '#10b981' : '#f59e0b', margin: 0 }}>
                  {services.filter(s => s.status === 'ok').length} / {services.length}
                </p>
                <p style={{ fontSize: '0.72rem', opacity: 0.4, marginTop: '0.3rem' }}>sante globale</p>
              </div>
            </div>

            {/* Services health checks */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>Verification des services</h3>
              </div>
              {services.map((svc, i) => {
                const dot: Record<string, string> = { ok: '#10b981', warn: '#f59e0b', error: '#ef4444' };
                const label: Record<string, string> = { ok: 'OK', warn: 'ATTENTION', error: 'ERREUR' };
                return (
                  <div
                    key={svc.name}
                    style={{
                      padding: '1rem 1.5rem',
                      borderBottom: i < services.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                    }}
                  >
                    {/* Status dot */}
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: dot[svc.status], flexShrink: 0, boxShadow: `0 0 6px ${dot[svc.status]}` }} />

                    {/* Name + detail */}
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <p style={{ fontWeight: '600', fontSize: '0.875rem', margin: 0 }}>{svc.name}</p>
                      <p style={{ opacity: 0.45, fontSize: '0.75rem', margin: 0 }}>{svc.detail}</p>
                    </div>

                    {/* Latency bar */}
                    <div style={{ width: '120px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', opacity: 0.55, marginBottom: '0.3rem' }}>
                        <span>Latence</span>
                        <span style={{ fontWeight: '700', color: dot[svc.status] }}>{svc.latency} ms</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, svc.latency * 2)}%`, background: dot[svc.status], borderRadius: '2px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>

                    {/* Badge */}
                    <span style={{
                      background: `${dot[svc.status]}1a`, color: dot[svc.status],
                      border: `1px solid ${dot[svc.status]}`,
                      padding: '0.18rem 0.6rem', borderRadius: '20px',
                      fontSize: '0.7rem', fontWeight: '800', flexShrink: 0,
                    }}>
                      {label[svc.status]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Event log */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>Journal des evenements</h3>
                <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{logs.length} entrees</span>
              </div>
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {logs.map(log => {
                  const levelColor: Record<string, string> = { INFO: '#3b82f6', WARN: '#f59e0b', ERROR: '#ef4444' };
                  return (
                    <div
                      key={log.id}
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap',
                        background: log.level === 'ERROR' ? 'rgba(239,68,68,0.04)' : 'transparent',
                      }}
                    >
                      <span style={{
                        fontFamily: 'monospace', fontSize: '0.72rem',
                        background: `${levelColor[log.level]}22`, color: levelColor[log.level],
                        border: `1px solid ${levelColor[log.level]}44`,
                        padding: '0.1rem 0.45rem', borderRadius: '4px',
                        fontWeight: '800', flexShrink: 0, alignSelf: 'center',
                      }}>
                        {log.level}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.4, flexShrink: 0, alignSelf: 'center' }}>{log.time}</span>
                      <span style={{ fontSize: '0.82rem', opacity: 0.8, flex: 1 }}>{log.message}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
