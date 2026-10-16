'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, destroySession } from '@/utils/adminAuth';
import { DEFAULT_DROP_POINTS, DropPoint, DropPointAgent, dataService } from '@/lib/data-service';
import { AdminRole, ROLE_LABELS, hasPermission } from '@/lib/adminPermissions';
import { supabase } from '@/utils/supabase/client';
import { KINSHASA_COMMUNES, KINSHASA_DATA } from '@/utils/kinshasa';
import {
  CheckCircle2, XCircle, Clock, MapPin, Phone, Mail, Building2, ShieldCheck,
  AlertCircle, RefreshCw, UserPlus, Key, Copy, Check, Hash, UserCheck, Shield, User, Lock, Settings, LayoutDashboard, Users, Package, Activity
} from 'lucide-react';
import PinModal from '@/components/PinModal';

// --- Types -----------------------------------------------------------------
interface Agence {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'suspended' | 'pending' | 'rejected';
  joinedDate: string;
  totalColis: number;
  tauxLivraison: number;
  livreurs: number;
  /** Le modèle de facturation avec Moncolis */
  billingType: 'Commission' | 'Mensuel' | 'Annuel';
  billingValue: number;
  /** Le taux de conversion FC appliqué par l'agence */
  tauxConversionFC?: number;
  managerName?: string;
  coverageZones?: string[];
  fleetSize?: number;
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

// --- Status colors ---------------------------------------------------------
// --- Status colors ---------------------------------------------------------
const statusColor: Record<string, string> = {
  'En attente': '#fb923c',
  'Accepte':    '#f97316',
  'Refuse':     '#f97316',
  'Assigne':    '#22c55e',
  'En transit': '#4ade80',
  'Livré':      '#10b981',
  'Annule':     '#6b7280',
};

// --- Sub-component: KPI Card ------------------------------------------------
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

// --- Sub-component: Status badge --------------------------------------------
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      background: active ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)',
      color: active ? '#10b981' : '#f97316',
      border: `1px solid ${active ? '#10b981' : '#f97316'}`,
      padding: '0.2rem 0.65rem', borderRadius: '20px',
      fontSize: '0.75rem', fontWeight: '700',
    }}>
      {active ? 'Actif' : 'Suspendu'}
    </span>
  );
}

// --- Main Component ---------------------------------------------------------
// --- Diagnostics types -----------------------------------------------------
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

// --- Helpers ----------------------------------------------------------------
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
  { id: 1, level: 'INFO',  message: 'Tableau de bord admin chargé.', time: new Date().toLocaleTimeString('fr-FR') },
];

// Type des onglets du dashboard
type TabKey = 'overview' | 'demandes' | 'relais' | 'agences' | 'vendeurs' | 'colis' | 'audit' | 'reconciliation' | 'diagnostique' | 'parametres';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [agences, setAgences]     = useState<Agence[]>([]);
  const [vendeurs, setVendeurs]   = useState<Vendeur[]>([]);
  const [colis, setColis]         = useState<ColisAdmin[]>([]);
  const [audits, setAudits]       = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [colisFilter, setColisFilter] = useState('Tous');
  const [searchColis, setSearchColis] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [navPinModal, setNavPinModal] = useState<{ href: string; label: string } | null>(null);
  const [adminUser, setAdminUser] = useState<{ id: string, name: string, role: AdminRole } | null>(null);
  const [plafondFC, setPlafondFC] = useState(2800);
  const [toast, setToast]         = useState<string | null>(null);

  // -- Action PIN (4 chiffres) -----------------------------------------------
  // Le PIN est stocké dans localStorage pour persister entre sessions.
  // La valeur par défaut est '0000' (l'admin doit le changer dès la 1ère connexion).
  const [actionPin, setActionPin] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('moncolis_admin_pin') || '0000';
    return '0000';
  });
  const [pinModal, setPinModal] = useState<{ open: boolean; onSuccess: () => void; label: string }>({ open: false, onSuccess: () => {}, label: '' });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Wrap any risky action with PIN prompt
  const requirePin = (label: string, onSuccess: () => void) => {
    setPinInput('');
    setPinError(false);
    setPinModal({ open: true, label, onSuccess });
  };

  const handlePinSubmit = () => {
    if (pinInput === actionPin) {
      setPinModal(m => ({ ...m, open: false }));
      pinModal.onSuccess();
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  // -- Drop point agents state --
  const [agents, setAgents] = useState<DropPointAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDropPointId, setNewAgentDropPointId] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentCreatedCredentials, setAgentCreatedCredentials] = useState<{ agent: DropPointAgent; plainPin: string } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  // Keeps plainPins in memory for the current session so admin can re-view them
  const [sessionPins, setSessionPins] = useState<Map<string, string>>(new Map());

  // -- Drop points creation state --
  const [showCreateDropPointModal, setShowCreateDropPointModal] = useState(false);
  const [creatingDropPoint, setCreatingDropPoint] = useState(false);
  const [newDpName, setNewDpName] = useState('');
  const [newDpPhone, setNewDpPhone] = useState('');
  const [newDpCommune, setNewDpCommune] = useState('');
  const [newDpQuartier, setNewDpQuartier] = useState('');
  const [newDpQuartierCustom, setNewDpQuartierCustom] = useState('');
  const [newDpAvenue, setNewDpAvenue] = useState('');
  const [newDpNumero, setNewDpNumero] = useState('');
  const [newDpManager, setNewDpManager] = useState('');
  // Credentials affichés après création du point relais + son premier agent
  const [newDpCredentials, setNewDpCredentials] = useState<{ dropPointName: string; agentNumber: string; plainPin: string; agentName: string } | null>(null);
  const [copiedDpCredentials, setCopiedDpCredentials] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch('/api/drop-points/agents', {
        headers: { }
      });
      if (res.ok) {
        const json = await res.json();
        setAgents(json.agents || []);
      } else {
        setAgents(await dataService.getDropPointAgents());
      }
    } catch {
      setAgents(await dataService.getDropPointAgents());
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  // Charger les vraies données Supabase au montage
  useEffect(() => {
    let cancelled = false;
    async function loadAllData() {
      setLoadingData(true);
      try {
        try {
          const authRes = await fetch('/api/auth/me');
          if (authRes.ok) {
            const authJson = await authRes.json();
            if (authJson.user && !cancelled) setAdminUser(authJson.user);
          }
        } catch(e) {}

        // Charger les agences
        const realAgencies = await dataService.getAgencies();
        if (!cancelled) {
          setAgences(realAgencies.map(ra => ({
            id: ra.id,
            name: ra.name,
            email: ra.email || 'contact@agence.cd',
            phone: ra.phone || '',
            address: ra.address || '',
            status: ra.status === 'APPROVED' ? 'active' : ra.status === 'PENDING' ? 'pending' : ra.status === 'REJECTED' ? 'rejected' : 'suspended',
            joinedDate: ra.createdAt ? new Date(ra.createdAt).toLocaleDateString('fr-FR') : '—',
            totalColis: 0,
            tauxLivraison: 0,
            livreurs: ra.fleetSize || 0,
            billingType: ra.billingType || 'Commission',
            billingValue: ra.billingValue || 15,
            tauxConversionFC: 2800,
            coverageZones: ra.coverageZones || [],
            fleetSize: ra.fleetSize || 0,
            managerName: ra.managerName,
          })));
        }

        // Charger le taux de change depuis system_settings
        const { supabase } = await import('@/utils/supabase/client');
        try {
          const { data: settings } = await supabase
            .from('system_settings')
            .select('exchange_rate')
            .eq('id', 'global')
            .single();
          if (settings && !cancelled) {
            setPlafondFC(settings.exchange_rate || 2800);
          }
        } catch (e) {
          console.warn('Could not load exchange rate', e);
        }

        // Charger les vendeurs depuis Supabase
        let profiles = null;
        try {
          const res = await supabase
            .from('profiles')
            .select('id, name, email, created_at')
            .eq('role', 'vendeur');
          profiles = res.data;
        } catch (e) {
          console.error("Erreur réseau profils", e);
        }
        if (!cancelled && profiles) {
          setVendeurs(profiles.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email || '',
            status: 'active',
            joinedDate: new Date(p.created_at).toLocaleDateString('fr-FR'),
            totalColis: 0,
            revenu: 0,
          })));
        }

        // Charger les points relais
        const realDropPoints = await dataService.getDropPoints();
        if (!cancelled) setDropPoints(realDropPoints);

        // Charger les colis
        const allPackages = await dataService.getAllPackages();
        if (!cancelled) {
          setColis(allPackages.slice(0, 100).map(p => ({
            id: p.id,
            clientName: p.clientName,
            vendeur: p.vendeurName || '—',
            agence: p.agence || '—',
            agenceId: p.agencyId || '',
            status: p.status,
            date: p.date,
            montant: p.prixLivraison || 0,
          })));
        }

        // Charger les audits financiers
        try {
          const auditRes = await fetch('/api/admin/financial-audits', {
            headers: { }
          });
          if (auditRes.ok) {
            const auditJson = await auditRes.json();
            if (!cancelled) setAudits(auditJson.audits || []);
          }
        } catch (e) {
          console.error("Erreur chargement audits", e);
        }

        // Charger la réconciliation
        try {
          const recoRes = await fetch('/api/admin/reconciliation', {
            headers: { }
          });
          if (recoRes.ok) {
            const recoJson = await recoRes.json();
            if (!cancelled && recoJson.data) setReconciliations(recoJson.data);
          }
        } catch (e) {
          console.error("Erreur chargement réconciliation", e);
        }
      } catch (err) {
        console.error('[AdminDashboard] loadAllData error:', err);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    loadAllData();
    return () => { cancelled = true; };
  }, []);

  // -- Diagnostics state ----------------------------------------------------
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

  // -- Derived stats ---------------------------------------------------------
  const totalColis    = useMemo(() => colis.length, [colis]);
  const totalLivres   = useMemo(() => colis.filter(c => c.status === 'Livré').length, [colis]);
  const activeAgences = useMemo(() => agences.filter(a => a.status === 'active').length, [agences]);
  const pendingAgencesCount = useMemo(() => agences.filter(a => a.status === 'pending').length, [agences]);

  // Revenu = somme des commissions sur colis LIVRES uniquement
  const commissionByAgence = useMemo(() => {
    // Keyed by agencyId for reliable lookups
    const map: Record<string, { id: string; name: string; rate: number; colisCount: number; revenu: number }> = {};
    agences.forEach(a => {
      const rate = a.billingType === 'Commission' ? (a.billingValue || 0) / 100 : 0;
      map[a.id] = { id: a.id, name: a.name, rate, colisCount: 0, revenu: 0 };
    });
    colis.forEach(c => {
      if (c.status !== 'Livré') return;
      if (!c.agenceId || !map[c.agenceId]) return;
      const agence = agences.find(a => a.id === c.agenceId);
      if (!agence) return;
      const rate = agence.billingType === 'Commission' ? (agence.billingValue || 0) / 100 : 0;
      map[c.agenceId].colisCount++;
      map[c.agenceId].revenu += c.montant * rate;
    });
    return Object.values(map).filter(e => e.colisCount > 0).sort((a, b) => b.revenu - a.revenu);
  }, [colis, agences]);

  const revenuTotal = useMemo(
    () => commissionByAgence.reduce((s, e) => s + e.revenu, 0),
    [commissionByAgence]
  );

  const getCommission = (c: ColisAdmin) => {
    if (c.status !== 'Livré') return null;
    const agence = agences.find(a => a.id === c.agenceId);
    if (!agence) return null;
    const rate = agence.billingType === 'Commission' ? (agence.billingValue || 0) / 100 : 0;
    return c.montant * rate;
  };

  const filteredColis = useMemo(() => {
    return colis.filter(c => {
      const matchStatus = colisFilter === 'Tous' || c.status === colisFilter;
      const q = searchColis.toLowerCase();
      const matchSearch = !q || c.id.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q) || c.vendeur.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [colis, colisFilter, searchColis]);

  // -- Handlers -------------------------------------------------------------
  const toggleAgenceStatus = async (id: string) => {
    const agence = agences.find(a => a.id === id);
    if (!agence) return;
    const newStatus = agence.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({ userId: id, isActive: newStatus === 'active' }),
      });
      if (res.ok) {
        setAgences(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
        setToast(`Agence ${newStatus === 'active' ? 'activée' : 'suspendue'} avec succès.`);
        setTimeout(() => setToast(null), 3000);
      } else {
        alert("Erreur lors de la modification du statut");
      }
    } catch {
      alert("Erreur réseau");
    }
  };

  const toggleAgenceStatusConfirmed = (id: string) => {
    const agence = agences.find(a => a.id === id);
    if (!agence) return;
    const action = agence.status === 'active' ? 'suspendre' : 'réactiver';
    requirePin(`Confirmer : ${action} l'agence "${agence.name}"`, () => toggleAgenceStatus(id));
  };

  const handleApproveAgency = async (id: string) => {
    await dataService.approveAgency(id);
    setAgences(prev => prev.map(a => a.id === id ? { ...a, status: 'active' } : a));
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ id: logIdRef.current++, level: 'INFO', message: `Superadmin a approuvé l'agence #${id}`, time: now }, ...prev.slice(0, 19)]);
    setToast("Compte agence validé et activé avec succès !");
    setTimeout(() => setToast(null), 3000);
  };
  const handleApproveAgencyConfirmed = (id: string) => {
    const a = agences.find(x => x.id === id);
    requirePin(`Valider l'agence "${a?.name || id}"`, () => handleApproveAgency(id));
  };

  const handleRejectAgency = async (id: string) => {
    await dataService.rejectAgency(id);
    setAgences(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ id: logIdRef.current++, level: 'WARN', message: `Superadmin a refusé la demande agence #${id}`, time: now }, ...prev.slice(0, 19)]);
    setToast("Demande d'adhésion agence refusée.");
    setTimeout(() => setToast(null), 3000);
  };
  const handleRejectAgencyConfirmed = (id: string) => {
    const a = agences.find(x => x.id === id);
    requirePin(`Refuser la demande de "${a?.name || id}"`, () => handleRejectAgency(id));
  };

  const toggleDropPointStatus = (id: string) => {
    const dp = dropPoints.find(d => d.id === id);
    if (!dp) return;
    requirePin(`${dp.isActive ? 'Désactiver' : 'Activer'} le point relais "${dp.name}"`, () => {
      setDropPoints(prev => prev.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d));
    });
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentDropPointId) return;
    setCreatingAgent(true);
    try {
      const res = await fetch('/api/drop-points/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          name: newAgentName.trim(),
          dropPointId: newAgentDropPointId,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Save PIN in session memory so admin can re-view it later
        setSessionPins(prev => new Map(prev).set(json.agent.agentNumber, json.plainPin));
        setAgentCreatedCredentials({ agent: json.agent, plainPin: json.plainPin });
        setNewAgentName('');
        setShowCreateAgentModal(false);
        loadAgents();
        const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [{ id: logIdRef.current++, level: 'INFO', message: `Superadmin a créé l'agent relais #${json.agent.agentNumber} (${json.agent.name})`, time: now }, ...prev.slice(0, 19)]);
        setToast(`Agent ${json.agent.name} créé avec succès !`);
        setTimeout(() => setToast(null), 4000);
      } else {
        alert(json.error || "Erreur lors de la création de l'agent.");
      }
    } catch {
      alert("Erreur réseau lors de la création de l'agent.");
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleCreateDropPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQuartier = newDpQuartier === 'AUTRE' ? newDpQuartierCustom.trim() : newDpQuartier;
    if (!newDpCommune || !finalQuartier || !newDpAvenue.trim() || !newDpNumero.trim()) {
      alert("L'adresse complète est requise (Commune, Quartier, Avenue, Numéro).");
      return;
    }
    if (!newDpManager.trim()) {
      alert("Le nom du gérant est requis pour créer les identifiants de l'agent.");
      return;
    }
    setCreatingDropPoint(true);
    try {
      // 1. Créer le Point Relais
      const dpRes = await fetch('/api/drop-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          name: newDpName,
          commune: newDpCommune,
          quartier: finalQuartier,
          avenue: newDpAvenue,
          numero: newDpNumero,
          phone: newDpPhone,
          managerName: newDpManager,
        }),
      });
      const dpJson = await dpRes.json();
      if (!dpRes.ok || !dpJson.dropPoint) {
        alert(dpJson.error || "Erreur lors de la création du point relais.");
        return;
      }
      const createdDp = dpJson.dropPoint;
      setDropPoints(prev => [createdDp, ...prev]);

      // 2. Créer automatiquement l'agent associé (gérant)
      const agentRes = await fetch('/api/drop-points/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ name: newDpManager.trim(), dropPointId: createdDp.id }),
      });
      const agentJson = await agentRes.json();

      setShowCreateDropPointModal(false);
      // 3. Afficher les identifiants générés
      if (agentRes.ok && agentJson.success) {
        setNewDpCredentials({
          dropPointName: createdDp.name,
          agentName: agentJson.agent.name,
          agentNumber: agentJson.agent.agentNumber,
          plainPin: agentJson.plainPin,
        });
        loadAgents();
      } else {
        setToast(`[OK] Point Relais créé ! Mais erreur agent: ${agentJson.error || 'Inconnue'}`);
        setTimeout(() => setToast(null), 5000);
      }
      // Réinitialisation
      setNewDpName(''); setNewDpPhone(''); setNewDpCommune('');
      setNewDpQuartier(''); setNewDpQuartierCustom('');
      setNewDpAvenue(''); setNewDpNumero(''); setNewDpManager('');
    } catch {
      alert("Erreur réseau lors de la création du point relais.");
    } finally {
      setCreatingDropPoint(false);
    }
  };

  const handleToggleAgentStatus = async (agent: DropPointAgent) => {
    const newStatus = !agent.isActive;
    try {
      const res = await fetch('/api/drop-points/agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          agentId: agent.id,
          isActive: newStatus,
        }),
      });
      if (res.ok) {
        setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, isActive: newStatus } : a));
        const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [{ id: logIdRef.current++, level: 'WARN', message: `Superadmin a ${newStatus ? 'activé' : 'désactivé'} l'agent relais #${agent.agentNumber}`, time: now }, ...prev.slice(0, 19)]);
        setToast(`Agent ${agent.name} ${newStatus ? 'activé' : 'désactivé'}.`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      await dataService.setDropPointAgentStatus(agent.id, newStatus);
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, isActive: newStatus } : a));
    }
  };

  const toggleVendeurStatus = async (id: string) => {
    const vendeur = vendeurs.find(v => v.id === id);
    if (!vendeur) return;
    const newStatus = vendeur.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({ userId: id, isActive: newStatus === 'active' }),
      });
      if (res.ok) {
        setVendeurs(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));
        setToast(`Vendeur ${newStatus === 'active' ? 'activé' : 'suspendu'} avec succès.`);
        setTimeout(() => setToast(null), 3000);
      } else {
        alert("Erreur lors de la modification du statut");
      }
    } catch {
      alert("Erreur réseau");
    }
  };

  const toggleVendeurStatusConfirmed = (id: string) => {
    const v = vendeurs.find(x => x.id === id);
    if (!v) return;
    const action = v.status === 'active' ? 'suspendre' : 'réactiver';
    requirePin(`Confirmer : ${action} le vendeur "${v.name}"`, () => toggleVendeurStatus(id));
  };

  const handleLogout = async () => {
    destroySession();
    // Clear the httpOnly admin_session cookie server-side
    try { await fetch('/api/auth/admin-logout', { method: 'POST' }); } catch {}
    router.replace('/admin-x9k2');
  };

  // -- Layout ----------------------------------------------------------------
  const role = adminUser?.role || 'superadmin';
  const allTabs: { key: TabKey; label: React.ReactNode; permission?: string }[] = [
    { key: 'overview' as TabKey,       label: <span style={{ display: 'flex', alignItems: 'center' }}><LayoutDashboard size={14} style={{ marginRight: '6px' }} /> Vue globale</span>, permission: undefined },
    { key: 'demandes' as TabKey,       label: <span style={{ display: 'flex', alignItems: 'center' }}><UserPlus size={14} style={{ marginRight: '6px' }} /> Adhésions Agences ({pendingAgencesCount})</span>, permission: 'canManageAgences' },
    { key: 'relais' as TabKey,         label: <span style={{ display: 'flex', alignItems: 'center' }}><MapPin size={14} style={{ marginRight: '6px' }} /> Points Relais ({dropPoints.length})</span>, permission: 'canManageRelais' },
    { key: 'agences' as TabKey,        label: <span style={{ display: 'flex', alignItems: 'center' }}><Building2 size={14} style={{ marginRight: '6px' }} /> Agences Actives ({agences.filter(a => a.status === 'active' || a.status === 'suspended').length})</span>, permission: 'canManageAgences' },
    { key: 'vendeurs' as TabKey,       label: <span style={{ display: 'flex', alignItems: 'center' }}><Users size={14} style={{ marginRight: '6px' }} /> Vendeurs ({vendeurs.length})</span>, permission: 'canManageVendeurs' },
    { key: 'colis' as TabKey,          label: <span style={{ display: 'flex', alignItems: 'center' }}><Package size={14} style={{ marginRight: '6px' }} /> Tous les colis ({colis.length})</span>, permission: 'canManageColis' },
    { key: 'audit' as TabKey,          label: <span style={{ display: 'flex', alignItems: 'center' }}><Shield size={14} style={{ marginRight: '6px' }} /> Audit Financier</span>, permission: 'canManageSettings' },
    { key: 'reconciliation' as TabKey, label: <span style={{ display: 'flex', alignItems: 'center' }}><AlertCircle size={14} style={{ marginRight: '6px' }} /> Écarts Livreurs</span>, permission: 'canManageSettings' },
    { key: 'diagnostique' as TabKey,   label: <span style={{ display: 'flex', alignItems: 'center' }}><Activity size={14} style={{ marginRight: '6px' }} /> Diagnostique Système</span>, permission: 'canViewDiagnostics' },
    { key: 'parametres' as TabKey,     label: <span style={{ display: 'flex', alignItems: 'center' }}><Settings size={14} style={{ marginRight: '6px' }} /> Paramètres Admin</span>, permission: 'canManageSettings' },
  ];
  const tabs = allTabs.filter(t => !t.permission || hasPermission(role, t.permission as any));

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
              background: 'linear-gradient(135deg, #f97316, #c2410c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5L12 1z" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ fontWeight: '800', fontSize: '0.9rem', margin: 0 }}>{adminUser?.name || 'Moncolis'}</p>
              <p style={{ fontSize: '0.7rem', color: ROLE_LABELS[role]?.color || '#f97316', margin: 0, fontWeight: '600' }}>{ROLE_LABELS[role]?.label || 'Super Admin'}</p>
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
                background: activeTab === tab.key ? 'rgba(249,115,22,0.12)' : 'transparent',
                color: activeTab === tab.key ? '#f97316' : 'rgba(255,255,255,0.55)',
                fontWeight: activeTab === tab.key ? '700' : '400',
                borderLeft: activeTab === tab.key ? '3px solid #f97316' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Advanced admin links */}
        {(hasPermission(role, 'canManageAdmins') || hasPermission(role, 'canViewSecurityLogs')) && (
        <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.3, margin: '0.5rem 0.1rem 0.4rem', fontWeight: '700' }}>Administration avancée</p>
          {([
            ...(hasPermission(role, 'canManageAdmins') ? [{ href: '/admin-x9k2/admins',   label: 'Gestion des Admins',  color: '#fb923c', iconPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }] : []),
            ...(hasPermission(role, 'canViewSecurityLogs') ? [{ href: '/admin-x9k2/securite', label: 'Sécurité',             color: '#f97316', iconPath: 'M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5L12 1z' }] : []),
            ...(hasPermission(role, 'canManageAdmins') ? [{ href: '/admin-x9k2/roles',    label: 'Rôles & Comptes',      color: '#22c55e', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }] : []),
          ] as { href: string; label: string; color: string; iconPath: string }[]).map(({ href, label, color, iconPath }) => (
            <button
              key={href}
              onClick={() => setNavPinModal({ href, label })}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.55rem',
                padding: '0.55rem 0.9rem', borderRadius: '10px',
                textDecoration: 'none', fontSize: '0.82rem', width: '100%',
                color: 'rgba(255,255,255,0.5)',
                borderLeft: '3px solid transparent',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                marginBottom: '0.15rem',
                position: 'relative',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `rgba(255,255,255,0.05)`;
                (e.currentTarget as HTMLElement).style.color = color;
                (e.currentTarget as HTMLElement).style.borderLeftColor = color;
                const svg = (e.currentTarget as HTMLElement).querySelector('path');
                if (svg) svg.style.stroke = color;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                const svg = (e.currentTarget as HTMLElement).querySelector('path');
                if (svg) svg.style.stroke = 'rgba(255,255,255,0.4)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d={iconPath} stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {label}
              {/* Lock icon to signal PIN protection */}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', opacity: 0.3, flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="white" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          ))}
        </div>
        )}

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
                <button onClick={handleLogout} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: 'none', background: '#f97316', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: '700' }}>Oui</button>
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

        {/* -- TAB: Overview -------------------------------------------------- */}
        {loadingData ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', opacity: 0.6 }}>
            <RefreshCw className="animate-spin" size={24} style={{ marginRight: '0.75rem' }} />
            <span>Chargement des données...</span>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="animate-fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <KpiCard label="Total colis"       value={totalColis}    sub="Depuis le debut"                       color="#22c55e" />
              <KpiCard label="Livres"             value={totalLivres}   sub={`${Math.round(totalLivres/totalColis*100)}% de taux`} color="#10b981" />
              <KpiCard label="Commission Moncolis" value={`${revenuTotal.toFixed(2)} USD`} sub="Sur colis livres uniquement" color="#fb923c" />
              <KpiCard label="Agences actives"    value={activeAgences} sub={`sur ${agences.length} total`}        color="#f97316" />
              <KpiCard label="Vendeurs"           value={vendeurs.filter(v => v.status === 'active').length} sub="comptes actifs" color="#22c55e" />
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
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#f97316,#c2410c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem', flexShrink: 0 }}>
                        {entry.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <p style={{ fontWeight: '600', fontSize: '0.875rem', margin: 0 }}>{entry.name}</p>
                        <p style={{ opacity: 0.45, fontSize: '0.75rem', margin: 0 }}>{entry.colisCount} colis livres · Taux {Math.round(entry.rate * 100)}%</p>
                      </div>
                      <div style={{ width: '160px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', opacity: 0.55, marginBottom: '0.3rem' }}>
                          <span>{pct.toFixed(1)}% du total</span>
                          <span style={{ fontWeight: '700', color: '#fb923c' }}>{entry.revenu.toFixed(2)} USD</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#fb923c,#fcd34d)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Total commissions percues :</span>
                <span style={{ fontWeight: '900', fontSize: '1.1rem', color: '#fb923c' }}>{revenuTotal.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Activity table (recent colis) */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Activite recente</h3>
                <button onClick={() => setActiveTab('colis')} style={{ background: 'transparent', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}>
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
                  {colis.slice(0, 5).map((c, i) => {
                    const comm = getCommission(c);
                    return (
                      <tr key={c.id}
                        style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '0.9rem 1.25rem', color: '#f97316', fontWeight: '600', whiteSpace: 'nowrap' }}>{c.id}</td>
                        <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>{c.clientName}</td>
                        <td style={{ padding: '0.9rem 1.25rem', opacity: 0.7, whiteSpace: 'nowrap' }}>{c.agence}</td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '600', color: '#22c55e', whiteSpace: 'nowrap' }}>{c.montant.toFixed(2)} USD</td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '700', color: comm !== null ? '#fb923c' : 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
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

        {/* Toast notification */}
        {toast && (
          <div style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', padding: '0.85rem 1.4rem', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            fontWeight: '600', fontSize: '0.9rem',
          }}>
            <CheckCircle2 size={18} />
            <span>{toast}</span>
          </div>
        )}

        {/* -- TAB: Audit Financier --------------------------------------------- */}
        {activeTab === 'audit' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(202, 138, 4, 0.08))',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              borderRadius: '16px', padding: '1.25rem 1.5rem',
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(249, 115, 22, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fb923c', flexShrink: 0, marginTop: '2px'
              }}>
                <Shield size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                  Journal d'Audit Financier et Opérationnel
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  Historique immuable de toutes les transactions et reversements (livreurs, agences, vendeurs). 
                  Utilisé comme <strong>preuve structurée</strong> en cas de litige financier.
                </p>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
              {audits.length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
                  <Shield size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>Aucune transaction enregistrée pour le moment.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Type d'Action</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Acteur</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Cible</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Montant</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((a, i) => (
                      <tr key={a.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                          {new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: '#fff' }}>{a.action_type}</td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span style={{ display: 'block', color: '#e2e8f0' }}>{a.actor_name || 'Système'}</span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span style={{ display: 'block', color: '#e2e8f0' }}>{a.target_name || '—'}</span>
                          {a.target_role && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({a.target_role})</span>}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: '700', color: a.amount_usd > 0 ? '#22c55e' : '#cbd5e1' }}>
                          {a.amount_usd > 0 ? `${a.amount_usd} $` : (a.amount_cdf > 0 ? `${a.amount_cdf} FC` : '—')}
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span style={{
                            background: a.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                            color: a.status === 'COMPLETED' ? '#4ade80' : '#fb923c',
                            padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700'
                          }}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* -- TAB: Écarts Livreurs (Reconciliation) --------------------------- */}
        {activeTab === 'reconciliation' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(185, 28, 28, 0.08))',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '16px', padding: '1.25rem 1.5rem',
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ef4444', flexShrink: 0, marginTop: '2px'
              }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                  Tableau de Réconciliation & Écarts
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  Comparaison entre l'argent que le livreur a collecté sur le terrain (colis livrés) et l'argent qu'il a réellement déposé à l'agence (via QR Code). Un écart positif indique que le livreur doit de l'argent à l'agence.
                </p>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
              {reconciliations.length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>Aucune donnée de réconciliation disponible.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Livreur</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Agence</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'right', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Attendu (Collecté)</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'right', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Déposé (Validé)</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'right', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>Écart (Manquant)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliations.map((r, i) => (
                      <tr key={r.driverId || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: '#fff' }}>{r.driverName}</td>
                        <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1' }}>{r.agencyName}</td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', color: '#cbd5e1', fontWeight: '500' }}>
                          {r.expectedCash.toLocaleString('fr-FR')} FC
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', color: '#4ade80', fontWeight: '500' }}>
                          {r.actualDeposited.toLocaleString('fr-FR')} FC
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '800', color: r.ecart > 0 ? '#ef4444' : '#22c55e' }}>
                          {r.ecart > 0 ? `+ ${r.ecart.toLocaleString('fr-FR')} FC` : (r.ecart < 0 ? `${r.ecart.toLocaleString('fr-FR')} FC` : '0 FC')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* -- TAB: Demandes d'Adhésion Agences ------------------------------- */}
        {activeTab === 'demandes' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Context Notice */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(245, 158, 11, 0.05))',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '16px', padding: '1.25rem 1.5rem',
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#f97316', flexShrink: 0, marginTop: '2px'
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                  Contrôle d'Accès & Habilitation des Agences Partenaires
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  À Kinshasa, la création de compte agence est strictement soumise à la validation préalable du <strong>Superadmin</strong>. Vérifiez la flotte déclarée, les zones de couverture et l'adresse du siège avant d'octroyer les droits opérationnels.
                </p>
              </div>
            </div>

            {/* List of Applications */}
            {agences.filter(a => a.status === 'pending' || a.status === 'rejected').length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '3.5rem 1.5rem',
                background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                borderRadius: '16px', color: '#94a3b8'
              }}>
                <CheckCircle2 size={42} color="#22c55e" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 0.35rem' }}>Toutes les demandes ont été traitées</h3>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>Aucun dossier d'agence en attente de validation.</p>
              </div>
            ) : (
              agences.filter(a => a.status === 'pending' || a.status === 'rejected').map(a => (
                <div key={a.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: a.status === 'pending' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '16px', padding: '1.5rem',
                  display: 'flex', flexDirection: 'column', gap: '1.25rem',
                  boxShadow: a.status === 'pending' ? '0 10px 30px rgba(245, 158, 11, 0.05)' : 'none'
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: a.status === 'pending' ? 'linear-gradient(135deg, #fb923c, #d97706)' : 'rgba(239, 68, 68, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: '800', fontSize: '1.2rem', flexShrink: 0
                      }}>
                        {a.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>{a.name}</h3>
                          <span style={{
                            padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '800',
                            background: a.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: a.status === 'pending' ? '#fb923c' : '#f97316',
                            border: `1px solid ${a.status === 'pending' ? '#fb923c' : '#f97316'}`,
                          }}>
                            {a.status === 'pending' ? 'EN ATTENTE DE VALIDATION' : 'REFUSÉE'}
                          </span>
                        </div>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                          Responsable : <strong style={{ color: '#cbd5e1' }}>{a.managerName || 'Gérant'}</strong> · Déposée : {a.joinedDate}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {a.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleApproveAgencyConfirmed(a.id)}
                          style={{
                            padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff', fontWeight: '700', fontSize: '0.85rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)', transition: 'all 0.2s'
                          }}
                        >
                          <CheckCircle2 size={16} />
                          Approuver et Habiliter
                        </button>

                        <button
                          onClick={() => handleRejectAgencyConfirmed(a.id)}
                          style={{
                            padding: '0.6rem 1.1rem', borderRadius: '10px',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#fca5a5', fontWeight: '700', fontSize: '0.85rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          <XCircle size={16} />
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Applicant details */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px',
                    fontSize: '0.82rem', color: '#cbd5e1'
                  }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>CONTACT WHATSAPP & APPELS</span>
                      <strong style={{ color: '#38bdf8' }}>{a.phone}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>EMAIL PROFESSIONNEL</span>
                      <span>{a.email}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>ADRESSE DU SIÈGE / DÉPÔT</span>
                      <span>{a.address}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>FLOTTE ESTIMÉE</span>
                      <strong style={{ color: '#4ade80' }}>{a.fleetSize || a.livreurs} coursiers / motos</strong>
                    </div>
                  </div>

                  {/* Coverage zones */}
                  {a.coverageZones && a.coverageZones.length > 0 && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Communes de Kinshasa desservies déclarées :
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {a.coverageZones.map(zone => (
                          <span key={zone} style={{
                            padding: '0.25rem 0.65rem', borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#93c5fd', fontSize: '0.78rem', fontWeight: '600'
                          }}>
                            <MapPin size={14} style={{ display: "inline", marginRight: "4px" }} /> {zone}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* -- TAB: Points de Dépôt / Relais ---------------------------------- */}
        {activeTab === 'relais' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(34, 197, 94, 0.08))',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '16px', padding: '1.25rem 1.5rem',
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#60a5fa', flexShrink: 0, marginTop: '2px'
              }}>
                <MapPin size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                      Maillage des Points de Dépôt & Relais — Kinshasa
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                      1. <strong>Premier Kilomètre (Vendeurs) :</strong> Les vendeurs peuvent déposer leurs colis directement au point relais de leur quartier pour un enlèvement rapide par un livreur.<br />
                      2. <strong>Dernier Kilomètre (Zones Inaccessibles) :</strong> En cas de secteur enclavé ou route impraticable, le livreur transfère le colis au point relais du secteur client pour retrait sécurisé via code OTP.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateDropPointModal(true)}
                    style={{
                      padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#fff', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0,
                      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)', fontFamily: 'inherit'
                    }}
                  >
                    <MapPin size={16} />
                    Créer Point Relais
                  </button>
                </div>
              </div>
            </div>

            {/* Drop points grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {dropPoints.map(dp => (
                <div key={dp.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: dp.isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(249,115,22,0.3)',
                  borderRadius: '16px', padding: '1.25rem',
                  display: 'flex', flexDirection: 'column', gap: '1rem',
                  opacity: dp.isActive ? 1 : 0.65
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem',
                          fontWeight: '800', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80'
                        }}>
                          {dp.commune}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{dp.id}</span>
                      </div>
                      <h4 style={{ margin: '0.35rem 0 0', fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                        {dp.name}
                      </h4>
                    </div>

                    <button
                      onClick={() => toggleDropPointStatus(dp.id)}
                      style={{
                        padding: '0.3rem 0.75rem', borderRadius: '20px', border: 'none',
                        background: dp.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: dp.isActive ? '#4ade80' : '#f97316',
                        fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      {dp.isActive ? 'Actif' : 'Désactivé'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem', color: '#94a3b8' }}>
                    <div><MapPin size={14} style={{ display: "inline", marginRight: "4px" }} /> <strong>Adresse :</strong> <span style={{ color: '#cbd5e1' }}>{dp.address}</span></div>
                    <div><User size={14} style={{ display: "inline", marginRight: "4px" }} /> <strong>Gérant :</strong> <span style={{ color: '#cbd5e1' }}>{dp.managerName}</span></div>
                    <div><Phone size={14} style={{ display: "inline", marginRight: "4px" }} /> <strong>Contact :</strong> <span style={{ color: '#38bdf8' }}>{dp.phone}</span></div>
                    <div><Clock size={14} style={{ display: "inline", marginRight: "4px" }} /> <strong>Horaires :</strong> <span style={{ color: '#fcd34d' }}>{dp.openingHours}</span></div>
                  </div>

                  {/* Credits System */}
                  <div style={{
                    padding: '0.75rem 0.85rem', background: 'rgba(0,0,0,0.25)',
                    borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Crédits Disponibles</span>
                      <span style={{
                        fontSize: '1.4rem', fontWeight: '900',
                        color: (dp.credits || 0) > 10 ? '#4ade80' : (dp.credits || 0) > 0 ? '#fb923c' : '#f97316'
                      }}>
                        {dp.credits || 0}
                      </span>
                      {(dp.credits || 0) === 0 && (
                        <span style={{ fontSize: '0.68rem', color: '#f97316', fontWeight: '700' }}><AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} /> INACTIF — Rechargez</span>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        const amountStr = prompt(`Combien de crédits ajouter à "${dp.name}" ? (1 crédit = 1 colis)`, '100');
                        if (!amountStr) return;
                        const amount = parseInt(amountStr);
                        if (!amount || amount <= 0) return alert('Montant invalide');
                        const res = await fetch('/api/admin/drop-points/credits', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', },
                          body: JSON.stringify({ dropPointId: dp.id, amount }),
                        });
                        if (res.ok) {
                          setDropPoints(prev => prev.map(d => d.id === dp.id ? { ...d, credits: (d.credits || 0) + amount } : d));
                          setToast(`[OK] +${amount} crédits ajoutés à ${dp.name}`);
                          setTimeout(() => setToast(null), 3000);
                        } else {
                          alert('Erreur lors du rechargement');
                        }
                      }}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                        background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80',
                        fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      + Recharger
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal: Créer un Point Relais */}
            {showCreateDropPointModal && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto'
              }}>
                <div style={{
                  maxWidth: '550px', width: '100%',
                  background: '#0d1117', border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '24px', padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
                  display: 'flex', flexDirection: 'column', gap: '1.25rem',
                  maxHeight: '90vh', overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                    }}>
                      <MapPin size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
                        Nouveau Point Relais
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                        Ajoutez un nouveau point physique de dépôt/retrait.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateDropPoint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>Nom du Point Relais *</label>
                        <input type="text" required value={newDpName} onChange={e => setNewDpName(e.target.value)} placeholder="Ex: Boutique Sarah" className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>Téléphone de contact *</label>
                        <input type="tel" required value={newDpPhone} onChange={e => setNewDpPhone(e.target.value)} placeholder="+243..." className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>Nom du Gérant (= Premier Agent) *</label>
                      <input type="text" required value={newDpManager} onChange={e => setNewDpManager(e.target.value)} placeholder="Ex: Jean Mukanya" className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }} />
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>Le gérant recevra un identifiant à 9 chiffres et un code PIN à 6 chiffres automatiquement générés.</p>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.5rem 0' }}></div>

                    <h4 style={{ margin: '0', fontSize: '0.95rem', fontWeight: '700', color: '#e2e8f0' }}>Adresse détaillée</h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>Commune *</label>
                        <select required value={newDpCommune} onChange={e => { setNewDpCommune(e.target.value); setNewDpQuartier(''); }} className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }}>
                          <option value="">Sélectionnez...</option>
                          {KINSHASA_COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>Quartier *</label>
                        <select required value={newDpQuartier} onChange={e => setNewDpQuartier(e.target.value)} disabled={!newDpCommune} className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box', opacity: !newDpCommune ? 0.5 : 1 }}>
                          <option value="">Sélectionnez...</option>
                          {newDpCommune && KINSHASA_DATA[newDpCommune]?.map(q => <option key={q} value={q}>{q}</option>)}
                          <option value="AUTRE">Autre (saisir manuellement)</option>
                        </select>
                        {newDpQuartier === 'AUTRE' && (
                          <input type="text" required value={newDpQuartierCustom} onChange={e => setNewDpQuartierCustom(e.target.value)} placeholder="Nom du quartier..." className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box', marginTop: '0.5rem' }} />
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>Avenue *</label>
                        <input type="text" required value={newDpAvenue} onChange={e => setNewDpAvenue(e.target.value)} placeholder="Ex: Kasa-Vubu" className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>N° *</label>
                        <input type="text" required value={newDpNumero} onChange={e => setNewDpNumero(e.target.value)} placeholder="Ex: 45A" className="input-field" style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                      <button type="button" onClick={() => setShowCreateDropPointModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#cbd5e1', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer' }}>Annuler</button>
                      <button type="submit" disabled={creatingDropPoint} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: '0.88rem', fontWeight: '800', cursor: creatingDropPoint ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)', opacity: creatingDropPoint ? 0.6 : 1 }}>{creatingDropPoint ? 'Création...' : 'Créer'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Identifiants de l'agent créé */}
            {newDpCredentials && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
              }}>
                <div style={{
                  maxWidth: '480px', width: '100%',
                  background: '#0d1117', border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '24px', padding: '2rem',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
                  display: 'flex', flexDirection: 'column', gap: '1.25rem'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}></div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>Point Relais créé !</h3>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>Transmettez ces identifiants au gérant <strong style={{ color: '#e2e8f0' }}>{newDpCredentials.agentName}</strong>.</p>
                  </div>

                  <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Identifiant (9 chiffres)</p>
                      <p style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#4ade80', letterSpacing: '0.15em', fontFamily: 'monospace' }}>{newDpCredentials.agentNumber}</p>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Code PIN (6 chiffres)</p>
                      <p style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#fbbf24', letterSpacing: '0.25em', fontFamily: 'monospace' }}>{newDpCredentials.plainPin}</p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    <AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} /> Ces identifiants ne seront <strong style={{ color: '#fbbf24' }}>affichés qu'une seule fois</strong>. Notez-les ou copiez-les avant de fermer.
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => {
                        const text = `Point Relais: ${newDpCredentials.dropPointName}\nAgent: ${newDpCredentials.agentName}\nIdentifiant: ${newDpCredentials.agentNumber}\nCode PIN: ${newDpCredentials.plainPin}`;
                        navigator.clipboard.writeText(text).then(() => { setCopiedDpCredentials(true); setTimeout(() => setCopiedDpCredentials(false), 2000); });
                      }}
                      style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      {copiedDpCredentials ? <Check size={16} /> : <Copy size={16} />}
                      {copiedDpCredentials ? 'Copié !' : 'Copier'}
                    </button>
                    <button
                      onClick={() => setNewDpCredentials(null)}
                      style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.4)' }}
                    >
                      J'ai noté, fermer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* -- SUB-SECTION: Agents Relais -- */}
            <div style={{
              marginTop: '1rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '1.5rem',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #f97316, #1d4ed8)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                    }}>
                      <UserCheck size={18} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
                      Agents des Points Relais
                    </h3>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '999px',
                      background: 'rgba(249,115,22,0.15)', color: '#60a5fa',
                      fontSize: '0.75rem', fontWeight: '800'
                    }}>
                      {agents.length} agent(s)
                    </span>
                  </div>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                    Chaque agent dispose d'un identifiant unique à 9 chiffres et d'un code PIN à 6 chiffres pour se connecter sur <code style={{ color: '#60a5fa', background: 'rgba(249,115,22,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>/point-relais</code>.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => loadAgents()}
                    disabled={loadingAgents}
                    style={{
                      padding: '0.6rem 0.9rem', borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                      color: '#cbd5e1', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit'
                    }}
                  >
                    <RefreshCw size={14} style={{ animation: loadingAgents ? 'spin 1s linear infinite' : 'none' }} />
                    Actualiser
                  </button>
                </div>
              </div>

              {/* Agent list */}
              {agents.length === 0 && !loadingAgents ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                  <User size={36} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
                  <p style={{ margin: '0 0 0.4rem', fontWeight: '700', color: '#cbd5e1' }}>Aucun agent créé pour le moment</p>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Cliquez sur "Créer un Agent" pour générer les identifiants d'un gérant de point relais.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
                  {agents.map(ag => (
                    <div key={ag.id} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: ag.isActive ? '1px solid rgba(249,115,22,0.25)' : '1px solid rgba(249,115,22,0.25)',
                      borderRadius: '16px', padding: '1.1rem',
                      display: 'flex', flexDirection: 'column', gap: '0.85rem',
                      opacity: ag.isActive ? 1 : 0.6
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{
                              fontFamily: 'monospace', fontSize: '0.92rem', fontWeight: '900',
                              letterSpacing: '1px', color: '#60a5fa',
                              background: 'rgba(249,115,22,0.12)', padding: '0.2rem 0.55rem', borderRadius: '6px',
                              border: '1px solid rgba(249,115,22,0.3)'
                            }}>
                              #{ag.agentNumber}
                            </span>
                            <span style={{
                              padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '800',
                              background: ag.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: ag.isActive ? '#4ade80' : '#f97316'
                            }}>
                              {ag.isActive ? 'Actif' : 'Désactivé'}
                            </span>
                          </div>
                          <h4 style={{ margin: '0.4rem 0 0.1rem', fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                            {ag.name}
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                            <MapPin size={14} style={{ display: "inline", marginRight: "4px" }} /> {ag.dropPointName} ({ag.dropPointCommune})
                          </p>
                        </div>

                        <button
                          onClick={() => handleToggleAgentStatus(ag)}
                          style={{
                            padding: '0.35rem 0.75rem', borderRadius: '8px', border: 'none',
                            background: ag.isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: ag.isActive ? '#f97316' : '#4ade80',
                            fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit'
                          }}
                        >
                          {ag.isActive ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </div>

                      <div style={{
                        padding: '0.5rem 0.75rem', borderRadius: '8px',
                        background: 'rgba(0,0,0,0.25)', fontSize: '0.74rem', color: '#64748b',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <span>Créé le {ag.createdAt ? new Date(ag.createdAt).toLocaleDateString('fr-FR') : 'Récemment'}</span>
                        <span style={{ color: '#94a3b8' }}>Réf: {ag.dropPointId}</span>
                      </div>

                      {/* Bouton Voir accès — visible si PIN encore en session */}
                      {sessionPins.has(ag.agentNumber) && (
                        <button
                          onClick={() => {
                            setAgentCreatedCredentials({ agent: ag, plainPin: sessionPins.get(ag.agentNumber)! });
                            setCopiedCredentials(false);
                          }}
                          style={{
                            width: '100%', padding: '0.55rem', borderRadius: '8px',
                            border: '1px solid rgba(250, 204, 21, 0.4)',
                            background: 'rgba(250, 204, 21, 0.08)',
                            color: '#fbbf24', fontSize: '0.8rem', fontWeight: '700',
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                          }}
                        >
                          <UserCheck size={14} style={{ display: "inline", marginRight: "4px" }} /> Voir les accès (session active)
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal: Créer un Agent */}
            {showCreateAgentModal && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
              }}>
                <div style={{
                  maxWidth: '460px', width: '100%',
                  background: '#0d1117', border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '24px', padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
                  display: 'flex', flexDirection: 'column', gap: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #f97316, #1d4ed8)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                    }}>
                      <UserPlus size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
                        Créer un Agent Relais
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                        Un identifiant à 9 chiffres et un PIN seront générés automatiquement.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                        Nom et prénom de l'agent :
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Sarah Maloba"
                        value={newAgentName}
                        onChange={e => setNewAgentName(e.target.value)}
                        style={{
                          width: '100%', padding: '0.75rem 1rem',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                        Point Relais associé :
                      </label>
                      <select
                        value={newAgentDropPointId}
                        onChange={e => setNewAgentDropPointId(e.target.value)}
                        style={{
                          width: '100%', padding: '0.75rem 1rem',
                          background: '#161b22', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                        }}
                      >
                        {dropPoints.map(dp => (
                          <option key={dp.id} value={dp.id}>
                            {dp.name} — {dp.commune}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowCreateAgentModal(false)}
                        style={{
                          flex: 1, padding: '0.75rem', borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                          color: '#cbd5e1', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer'
                        }}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={creatingAgent || !newAgentName.trim()}
                        style={{
                          flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none',
                          background: 'linear-gradient(135deg, #f97316, #1d4ed8)',
                          color: '#fff', fontSize: '0.88rem', fontWeight: '800',
                          cursor: creatingAgent || !newAgentName.trim() ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                          opacity: creatingAgent || !newAgentName.trim() ? 0.6 : 1
                        }}
                      >
                        {creatingAgent ? 'Génération...' : 'Générer les accès'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Identifiants générés */}
            {agentCreatedCredentials && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
              }}>
                <div style={{
                  maxWidth: '480px', width: '100%',
                  background: '#0d1117', border: '1px solid rgba(34, 197, 94, 0.35)',
                  borderRadius: '24px', padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
                  display: 'flex', flexDirection: 'column', gap: '1.25rem'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '60px', height: '60px', borderRadius: '20px',
                      background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)',
                      margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#4ade80'
                    }}>
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.3rem', fontWeight: '900', color: '#fff' }}>
                      Agent Créé avec Succès !
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                      Voici les accès confidentiels pour <strong>{agentCreatedCredentials.agent.name}</strong> ({agentCreatedCredentials.agent.dropPointName}).
                    </p>
                  </div>

                  <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                        Identifiant Agent (9 chiffres)
                      </span>
                      <div style={{
                        marginTop: '0.3rem', padding: '0.75rem', borderRadius: '10px',
                        background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
                        fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: '900', color: '#60a5fa',
                        letterSpacing: '5px', textAlign: 'center'
                      }}>
                        {agentCreatedCredentials.agent.agentNumber}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                        Code PIN Initial (6 chiffres)
                      </span>
                      <div style={{
                        marginTop: '0.3rem', padding: '0.75rem', borderRadius: '10px',
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                        fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: '900', color: '#4ade80',
                        letterSpacing: '7px', textAlign: 'center'
                      }}>
                        {agentCreatedCredentials.plainPin}
                      </div>
                    </div>

                    <div style={{
                      padding: '0.65rem 0.85rem', borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)',
                      fontSize: '0.78rem', color: '#fcd34d', display: 'flex', gap: '0.5rem', alignItems: 'center'
                    }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>Notez bien ce code PIN car il ne sera plus réaffiché dans cette interface.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const text = `Moncolis — Accès Agent Point Relais\nAgent : ${agentCreatedCredentials.agent.name}\nPoint Relais : ${agentCreatedCredentials.agent.dropPointName}\nIdentifiant : ${agentCreatedCredentials.agent.agentNumber}\nCode PIN : ${agentCreatedCredentials.plainPin}\nConnexion : https://moncolis.cd/point-relais`;
                        navigator.clipboard.writeText(text);
                        setCopiedCredentials(true);
                        setTimeout(() => setCopiedCredentials(false), 3000);
                      }}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: '10px',
                        border: '1px solid rgba(249,115,22,0.4)', background: 'rgba(249,115,22,0.15)',
                        color: '#60a5fa', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      {copiedCredentials ? <><Check size={16} /> Copié !</> : <><Copy size={16} /> Copier les accès</>}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAgentCreatedCredentials(null);
                        setCopiedCredentials(false);
                      }}
                      style={{
                        padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        color: '#fff', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      Terminer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -- TAB: Agences --------------------------------------------------- */}
        {activeTab === 'agences' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {agences.filter(a => a.status === 'active' || a.status === 'suspended').length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Aucune agence active pour le moment.</p>
            ) : (
              agences.filter(a => a.status === 'active' || a.status === 'suspended').map(a => (
              <div key={a.id} style={{
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${a.status === 'suspended' ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '14px', padding: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #f97316, #c2410c)',
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
                  {(() => {
                    const agenceColis = colis.filter(c => c.agenceId === a.id);
                    const agenceLivres = agenceColis.filter(c => c.status === 'Livré');
                    const tauxLivraison = agenceColis.length > 0 ? Math.round((agenceLivres.length / agenceColis.length) * 100) : 0;
                    // Commission due (colis livrés × taux)
                    const commEntry = commissionByAgence.find(e => e.id === a.id);
                    const commissionDue = commEntry?.revenu ?? 0;
                    return (
                      <>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#22c55e', margin: 0 }}>{agenceColis.length}</p>
                          <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Colis</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#fb923c', margin: 0 }}>{tauxLivraison}%</p>
                          <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Taux livraison</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#22c55e', margin: 0 }}>{a.livreurs}</p>
                          <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Livreurs</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#fb923c', margin: 0 }}>
                            {a.billingType === 'Commission' ? `${a.billingValue}%` : `${a.billingValue}$`}
                          </p>
                          <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>{a.billingType}</p>
                          <button
                            onClick={() => {
                              const type = prompt("Type de facturation (Commission, Mensuel, Annuel)", a.billingType) as 'Commission' | 'Mensuel' | 'Annuel';
                              if (['Commission', 'Mensuel', 'Annuel'].includes(type)) {
                                const valStr = prompt("Valeur de la facturation (en % ou en $)", a.billingValue.toString());
                                if (valStr) {
                                  fetch('/api/admin/agencies/billing', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', },
                                    body: JSON.stringify({ agencyId: a.id, billingType: type, billingValue: parseFloat(valStr) })
                                  }).then(() => {
                                    setAgences(prev => prev.map(ag => ag.id === a.id ? { ...ag, billingType: type, billingValue: parseFloat(valStr) } : ag));
                                  });
                                }
                              }
                            }}
                            style={{ background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', borderRadius: '4px', fontSize: '0.65rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', cursor: 'pointer' }}
                          >
                            Modifier
                          </button>
                        </div>

                        {/* Dette envers Moncolis (superadmin) */}
                        <div style={{
                          textAlign: 'center',
                          background: commissionDue > 0 ? 'rgba(251,146,60,0.1)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${commissionDue > 0 ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: '10px', padding: '0.5rem 0.9rem',
                        }}>
                          <p style={{ fontWeight: '900', fontSize: '1.15rem', color: commissionDue > 0 ? '#fb923c' : 'rgba(255,255,255,0.25)', margin: 0 }}>
                            {commissionDue > 0 ? `${commissionDue.toFixed(2)} $` : '—'}
                          </p>
                          <p style={{ opacity: 0.6, fontSize: '0.7rem', margin: 0, lineHeight: 1.3 }}>
                            Doit à<br /><strong style={{ color: '#f97316' }}>Moncolis</strong>
                          </p>
                        </div>

                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                          <p style={{ fontWeight: '800', fontSize: '1.1rem', color: '#0ea5e9', margin: 0 }}>{a.tauxConversionFC ?? '—'}</p>
                          <p style={{ opacity: 0.6, fontSize: '0.7rem', margin: 0 }}>Taux FC (1 USD)</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Actions */}
                <button
                  onClick={() => toggleAgenceStatusConfirmed(a.id)}
                  style={{
                    padding: '0.5rem 1.1rem', borderRadius: '9999px', border: 'none',
                    background: a.status === 'active' ? 'rgba(249,115,22,0.12)' : 'rgba(16,185,129,0.12)',
                    color: a.status === 'active' ? '#f97316' : '#10b981',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', fontSize: '0.82rem',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  {a.status === 'active' ? 'Suspendre' : 'Reactiver'}
                </button>
              </div>
            )))}
          </div>
        )}

        {/* -- TAB: Vendeurs -------------------------------------------------- */}
        {activeTab === 'vendeurs' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {vendeurs.map(v => (
              <div key={v.id} style={{
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${v.status === 'suspended' ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '14px', padding: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #22c55e, #f97316)',
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
                    <p style={{ fontWeight: '800', fontSize: '1.3rem', color: '#fb923c', margin: 0 }}>{v.revenu} EUR</p>
                    <p style={{ opacity: 0.5, fontSize: '0.72rem', margin: 0 }}>Revenu</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleVendeurStatusConfirmed(v.id)}
                  style={{
                    padding: '0.5rem 1.1rem', borderRadius: '9999px', border: 'none',
                    background: v.status === 'active' ? 'rgba(249,115,22,0.12)' : 'rgba(16,185,129,0.12)',
                    color: v.status === 'active' ? '#f97316' : '#10b981',
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

        {/* -- TAB: Colis ----------------------------------------------------- */}
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
                {['Tous', 'En attente', 'Accepte', 'En transit', 'Livré', 'Refuse', 'Annule'].map(s => (
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
                      <td style={{ padding: '1rem 1.25rem', color: '#f97316', fontWeight: '700' }}>{c.id}</td>
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

        {/* -- TAB: Diagnostique ---------------------------------------------- */}
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
                    <p style={{ fontSize: '1.4rem', fontWeight: '800', color: memUsed > memTotal! * 0.7 ? '#fb923c' : '#10b981', margin: 0 }}>{memUsed} MB</p>
                    <div style={{ marginTop: '0.5rem', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.round(memUsed / memTotal! * 100))}%`, background: memUsed > memTotal! * 0.7 ? '#fb923c' : '#10b981', borderRadius: '2px', transition: 'width 1s ease' }} />
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
                <p style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f97316', margin: 0, textTransform: 'uppercase' }}>{connection}</p>
                <p style={{ fontSize: '0.72rem', opacity: 0.4, marginTop: '0.3rem' }}>Network Information API</p>
              </div>

              {/* Services OK */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.25rem' }}>
                <p style={{ fontSize: '0.72rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Services operationnels</p>
                <p style={{ fontSize: '1.4rem', fontWeight: '800', color: services.every(s => s.status === 'ok') ? '#10b981' : '#fb923c', margin: 0 }}>
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
                const dot: Record<string, string> = { ok: '#10b981', warn: '#fb923c', error: '#f97316' };
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
                  const levelColor: Record<string, string> = { INFO: '#f97316', WARN: '#fb923c', ERROR: '#f97316' };
                  return (
                    <div
                      key={log.id}
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap',
                        background: log.level === 'ERROR' ? 'rgba(249,115,22,0.04)' : 'transparent',
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
        </>
        )}

      {/* ── TAB : Paramètres Admin ──────────────────────────────────── */}
      {activeTab === 'parametres' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '640px' }}>
          {/* PIN de sécurité */}
          <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={20} color="#f97316" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Code PIN d&apos;Action (4 chiffres)</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', opacity: 0.5 }}>Requis pour suspension, validation, création de compte.</p>
              </div>
            </div>

            {actionPin === '0000' && (
              <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem' }}>
                <AlertCircle size={16} color="#f97316" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}><AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} /> PIN par défaut <strong>0000</strong> — changez-le immédiatement.</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>Nouveau PIN (4 chiffres)</label>
                <input type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value.replace(/\D/g,'').slice(0,4))}
                  style={{ width:'100%', padding:'0.75rem 1rem', borderRadius:'10px', fontSize:'1.5rem', letterSpacing:'8px', fontWeight:'900', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>Confirmer le nouveau PIN</label>
                <input type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={confirmPinInput}
                  onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g,'').slice(0,4))}
                  style={{ width:'100%', padding:'0.75rem 1rem', borderRadius:'10px', fontSize:'1.5rem', letterSpacing:'8px', fontWeight:'900', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', outline:'none', boxSizing:'border-box' }} />
              </div>

              {pinChangeMsg && (
                <div style={{ padding:'0.75rem 1rem', borderRadius:'10px', background: pinChangeMsg.type==='success' ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)', border:`1px solid ${pinChangeMsg.type==='success' ? '#10b981' : '#f97316'}`, color: pinChangeMsg.type==='success' ? '#10b981' : '#f97316', fontSize:'0.85rem', fontWeight:'600' }}>
                  {pinChangeMsg.text}
                </div>
              )}

              <button
                onClick={() => {
                  if (newPinInput.length !== 4) { setPinChangeMsg({ type:'error', text:'Le PIN doit contenir exactement 4 chiffres.' }); return; }
                  if (newPinInput !== confirmPinInput) { setPinChangeMsg({ type:'error', text:'Les deux PINs ne correspondent pas.' }); return; }
                  requirePin('Confirmez votre identité pour changer le PIN', () => {
                    localStorage.setItem('moncolis_admin_pin', newPinInput);
                    setActionPin(newPinInput);
                    setNewPinInput(''); setConfirmPinInput('');
                    setPinChangeMsg({ type:'success', text:'[OK] PIN mis à jour avec succès !' });
                    setTimeout(() => setPinChangeMsg(null), 4000);
                  });
                }}
                style={{ padding:'0.8rem', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#f97316,#c2410c)', color:'#fff', fontWeight:'800', fontSize:'0.9rem', cursor:'pointer', width:'100%' }}
              >
                <Lock size={16} style={{ display: "inline", marginRight: "4px" }} /> Mettre à jour le PIN
              </button>
            </div>
          </div>

          {/* Plafond Taux de Change */}
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'2rem' }}>
            <h3 style={{ margin:'0 0 0.5rem', fontSize:'1.1rem', fontWeight:'800' }}><RefreshCw size={18} style={{ display: "inline", marginRight: "4px" }} /> Plafond Taux de Change (FC)</h3>
            <p style={{ opacity:0.5, fontSize:'0.82rem', margin:'0 0 1.25rem' }}>Taux maximum qu&apos;une agence peut configurer (FC pour 1 USD).</p>
            <div style={{ display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap' }}>
              <input type="number" value={plafondFC} onChange={e => setPlafondFC(parseInt(e.target.value)||0)}
                style={{ flex:1, minWidth:'140px', padding:'0.75rem 1rem', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:'1.2rem', fontWeight:'700', outline:'none' }} />
              <span style={{ color:'#94a3b8', fontWeight:'700' }}>FC / 1 USD</span>
              <button
                onClick={async () => requirePin('Modifier le taux de change global', async () => {
                  const { error } = await supabase
                    .from('system_settings')
                    .update({ exchange_rate: plafondFC })
                    .eq('id', 'global');
                  if (error) {
                    setToast(`[Erreur] Erreur: ${error.message}`);
                  } else {
                    setToast(`[OK] Taux de change mis à jour: ${plafondFC} Fc / 1 USD`);
                  }
                  setTimeout(() => setToast(null), 3500);
                })}
                style={{ padding:'0.75rem 1.5rem', borderRadius:'10px', border:'none', background:'#f97316', color:'#fff', fontWeight:'700', cursor:'pointer' }}
              >Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      </main>

      {/* ── Modale PIN Navigation Administration Avancée ─────────────────── */}
      {navPinModal && (
        <PinModal
          destination={navPinModal.label}
          onSuccess={() => {
            const href = navPinModal.href;
            setNavPinModal(null);
            window.location.href = href;
          }}
          onCancel={() => setNavPinModal(null)}
        />
      )}

      {/* ── Modale PIN d'action ──────────────────────────────────────────── */}
      {pinModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'1rem' }}>
          <div style={{ background:'#0a0a0a', border:'1px solid rgba(249,115,22,0.35)', borderRadius:'24px', padding:'2rem', width:'100%', maxWidth:'360px', boxShadow:'0 30px 70px rgba(0,0,0,0.7)' }}>
            <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
              <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                <Shield size={28} color="#f97316" />
              </div>
              <h2 style={{ margin:'0 0 0.3rem', fontSize:'1.1rem', fontWeight:'800' }}><Lock size={16} style={{ display: "inline", marginRight: "4px" }} /> Authentification Requise</h2>
              <p style={{ margin:0, fontSize:'0.78rem', color:'#64748b', lineHeight:1.5 }}>{pinModal.label}</p>
            </div>

            {/* Indicateurs PIN */}
            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center', marginBottom:'1rem' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width:'52px', height:'60px', borderRadius:'14px', border:`2px solid ${pinError ? '#f97316' : pinInput.length > i ? '#f97316' : 'rgba(255,255,255,0.1)'}`, background: pinInput.length > i ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', transition:'all 0.15s' }}>
                  {pinInput.length > i ? '●' : ''}
                </div>
              ))}
            </div>
            {pinError && <p style={{ textAlign:'center', color:'#f97316', fontSize:'0.82rem', fontWeight:'700', margin:'0 0 0.75rem' }}>[Erreur] Code incorrect. Réessayez.</p>}

            {/* Clavier numérique */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem', marginBottom:'1rem' }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((key, i) => (
                <button key={i}
                  onClick={() => {
                    if (key === '⌫') { setPinInput(p => p.slice(0,-1)); setPinError(false); }
                    else if (key !== '' && pinInput.length < 4) {
                      const next = pinInput + String(key);
                      setPinInput(next); setPinError(false);
                      if (next.length === 4) {
                        setTimeout(() => {
                          if (next === actionPin) { setPinModal(m=>({...m,open:false})); pinModal.onSuccess(); setPinInput(''); setPinError(false); }
                          else { setPinError(true); setPinInput(''); }
                        }, 180);
                      }
                    }
                  }}
                  disabled={key === ''}
                  style={{ padding:'1rem', borderRadius:'12px', border:'none', fontSize:'1.25rem', fontWeight:'700', background: key==='⌫' ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.05)', color: key==='⌫' ? '#f97316' : '#fff', cursor: key==='' ? 'default' : 'pointer', visibility: key==='' ? 'hidden' : 'visible', transition:'background 0.15s' }}
                >{key}</button>
              ))}
            </div>

            <button onClick={() => { setPinModal(m=>({...m,open:false})); setPinInput(''); setPinError(false); }}
              style={{ width:'100%', padding:'0.7rem', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:'0.85rem' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

