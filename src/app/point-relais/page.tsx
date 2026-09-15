'use client';

import { useState, useEffect } from 'react';
import {
  MapPin, Lock, Eye, EyeOff, LogOut, Package, CheckCircle2,
  Clock, ShieldCheck, User, Hash, Phone, ArrowLeft, AlertCircle,
  RefreshCw, Plus, ArrowRight, QrCode, Truck, Building2,
  X, ChevronDown, Copy, Check
} from 'lucide-react';
import Link from 'next/link';
import { dataService, ColisItem, DropPointAgent, DEFAULT_DROP_POINTS, VendorDeposit } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';

type DashboardTab = 'incoming' | 'available' | 'vendor_deposits';

interface AgentSession {
  id: string;
  agentNumber: string;
  name: string;
  dropPointId: string;
  dropPointName: string;
  dropPointCommune: string;
}

interface Agency {
  id: string;
  name: string;
}

export default function PointRelaisPage() {
  const { user, loading: authLoading, sessionChecked, logout } = useAuth();
  
  const [agent, setAgent] = useState<AgentSession | null>(null);

  // Auto-login if session exists
  useEffect(() => {
    if (sessionChecked && user?.role === 'point_relais') {
      const a = {
        id: user.id,
        agentNumber: user.agentNumber || '',
        name: user.name,
        dropPointId: user.dropPointId || user.agencyId || 'dp-1',
        dropPointName: user.dropPointName || 'Point Relais',
        dropPointCommune: user.dropPointCommune || 'Commune'
      };
      setAgent(a);
      loadPackages(a.dropPointId);
      loadAgencies();
    }
  }, [user, sessionChecked]);

  /* -- UI state -- */
  const [showQrModal, setShowQrModal] = useState(false);

  /* -- Dashboard state -- */
  const [incoming, setIncoming] = useState<ColisItem[]>([]);
  const [available, setAvailable] = useState<ColisItem[]>([]);
  const [vendorDeposits, setVendorDeposits] = useState<VendorDeposit[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('vendor_deposits');

  /* -- Vendor deposit form state -- */
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositForm, setDepositForm] = useState({
    vendeurName: '',
    vendeurPhone: '',
    clientName: '',
    clientPhone: '',
    clientAddress: '',
    description: '',
  });
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositResult, setDepositResult] = useState<VendorDeposit | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  /* -- Agency assign state -- */
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [assigningDeposit, setAssigningDeposit] = useState<string | null>(null); // pickupCode
  const [selectedAgencyId, setSelectedAgencyId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  /* -- OTP & Refusal state -- */
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpErrors, setOtpErrors] = useState<Record<string, string>>({});
  const [otpSuccess, setOtpSuccess] = useState<Record<string, boolean>>({});
  const [validatingOtpId, setValidatingOtpId] = useState<string | null>(null);
  const [refusingId, setRefusingId] = useState<string | null>(null);

  async function loadPackages(dpId: string) {
    setLoadingData(true);
    try {
      const [inc, avail] = await Promise.all([
        dataService.getIncomingPackagesForDropPoint(dpId),
        dataService.getAvailablePackagesForDropPoint(dpId),
      ]);
      setIncoming(inc);
      setAvailable(avail);
      // Also refresh deposits
      const deps = dataService.getVendorDepositsForDropPoint(dpId);
      setVendorDeposits(deps);
    } finally {
      setLoadingData(false);
    }
  }

  async function loadAgencies() {
    try {
      const list = await dataService.getAgenciesForDropPoint();
      setAgencies(list);
    } catch {
      // silently fail
    }
  }

  /* -- Login is now handled by /auth/point-relais/login -- */

  /* -- Confirm reception (livreur → drop point) -- */
  async function handleConfirm(colisId: string) {
    if (!agent) return;
    setConfirmingId(colisId);
    try {
      const res = await fetch('/api/drop-points/agents/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colisId, agentId: agent.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setConfirmSuccess(colisId);
        setTimeout(() => {
          setConfirmSuccess(null);
          loadPackages(agent.dropPointId);
          setActiveTab('available');
        }, 1500);
      } else {
        alert(json.error || 'Erreur lors de la confirmation.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setConfirmingId(null);
    }
  }

  /* -- Refuse reception (livreur → drop point) -- */
  async function handleRefuse(colisId: string) {
    if (!agent || !confirm('Êtes-vous sûr de refuser ce colis ? Le livreur devra s\'en occuper.')) return;
    setRefusingId(colisId);
    try {
      const res = await fetch('/api/drop-points/agents/refuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colisId, agentId: agent.id }),
      });
      const json = await res.json();
      if (res.ok) {
        if (agent) loadPackages(agent.dropPointId);
      } else {
        alert(json.error || 'Erreur lors du refus.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setRefusingId(null);
    }
  }

  /* -- Validate OTP (client pickup) -- */
  async function handleValidateOtp(colisId: string) {
    const code = otpInputs[colisId];
    if (!code || code.length < 6) {
      setOtpErrors(prev => ({ ...prev, [colisId]: 'Veuillez saisir les 6 chiffres.' }));
      return;
    }
    setValidatingOtpId(colisId);
    setOtpErrors(prev => ({ ...prev, [colisId]: '' }));
    try {
      const res = await fetch('/api/packages/validate-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colisId, otp: code }),
      });
      const json = await res.json();
      if (res.ok) {
        setOtpSuccess(prev => ({ ...prev, [colisId]: true }));
        setTimeout(() => {
          if (agent) loadPackages(agent.dropPointId);
        }, 2000);
      } else {
        setOtpErrors(prev => ({ ...prev, [colisId]: json.error || 'Code incorrect.' }));
      }
    } catch {
      setOtpErrors(prev => ({ ...prev, [colisId]: 'Erreur réseau.' }));
    } finally {
      setValidatingOtpId(null);
    }
  }

  /* -- Create vendor deposit -- */
  async function handleDepositSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent) return;
    setDepositSubmitting(true);
    try {
      const res = await fetch('/api/drop-points/vendor-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dropPointId: agent.dropPointId,
          ...depositForm,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setDepositResult(json.deposit as VendorDeposit);
        // refresh list
        const deps = dataService.getVendorDepositsForDropPoint(agent.dropPointId);
        setVendorDeposits(deps);
        setDepositForm({ vendeurName: '', vendeurPhone: '', clientName: '', clientPhone: '', clientAddress: '', description: '' });
      } else {
        alert(json.error || 'Erreur lors de la création du dépôt.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setDepositSubmitting(false);
    }
  }

  /* -- Assign agency to vendor deposit -- */
  async function handleAssignAgency(pickupCode: string) {
    if (!selectedAgencyId) return;
    setAssignLoading(true);
    try {
      const res = await fetch('/api/drop-points/vendor-deposit/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupCode, agencyId: selectedAgencyId }),
      });
      const json = await res.json();
      if (res.ok) {
        setAssignSuccess(pickupCode);
        setAssigningDeposit(null);
        setSelectedAgencyId('');
        // refresh
        if (agent) {
          const deps = dataService.getVendorDepositsForDropPoint(agent.dropPointId);
          setVendorDeposits(deps);
        }
        setTimeout(() => setAssignSuccess(null), 3000);
      } else {
        alert(json.error || 'Erreur lors de l\'assignation.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setAssignLoading(false);
    }
  }

  /* -- Assign agency to ColisItem deposit -- */
  async function handleAssignAgencyColis(colisId: string) {
    if (!selectedAgencyId) return;
    setAssignLoading(true);
    try {
      const res = await fetch('/api/drop-points/colis-deposit/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colisId, agencyId: selectedAgencyId }),
      });
      const json = await res.json();
      if (res.ok) {
        setAssignSuccess(colisId);
        setAssigningDeposit(null);
        setSelectedAgencyId('');
        if (agent) loadPackages(agent.dropPointId);
        setTimeout(() => setAssignSuccess(null), 3000);
      } else {
        alert(json.error || 'Erreur lors de l\'assignation.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    setAgent(null);
    setIncoming([]);
    setAvailable([]);
    setVendorDeposits([]);
    setDepositResult(null);
    setShowDepositForm(false);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  const dropPointInfo = agent ? DEFAULT_DROP_POINTS.find(dp => dp.id === agent.dropPointId) : null;
  const pendingDeposits = vendorDeposits.filter(d => d.status === 'PENDING_AGENCY');
  const assignedDeposits = vendorDeposits.filter(d => d.status === 'AGENCY_ASSIGNED');
  const collectedDeposits = vendorDeposits.filter(d => d.status === 'COLLECTED');

  /* ═══════════════════════════════════════
     DASHBOARD SCREEN
  ═══════════════════════════════════════ */
  
  if (authLoading && !sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
          <p>Vérification de la session...</p>
        </div>
      </div>
    );
  }
  const tabColis = activeTab === 'incoming' ? incoming : available;

  return (
    <div style={{ minHeight: '100vh', background: '#07090e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Topbar */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={18} color="white" />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '800', fontSize: '0.95rem' }}>{agent?.dropPointName}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{agent?.dropPointCommune} · Agent : {agent?.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setShowQrModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.3rem 0.75rem', borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#4ade80', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            <QrCode size={16} /> Mon QR Code
          </button>
          <div style={{
            padding: '0.3rem 0.75rem', borderRadius: '999px',
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
            fontSize: '0.75rem', color: '#60a5fa', fontWeight: '700', fontFamily: 'monospace',
          }}>
            #{agent?.agentNumber}
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '0.5rem', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: '600' }}>
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Stats banner */}
        <div style={{
          background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
          display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <MapPin size={16} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>{dropPointInfo?.address}</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Responsable : {dropPointInfo?.managerName}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: '800', color: '#f59e0b', fontSize: '1.25rem' }}>{pendingDeposits.length}</p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>Dépôts vendeurs</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: '800', color: '#f59e0b', fontSize: '1.25rem' }}>{incoming.length}</p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>À confirmer</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: '800', color: '#22c55e', fontSize: '1.25rem' }}>{available.length}</p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>Disponibles</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '0.3rem' }}>
          {([
            { key: 'vendor_deposits', label: 'Dépôts vendeurs', count: pendingDeposits.length, color: '#f59e0b', icon: <Package size={13} /> },
            { key: 'incoming', label: 'Colis entrants', count: incoming.length, color: '#f59e0b', icon: <Truck size={13} /> },
            { key: 'available', label: 'Retrait client', count: available.length, color: '#22c55e', icon: <CheckCircle2 size={13} /> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as DashboardTab)}
              style={{
                flex: 1, padding: '0.65rem 0.5rem', borderRadius: '9px', border: 'none', cursor: 'pointer',
                background: activeTab === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : '#64748b',
                fontWeight: '700', fontSize: '0.78rem', fontFamily: 'inherit',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: tab.color, color: '#000', fontSize: '0.68rem', fontWeight: '900' }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            onClick={() => agent && loadPackages(agent.dropPointId)}
            disabled={loadingData}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontFamily: 'inherit' }}
          >
            <RefreshCw size={14} style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
        </div>

        {/* ═══════════════════════════════
            TAB: VENDOR DEPOSITS
        ═══════════════════════════════ */}
        {activeTab === 'vendor_deposits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Success notification after deposit */}
            {depositResult && (
              <div style={{
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '20px', padding: '1.5rem', textAlign: 'center',
              }}>
                <CheckCircle2 size={40} color="#22c55e" style={{ marginBottom: '0.75rem' }} />
                <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: '800', color: '#4ade80' }}>
                  Dépôt enregistré !
                </h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Code de collecte pour le livreur :
                </p>
                {/* Pickup Code — BIG display */}
                <div style={{
                  background: 'rgba(0,0,0,0.4)', border: '2px dashed rgba(34,197,94,0.5)',
                  borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1rem',
                  display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Code retrait</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '2.5rem', fontWeight: '900', letterSpacing: '6px', color: '#4ade80', textShadow: '0 0 20px rgba(74,222,128,0.4)' }}>
                    {depositResult.pickupCode}
                  </span>
                  <button
                    onClick={() => copyCode(depositResult.pickupCode)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', color: '#4ade80', fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: '700' }}
                  >
                    {copiedCode ? <><Check size={12} /> Copié !</> : <><Copy size={12} /> Copier le code</>}
                  </button>
                </div>
                <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                  Remettez ce code au livreur qui viendra collecter le colis pour la livraison.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setDepositResult(null)}
                    style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => { setDepositResult(null); setShowDepositForm(true); }}
                    style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Plus size={14} /> Nouveau dépôt
                  </button>
                </div>
              </div>
            )}

            {/* New deposit button + form */}
            {!depositResult && (
              <>
                {!showDepositForm ? (
                  <button
                    onClick={() => setShowDepositForm(true)}
                    style={{
                      width: '100%', padding: '1rem', borderRadius: '14px', border: '2px dashed rgba(34,197,94,0.4)',
                      background: 'rgba(34,197,94,0.05)', color: '#4ade80', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      fontSize: '0.95rem', fontWeight: '700', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}
                  >
                    <Plus size={18} />
                    Enregistrer un dépôt vendeur
                  </button>
                ) : (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px', padding: '1.5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                        Nouveau dépôt vendeur
                      </h3>
                      <button onClick={() => setShowDepositForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Vendor info */}
                      <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(59,130,246,0.15)' }}>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: '700', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Informations vendeur
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <label style={labelStyle}>Nom du vendeur *</label>
                            <input
                              type="text"
                              required
                              value={depositForm.vendeurName}
                              onChange={e => setDepositForm(f => ({ ...f, vendeurName: e.target.value }))}
                              placeholder="Ex : Jean Kakudi"
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Téléphone vendeur *</label>
                            <input
                              type="tel"
                              required
                              value={depositForm.vendeurPhone}
                              onChange={e => setDepositForm(f => ({ ...f, vendeurPhone: e.target.value }))}
                              placeholder="+243 8X X..."
                              style={inputStyle}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Client info */}
                      <div style={{ background: 'rgba(34,197,94,0.06)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(34,197,94,0.15)' }}>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: '700', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Informations destinataire (client)
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <label style={labelStyle}>Nom du client *</label>
                            <input
                              type="text"
                              required
                              value={depositForm.clientName}
                              onChange={e => setDepositForm(f => ({ ...f, clientName: e.target.value }))}
                              placeholder="Ex : Marie Kasonga"
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Téléphone client *</label>
                            <input
                              type="tel"
                              required
                              value={depositForm.clientPhone}
                              onChange={e => setDepositForm(f => ({ ...f, clientPhone: e.target.value }))}
                              placeholder="+243 8X X..."
                              style={inputStyle}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: '0.75rem' }}>
                          <label style={labelStyle}>Adresse de livraison *</label>
                          <input
                            type="text"
                            required
                            value={depositForm.clientAddress}
                            onChange={e => setDepositForm(f => ({ ...f, clientAddress: e.target.value }))}
                            placeholder="Ex : Av. Kabambare n°12, Kalamu"
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ marginTop: '0.75rem' }}>
                          <label style={labelStyle}>Description du colis (optionnel)</label>
                          <input
                            type="text"
                            value={depositForm.description}
                            onChange={e => setDepositForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Ex : Chaussures taille 42, vêtements..."
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={depositSubmitting}
                        style={{
                          width: '100%', padding: '0.9rem', borderRadius: '12px', border: 'none',
                          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                          color: '#fff', fontWeight: '800', fontSize: '0.95rem',
                          cursor: depositSubmitting ? 'not-allowed' : 'pointer',
                          opacity: depositSubmitting ? 0.7 : 1,
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                          boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
                        }}
                      >
                        {depositSubmitting ? 'Enregistrement...' : <><QrCode size={16} /> Enregistrer & générer le code</>}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* Deposits list */}
            {vendorDeposits.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dépôts enregistrés ({vendorDeposits.length})
                </p>
                {vendorDeposits.map(dep => (
                  <div key={dep.id} style={{
                    background: dep.status === 'COLLECTED' ? 'rgba(34,197,94,0.04)' : dep.status === 'AGENCY_ASSIGNED' ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${dep.status === 'COLLECTED' ? 'rgba(34,197,94,0.2)' : dep.status === 'AGENCY_ASSIGNED' ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.25)'}`,
                    borderRadius: '16px', padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        {/* Status + Code */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                          <span style={{
                            padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '800',
                            background: dep.status === 'COLLECTED' ? 'rgba(34,197,94,0.15)' : dep.status === 'AGENCY_ASSIGNED' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color: dep.status === 'COLLECTED' ? '#4ade80' : dep.status === 'AGENCY_ASSIGNED' ? '#60a5fa' : '#f59e0b',
                          }}>
                            {dep.status === 'COLLECTED' ? '✓ Collecté' : dep.status === 'AGENCY_ASSIGNED' ? '📦 Agence assignée' : '⏳ En attente d\'agence'}
                          </span>
                          {/* Pickup Code */}
                          <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '0.9rem', color: dep.status === 'COLLECTED' ? '#4ade80' : '#f8fafc', letterSpacing: '2px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.15rem 0.5rem' }}>
                            {dep.pickupCode}
                          </div>
                        </div>

                        {/* Vendor + Client info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          <div>
                            <p style={{ margin: '0 0 0.15rem', fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendeur</p>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#fff' }}>{dep.vendeurName}</p>
                            <a href={`tel:${dep.vendeurPhone}`} style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'none' }}>{dep.vendeurPhone}</a>
                          </div>
                          <div>
                            <p style={{ margin: '0 0 0.15rem', fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Destinataire</p>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#fff' }}>{dep.clientName}</p>
                            <a href={`tel:${dep.clientPhone}`} style={{ fontSize: '0.8rem', color: '#4ade80', textDecoration: 'none' }}>{dep.clientPhone}</a>
                          </div>
                        </div>

                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                          📍 {dep.clientAddress}
                          {dep.description && ` · ${dep.description}`}
                        </p>

                        {dep.agencyName && (
                          <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Building2 size={12} /> Agence : <strong>{dep.agencyName}</strong>
                          </p>
                        )}

                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#334155' }}>
                          <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                          {new Date(dep.createdAt).toLocaleString('fr-FR')}
                        </p>
                      </div>

                      {/* Action: assign agency */}
                      {dep.status === 'PENDING_AGENCY' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '160px' }}>
                          {assignSuccess === dep.pickupCode ? (
                            <div style={{ textAlign: 'center', padding: '0.6rem 0', color: '#4ade80', fontSize: '0.82rem', fontWeight: '700' }}>
                              <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} />
                              Agence assignée !
                            </div>
                          ) : assigningDeposit === dep.pickupCode ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <select
                                value={selectedAgencyId}
                                onChange={e => setSelectedAgencyId(e.target.value)}
                                style={{
                                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                                  borderRadius: '8px', color: '#fff', padding: '0.55rem 0.75rem',
                                  fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                                }}
                              >
                                <option value="">-- Choisir agence --</option>
                                {agencies.length > 0 ? agencies.map(ag => (
                                  <option key={ag.id} value={ag.id}>{ag.name}</option>
                                )) : (
                                  <option value="demo-agency-01">Agence Express Kin (démo)</option>
                                )}
                              </select>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => handleAssignAgency(dep.pickupCode)}
                                  disabled={!selectedAgencyId || assignLoading}
                                  style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', opacity: !selectedAgencyId ? 0.5 : 1 }}
                                >
                                  {assignLoading ? '...' : 'Confirmer'}
                                </button>
                                <button
                                  onClick={() => { setAssigningDeposit(null); setSelectedAgencyId(''); }}
                                  style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningDeposit(dep.pickupCode)}
                              style={{
                                padding: '0.6rem 0.9rem', borderRadius: '10px', border: 'none',
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem',
                                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                              }}
                            >
                              <Truck size={13} />
                              Assigner agence
                            </button>
                          )}
                        </div>
                      )}

                      {/* Show code prominently for AGENCY_ASSIGNED */}
                      {dep.status === 'AGENCY_ASSIGNED' && (
                        <div style={{ textAlign: 'center', background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.4)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                          <p style={{ margin: '0 0 0.25rem', fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code pour livreur</p>
                          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: '900', letterSpacing: '3px', color: '#60a5fa' }}>
                            {dep.pickupCode}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {vendorDeposits.length === 0 && !showDepositForm && !depositResult && (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#475569' }}>
                <Package size={36} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
                <p style={{ fontWeight: '700', margin: '0 0 0.35rem', color: '#64748b' }}>Aucun dépôt enregistré</p>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Cliquez sur le bouton ci-dessus pour enregistrer le premier dépôt vendeur.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════
            TAB: INCOMING (driver → drop point)
        ═══════════════════════════════ */}
        {(activeTab === 'incoming' || activeTab === 'available') && (
          <>
            {tabColis.length === 0 && !loadingData && (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#475569' }}>
                <Package size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
                <p style={{ fontWeight: '700', margin: '0 0 0.35rem', color: '#64748b' }}>
                  {activeTab === 'incoming' ? 'Aucun colis en attente de confirmation' : 'Aucun colis disponible au retrait'}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>
                  {activeTab === 'incoming' ? 'Les colis déposés par les livreurs apparaîtront ici.' : 'Les colis confirmés apparaîtront ici pour le retrait client.'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {tabColis.map(colis => (
                <div key={colis.id} style={{
                  background: confirmSuccess === colis.id ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${confirmSuccess === colis.id ? 'rgba(34,197,94,0.35)' : activeTab === 'incoming' ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`,
                  borderRadius: '16px', padding: '1.25rem',
                  transition: 'all 0.3s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700',
                          background: activeTab === 'incoming' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                          color: activeTab === 'incoming' ? '#f59e0b' : '#4ade80',
                        }}>
                          {activeTab === 'incoming' ? 'Dépôt à confirmer' : 'Disponible au retrait'}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>#{colis.id}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.5rem' }}>
                        <div>
                          <p style={{ margin: '0 0 0.15rem', fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendeur</p>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#fff' }}>{colis.vendeurName || 'Non spécifié'}</p>
                          {colis.vendeurPhone && (
                            <a href={`tel:${colis.vendeurPhone}`} style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'none' }}>{colis.vendeurPhone}</a>
                          )}
                        </div>
                        <div>
                          <p style={{ margin: '0 0 0.15rem', fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Destinataire</p>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#fff' }}>{colis.clientName}</p>
                          {colis.clientPhone && (
                            <a href={`tel:${colis.clientPhone}`} style={{ fontSize: '0.8rem', color: '#4ade80', textDecoration: 'none' }}>{colis.clientPhone}</a>
                          )}
                        </div>
                      </div>

                      {colis.inaccessibilityNote && (
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#fca5a5', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', padding: '0.35rem 0.6rem' }}>
                          Motif : {colis.inaccessibilityNote}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
                        <Clock size={12} /> Déposé le {colis.date}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
                      {activeTab === 'available' && (
                        <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.4)', borderRadius: '12px', padding: '1rem', width: '100%', minWidth: '220px' }}>
                          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Code OTP Client
                          </p>
                          {otpSuccess[colis.id] ? (
                            <div style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <CheckCircle2 size={16} /> Remise confirmée !
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="Numéro à 6 chiffres"
                                value={otpInputs[colis.id] || ''}
                                onChange={(e) => setOtpInputs(prev => ({ ...prev, [colis.id]: e.target.value.replace(/\D/g, '') }))}
                                maxLength={6}
                                style={{
                                  width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                                  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', fontFamily: 'monospace', letterSpacing: '2px', textAlign: 'center'
                                }}
                              />
                              {otpErrors[colis.id] && (
                                <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{otpErrors[colis.id]}</div>
                              )}
                              <button
                                onClick={() => handleValidateOtp(colis.id)}
                                disabled={validatingOtpId === colis.id}
                                style={{
                                  width: '100%', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontWeight: '700', fontSize: '0.85rem'
                                }}
                              >
                                {validatingOtpId === colis.id ? 'Validation...' : 'Valider'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'incoming' && colis.status === 'En attente de confirmation relais' && (
                        <button
                          onClick={() => handleConfirm(colis.id)}
                          disabled={confirmingId === colis.id || confirmSuccess === colis.id}
                          style={{
                            padding: '0.6rem 1.1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: confirmSuccess === colis.id ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff', fontWeight: '800', fontSize: '0.85rem', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
                            opacity: confirmingId === colis.id ? 0.6 : 1,
                            boxShadow: confirmSuccess !== colis.id ? '0 4px 14px rgba(34,197,94,0.3)' : 'none',
                          }}
                        >
                          {confirmSuccess === colis.id ? (
                            <><CheckCircle2 size={15} /> Confirmé !</>
                          ) : confirmingId === colis.id ? (
                            'Confirmation...'
                          ) : (
                            <><CheckCircle2 size={15} /> Confirmer la réception</>
                          )}
                        </button>
                      )}

                      {/* Pour les colis déposés par les livreurs à confirmer par le client */}
                      {activeTab === 'incoming' && colis.status === 'Déposé en point relais' && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                          <button
                            onClick={() => handleConfirm(colis.id)}
                            disabled={confirmingId === colis.id || confirmSuccess === colis.id || refusingId === colis.id}
                            style={{
                              padding: '0.6rem 1.1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                              background: confirmSuccess === colis.id ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                              color: '#fff', fontWeight: '800', fontSize: '0.85rem', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s',
                              opacity: confirmingId === colis.id ? 0.6 : 1,
                              boxShadow: confirmSuccess !== colis.id ? '0 4px 14px rgba(34,197,94,0.3)' : 'none',
                            }}
                          >
                            {confirmSuccess === colis.id ? (
                              <><CheckCircle2 size={15} /> Confirmé !</>
                            ) : confirmingId === colis.id ? (
                              'Confirmation...'
                            ) : (
                              <><CheckCircle2 size={15} /> Confirmer la réception</>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleRefuse(colis.id)}
                            disabled={refusingId === colis.id || confirmingId === colis.id || confirmSuccess === colis.id}
                            style={{
                              padding: '0.5rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.4)', cursor: 'pointer',
                              background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: '700', fontSize: '0.8rem', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s'
                            }}
                          >
                            {refusingId === colis.id ? 'Refus...' : 'Refuser (laisser au livreur)'}
                          </button>
                        </div>
                      )}

                      {/* Action: assign agency for ColisItem */}
                      {activeTab === 'incoming' && colis.status === 'En attente de collecte' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '160px' }}>
                          <div style={{ textAlign: 'center', background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.4)', borderRadius: '12px', padding: '0.5rem 1rem', marginBottom: '0.5rem' }}>
                            <p style={{ margin: '0 0 0.25rem', fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code pour livreur</p>
                            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: '900', letterSpacing: '3px', color: '#60a5fa' }}>
                              {colis.pickupCode}
                            </p>
                          </div>

                          {assignSuccess === colis.id ? (
                            <div style={{ textAlign: 'center', padding: '0.6rem 0', color: '#4ade80', fontSize: '0.82rem', fontWeight: '700' }}>
                              <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} />
                              Agence assignée !
                            </div>
                          ) : assigningDeposit === colis.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <select
                                value={selectedAgencyId}
                                onChange={e => setSelectedAgencyId(e.target.value)}
                                style={{
                                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                                  borderRadius: '8px', color: '#fff', padding: '0.55rem 0.75rem',
                                  fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                                }}
                              >
                                <option value="">-- Choisir agence --</option>
                                {agencies.length > 0 ? agencies.map(ag => (
                                  <option key={ag.id} value={ag.id}>{ag.name}</option>
                                )) : (
                                  <option value="demo-agency-01">Agence Express Kin (démo)</option>
                                )}
                              </select>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => handleAssignAgencyColis(colis.id)}
                                  disabled={!selectedAgencyId || assignLoading}
                                  style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', opacity: !selectedAgencyId ? 0.5 : 1 }}
                                >
                                  {assignLoading ? '...' : 'Confirmer'}
                                </button>
                                <button
                                  onClick={() => { setAssigningDeposit(null); setSelectedAgencyId(''); }}
                                  style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningDeposit(colis.id)}
                              style={{
                                padding: '0.6rem 0.9rem', borderRadius: '10px', border: 'none',
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem',
                                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                                width: '100%', justifyContent: 'center'
                              }}
                            >
                              <Truck size={13} />
                              Assigner agence
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL: Mon QR Code */}
      {showQrModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px', padding: '2rem', maxWidth: '400px', width: '100%',
            textAlign: 'center', position: 'relative'
          }}>
            <button
              onClick={() => setShowQrModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 0.5rem', color: '#fff', fontSize: '1.2rem', fontWeight: '800' }}>Votre QR Code</h3>
            <p style={{ margin: '0 0 1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Les vendeurs peuvent scanner ce QR code pour vous attribuer des colis.</p>
            
            <div style={{
              background: '#fff', padding: '2rem', borderRadius: '16px', display: 'inline-block', marginBottom: '1.5rem'
            }}>
              <QrCode size={120} color="#000" />
            </div>

            <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID Point Relais</p>
            <p style={{ margin: 0, color: '#4ade80', fontSize: '1.3rem', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '2px' }}>
              {agent?.dropPointId}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #1e293b; color: #fff; }
      `}</style>
    </div>
  );
}

// Shared inline styles
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#94a3b8', marginBottom: '0.35rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.7rem 0.9rem',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
};
