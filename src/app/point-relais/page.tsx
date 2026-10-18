'use client';

import { useState, useEffect } from 'react';
import {
  MapPin, LogOut, Package, CheckCircle2,
  Clock, AlertCircle,
  RefreshCw, Plus, QrCode, Truck, Building2,
  X, Copy, Check, Lock
} from 'lucide-react';
import Link from 'next/link';
import { ColisItem, dataService } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import { DROP_POINT_REFUSAL_REASONS } from '@/lib/package-state-machine';

type DashboardTab = 'incoming_vendor' | 'incoming_driver' | 'available' | 'vendor_deposits';

type DepositResult = { trackingCode: string; otp: string; pickupCode?: string | null; };

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
  const { formatPrice } = useCurrency();
  
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
  const [incomingVendor, setIncomingVendor] = useState<ColisItem[]>([]);
  const [incomingDriver, setIncomingDriver] = useState<ColisItem[]>([]);
  const [available, setAvailable] = useState<ColisItem[]>([]);
  const [vendorDeposits, setVendorDeposits] = useState<ColisItem[]>([]);
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
  const [depositResult, setDepositResult] = useState<DepositResult | null>(null);
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
  const [parcelToRefuse, setParcelToRefuse] = useState<ColisItem | null>(null);
  const [refusalReasonCode, setRefusalReasonCode] = useState<string>('DAMAGED_PARCEL');
  const [refusalComment, setRefusalComment] = useState<string>('');
  const [refusalSubmitting, setRefusalSubmitting] = useState(false);
  const [refusalError, setRefusalError] = useState<string | null>(null);
  const [dropPointCredits, setDropPointCredits] = useState<number | null>(null);
  const [dropPointInfo, setDropPointInfo] = useState<{ address?: string; managerName?: string } | null>(null);

  /* -- Handover to Driver state -- */
  const [driverPickupCode, setDriverPickupCode] = useState('');
  const [handoverLoading, setHandoverLoading] = useState(false);

  async function loadPackages(dpId: string) {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/drop-points/${dpId}/dashboard`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setIncomingVendor(data.incomingVendor ?? []);
        setIncomingDriver(data.incomingDriver ?? []);
        setAvailable(data.available ?? []);
        setVendorDeposits(data.vendorDeposits ?? []);
        if (data.dropPoint) {
          setDropPointCredits(data.dropPoint.credits);
          setDropPointInfo({ address: data.dropPoint.address, managerName: data.dropPoint.managerName });
        }
      }
    } catch (e) {
      console.error('Erreur chargement dashboard:', e);
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

  /* -- Confirm reception -- */
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
        setTimeout(async () => {
          setConfirmSuccess(null);
          await loadPackages(agent.dropPointId); // aussi recharge les crédits
          // Rediriger selon le type de colis confirmé
          if (json.type === 'vendor') {
            setActiveTab('vendor_deposits');
          } else {
            setActiveTab('available');
          }
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

  /* -- Refusal Modal & Execution (livreur → drop point) -- */
  function openRefusalModal(colis: ColisItem) {
    setParcelToRefuse(colis);
    setRefusalReasonCode('DAMAGED_PARCEL');
    setRefusalComment('');
    setRefusalError(null);
  }

  async function handleConfirmRefusal(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !parcelToRefuse) return;

    setRefusalSubmitting(true);
    setRefusalError(null);
    try {
      const res = await fetch('/api/drop-points/agents/refuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colisId: parcelToRefuse.id,
          refusalReasonCode,
          comment: refusalComment.trim() || undefined,
          dropPointId: agent.dropPointId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setParcelToRefuse(null);
        await loadPackages(agent.dropPointId);
      } else {
        setRefusalError(json.error || 'Erreur lors du refus.');
      }
    } catch {
      setRefusalError('Erreur réseau lors de la communication avec le serveur.');
    } finally {
      setRefusalSubmitting(false);
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
      // Route correcte : /api/packages/[id]/validate-otp
      const res = await fetch(`/api/packages/${colisId}/validate-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: code }),
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
        const pkg: ColisItem = json.deposit;
        setDepositResult({
          trackingCode: pkg.trackingCode,
          otp: pkg.otp,
          pickupCode: pkg.pickupCode,
        });
        // Rafraîchir la liste depuis la BDD
        await loadPackages(agent.dropPointId);
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

  /* -- Handover package to Driver -- */
  async function handleHandoverPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !driverPickupCode) return;
    setHandoverLoading(true);
    try {
      const res = await fetch('/api/drop-points/agents/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupCode: driverPickupCode, dropPointId: agent.dropPointId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('Colis remis avec succès au livreur.');
        setDriverPickupCode('');
        await loadPackages(agent.dropPointId);
      } else {
        alert(json.error || 'Code invalide ou colis introuvable.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setHandoverLoading(false);
    }
  }

  /* -- Assign agency to vendor deposit (uses colisId, not pickupCode) -- */
  async function handleAssignAgency(colisId: string) {
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
        if (agent) await loadPackages(agent.dropPointId);
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

  /* -- Assign agency to ColisItem deposit (alias) -- */
  async function handleAssignAgencyColis(colisId: string) {
    return handleAssignAgency(colisId);
  }

  async function handleLogout() {
    await logout();
    setAgent(null);
    setIncomingVendor([]);
    setIncomingDriver([]);
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


  // Pour ColisItem, on considère tous les dépôts vendeurs comme "en attente d'agence"
  const pendingDeposits = vendorDeposits.filter(d => !d.agencyId);
  const assignedDeposits = vendorDeposits.filter(d => !!d.agencyId);

  /* ═══════════════════════════════════════
     DASHBOARD SCREEN
  ═══════════════════════════════════════ */
  
  if (authLoading && !sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><Lock size={40} color="#94a3b8" /></div>
          <p>Vérification de la session...</p>
        </div>
      </div>
    );
  }
  const tabColis = activeTab === 'incoming_vendor' ? incomingVendor : activeTab === 'incoming_driver' ? incomingDriver : available;

  const bottomNavTabs = [
    { key: 'vendor_deposits' as DashboardTab, icon: Package, label: 'Dépôts', count: pendingDeposits.length },
    { key: 'incoming_vendor' as DashboardTab, icon: Truck, label: 'Entrants', count: incomingVendor.length + incomingDriver.length },
    { key: 'available' as DashboardTab, icon: CheckCircle2, label: 'Retrait', count: available.length },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#07090e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Topbar Mobile-First */}
      <header style={{
        background: 'rgba(7, 9, 14, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 40,
        padding: '0.75rem 1rem',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
        }}>
          {/* Drop Point Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <MapPin size={18} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                margin: 0, fontWeight: '800', fontSize: '0.9rem', color: '#fff',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {agent?.dropPointName}
              </div>
              <div style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                {agent?.dropPointCommune} &bull; #{agent?.agentNumber}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            <button
              onClick={() => setShowQrModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.45rem 0.65rem', borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#4ade80', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              <QrCode size={15} />
              <span>QR Code</span>
            </button>

            <button
              onClick={handleLogout}
              aria-label="Déconnexion"
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '10px', padding: '0.45rem', cursor: 'pointer',
                color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '1rem 0.9rem 6rem' }}>

        {/* Compact Mobile Stats Strip */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px', padding: '0.85rem', marginBottom: '1.25rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem'
        }}>
          {dropPointInfo?.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <MapPin size={13} color="#3b82f6" />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {dropPointInfo.address}
              </span>
            </div>
          )}

          {/* 4 Equal Responsive Counters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
            <div style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '10px', padding: '0.5rem 0.2rem', textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontWeight: '900', color: dropPointCredits !== null ? (dropPointCredits > 10 ? '#3b82f6' : (dropPointCredits > 0 ? '#f59e0b' : '#ef4444')) : '#94a3b8', fontSize: '1.15rem' }}>
                {dropPointCredits !== null ? dropPointCredits : '-'}
              </p>
              <p style={{ margin: 0, fontSize: '0.62rem', color: '#93c5fd', fontWeight: '600' }}>Crédits</p>
            </div>

            <div style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '10px', padding: '0.5rem 0.2rem', textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontWeight: '900', color: '#f59e0b', fontSize: '1.15rem' }}>{pendingDeposits.length}</p>
              <p style={{ margin: 0, fontSize: '0.62rem', color: '#fcd34d', fontWeight: '600' }}>Dépôts</p>
            </div>

            <div style={{
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: '10px', padding: '0.5rem 0.2rem', textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontWeight: '900', color: '#c084fc', fontSize: '1.15rem' }}>{incomingVendor.length + incomingDriver.length}</p>
              <p style={{ margin: 0, fontSize: '0.62rem', color: '#d8b4fe', fontWeight: '600' }}>À conf.</p>
            </div>

            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '10px', padding: '0.5rem 0.2rem', textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontWeight: '900', color: '#4ade80', fontSize: '1.15rem' }}>{available.length}</p>
              <p style={{ margin: 0, fontSize: '0.62rem', color: '#86efac', fontWeight: '600' }}>Dispos</p>
            </div>
          </div>
        </div>

        {/* Banner for credits */}
        {dropPointCredits !== null && dropPointCredits <= 10 && (
          <div style={{
            background: dropPointCredits === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${dropPointCredits === 0 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
          }}>
            <AlertCircle size={20} color={dropPointCredits === 0 ? '#ef4444' : '#f59e0b'} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem', color: dropPointCredits === 0 ? '#ef4444' : '#f59e0b', fontSize: '0.95rem' }}>
                {dropPointCredits === 0 ? 'Crédits épuisés' : 'Crédits faibles'}
              </h4>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.4 }}>
                {dropPointCredits === 0 
                  ? "Vous n'avez plus de crédits (0). Vous ne pouvez plus recevoir de colis. Contactez l'administrateur pour recharger votre compte." 
                  : `Il ne vous reste que ${dropPointCredits} crédit(s). Pensez à recharger votre compte prochainement.`}
              </p>
            </div>
          </div>
        )}

        {/* Section title */}
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
            {activeTab === 'vendor_deposits' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Package size={16} /> Dépôts vendeurs</span>}
            {activeTab === 'incoming_vendor' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Truck size={16} /> Colis entrants (vendeur)</span>}
            {activeTab === 'incoming_driver' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Truck size={16} /> Colis entrants (livreur)</span>}
            {activeTab === 'available' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle2 size={16} /> Retrait client</span>}
          </h2>
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
                    onClick={() => copyCode(depositResult.pickupCode ?? depositResult.trackingCode)}
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
                    onClick={() => {
                      if (dropPointCredits === 0) {
                        alert("Impossible d'enregistrer un dépôt : crédits épuisés.");
                        return;
                      }
                      setShowDepositForm(true);
                    }}
                    style={{
                      width: '100%', padding: '1rem', borderRadius: '14px', border: dropPointCredits === 0 ? '2px dashed rgba(239,68,68,0.4)' : '2px dashed rgba(34,197,94,0.4)',
                      background: dropPointCredits === 0 ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)', color: dropPointCredits === 0 ? '#ef4444' : '#4ade80', cursor: dropPointCredits === 0 ? 'not-allowed' : 'pointer',
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

            {/* BARRE DE RECHERCHE POUR REMISE AU LIVREUR */}
            <div style={{
              background: 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '1rem',
              marginTop: '1rem'
            }}>
              <h3 style={{ margin: '0 0 0.5rem', color: '#4ade80', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={18} /> Remettre un colis à un livreur
              </h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                Tapez le code fourni par le livreur pour valider le départ du colis (ex: MCL-...).
              </p>
              <form onSubmit={handleHandoverPackage} style={{ display: 'flex', gap: '0.75rem' }}>
                <input 
                  type="text"
                  placeholder="Code de collecte (ex: MCL-ABC12)"
                  value={driverPickupCode}
                  onChange={e => setDriverPickupCode(e.target.value.toUpperCase())}
                  required
                  style={{
                    flex: 1, padding: '0.75rem 1rem', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                    color: '#fff', fontSize: '0.95rem', fontFamily: 'monospace', letterSpacing: '1px'
                  }}
                />
                {/* Submit button hidden because we use the button on the package card now, but keep form submit for Enter key */}
                <button type="submit" disabled={!driverPickupCode || handoverLoading} style={{ display: 'none' }}>
                  Remettre
                </button>
              </form>
            </div>

            {/* Deposits list */}
            {vendorDeposits.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dépôts enregistrés ({vendorDeposits.length})
                </p>
                {[...vendorDeposits].sort((a, b) => {
                  const aMatch = driverPickupCode && (a.pickupCode === driverPickupCode || a.trackingCode === driverPickupCode);
                  const bMatch = driverPickupCode && (b.pickupCode === driverPickupCode || b.trackingCode === driverPickupCode);
                  if (aMatch && !bMatch) return -1;
                  if (!aMatch && bMatch) return 1;
                  return 0;
                }).map(dep => {
                  const isMatch = driverPickupCode && (dep.pickupCode === driverPickupCode || dep.trackingCode === driverPickupCode);
                  return (
                  <div key={dep.id} style={{
                    background: isMatch ? 'rgba(34,197,94,0.1)' : !!dep.agencyId ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
                    border: isMatch ? '2px solid rgba(34,197,94,0.6)' : `1px solid ${dep.agencyId ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.25)'}`,
                    borderRadius: '16px', padding: '1.25rem',
                    transition: 'all 0.3s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        {/* Status + Code */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                          <span style={{
                            padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '800',
                            background: dep.agencyId ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color: dep.agencyId ? '#60a5fa' : '#f59e0b',
                          }}>
                            {dep.agencyId ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Package size={12} /> Agence assignée</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={12} /> En attente d'agence</span>}
                          </span>
                          {/* Pickup Code or Tracking Code */}
                          <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '0.9rem', color: '#f8fafc', letterSpacing: '2px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.15rem 0.5rem' }}>
                            {dep.pickupCode || dep.trackingCode}
                          </div>
                        </div>

                        {/* Vendor + Client info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          <div>
                            <p style={{ margin: '0 0 0.15rem', fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendeur</p>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#fff' }}>{dep.vendeurName || 'Non renseigné'}</p>
                            {dep.vendeurPhone && <a href={`tel:${dep.vendeurPhone}`} style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'none' }}>{dep.vendeurPhone}</a>}
                          </div>
                          <div>
                            <p style={{ margin: '0 0 0.15rem', fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Destinataire</p>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#fff' }}>{dep.clientName}</p>
                            <a href={`tel:${dep.clientPhone}`} style={{ fontSize: '0.8rem', color: '#4ade80', textDecoration: 'none' }}>{dep.clientPhone}</a>
                          </div>
                        </div>

                          <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={12} /> {dep.clientAddress}
                          </p>

                        {dep.agence && (
                          <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Building2 size={12} /> Agence : <strong>{dep.agence}</strong>
                          </p>
                        )}

                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#334155' }}>
                          <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                          {dep.date}
                        </p>
                      </div>

                      {/* Action: assign agency */}
                      {!dep.agencyId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '160px' }}>
                          {assignSuccess === dep.id ? (
                            <div style={{ textAlign: 'center', padding: '0.6rem 0', color: '#4ade80', fontSize: '0.82rem', fontWeight: '700' }}>
                              <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} />
                              Agence assignée !
                            </div>
                          ) : assigningDeposit === dep.id ? (
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
                                  onClick={() => handleAssignAgency(dep.id)}
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
                              onClick={() => setAssigningDeposit(dep.id)}
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

                      {/* Show otp (pickup code) for agency-assigned */}
                      {dep.agencyId && (
                        <div style={{ textAlign: 'center', background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.4)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                          <p style={{ margin: '0 0 0.25rem', fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code pour livreur</p>
                          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: '900', letterSpacing: '3px', color: '#60a5fa' }}>
                            {dep.pickupCode || dep.trackingCode}
                          </p>
                        </div>
                      )}
                      {isMatch && (
                        <div style={{ marginTop: '0.75rem', width: '100%' }}>
                          <button
                            onClick={() => handleHandoverPackage({ preventDefault: () => {} } as React.FormEvent)}
                            disabled={handoverLoading}
                            style={{
                              width: '100%', padding: '0.8rem', borderRadius: '12px', border: 'none',
                              background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
                              fontWeight: '800', fontSize: '0.95rem', cursor: handoverLoading ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                              boxShadow: '0 4px 14px rgba(34,197,94,0.3)'
                            }}
                          >
                            <CheckCircle2 size={18} /> {handoverLoading ? 'Validation...' : 'Confirmer la remise au livreur'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )})}
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
        {(activeTab.startsWith('incoming') || activeTab === 'available') && (
          <>
            {tabColis.length === 0 && !loadingData && (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#475569' }}>
                <Package size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
                <p style={{ fontWeight: '700', margin: '0 0 0.35rem', color: '#64748b' }}>
                  {activeTab.startsWith('incoming') ? 'Aucun colis en attente de confirmation' : 'Aucun colis disponible au retrait'}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>
                  {activeTab.startsWith('incoming') ? 'Les colis déposés apparaîtront ici.' : 'Les colis confirmés apparaîtront ici pour le retrait client.'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {tabColis.map(colis => (
                <div key={colis.id} style={{
                  background: confirmSuccess === colis.id ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${confirmSuccess === colis.id ? 'rgba(34,197,94,0.35)' : activeTab.startsWith('incoming') ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`,
                  borderRadius: '16px', padding: '1.25rem',
                  transition: 'all 0.3s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700',
                          background: activeTab.startsWith('incoming') ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                          color: activeTab.startsWith('incoming') ? '#f59e0b' : '#4ade80',
                        }}>
                          {activeTab.startsWith('incoming') ? 'Dépôt à confirmer' : 'Disponible au retrait'}
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
                          {colis.claimStatus === 'OPEN' || (colis.status as string) === 'IN_DISPUTE' || colis.status === 'En réclamation' ? (
                            <div style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              borderRadius: '8px',
                              padding: '0.65rem 0.8rem',
                              color: '#fca5a5',
                              fontSize: '0.78rem',
                              lineHeight: 1.4
                            }}>
                              <div style={{ fontWeight: '700', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <AlertCircle size={14} color="#ef4444" />
                                Réclamation en cours
                              </div>
                              Retrait bloqué jusqu'à résolution par le Super Admin ({colis.claimReason || 'Litige vendeur'}).
                            </div>
                          ) : otpSuccess[colis.id] ? (
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
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                style={{
                                  width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                                  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', fontFamily: 'monospace', letterSpacing: '2px', textAlign: 'center', boxSizing: 'border-box'
                                }}
                              />
                              {otpErrors[colis.id] && (
                                <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{otpErrors[colis.id]}</div>
                              )}
                              <button
                                onClick={() => handleValidateOtp(colis.id)}
                                disabled={validatingOtpId === colis.id}
                                style={{
                                  width: '100%', minHeight: '44px', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontWeight: '700', fontSize: '0.85rem'
                                }}
                              >
                                {validatingOtpId === colis.id ? 'Validation...' : 'Valider'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'incoming_vendor' && colis.status === 'En attente de confirmation relais' && (
                        <button
                          onClick={() => handleConfirm(colis.id)}
                          disabled={confirmingId === colis.id || confirmSuccess === colis.id}
                          style={{
                            padding: '0.6rem 1.1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: confirmSuccess === colis.id ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff', fontWeight: '800', fontSize: '0.85rem', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
                            opacity: confirmingId === colis.id ? 0.6 : 1,
                            minHeight: '44px',
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

                      {/* Pour les colis déposés par les livreurs à confirmer par le point relais */}
                      {activeTab === 'incoming_driver' && colis.status === 'Déposé en point relais' && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                          <button
                            onClick={() => handleConfirm(colis.id)}
                            disabled={confirmingId === colis.id || confirmSuccess === colis.id}
                            style={{
                              padding: '0.6rem 1.1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                              background: confirmSuccess === colis.id ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                              color: '#fff', fontWeight: '800', fontSize: '0.85rem', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s',
                              opacity: confirmingId === colis.id ? 0.6 : 1,
                              minHeight: '44px',
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
                            onClick={() => openRefusalModal(colis)}
                            disabled={confirmingId === colis.id || confirmSuccess === colis.id}
                            style={{
                              padding: '0.5rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.4)', cursor: 'pointer',
                              background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: '700', fontSize: '0.8rem', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s',
                              minHeight: '44px'
                            }}
                          >
                            Refuser (laisser au livreur)
                          </button>
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

      {/* ── Bottom Navigation Bar (Mobile-First) ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, width: '100%',
        background: 'rgba(7, 9, 14, 0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0.65rem 0', paddingBottom: 'calc(0.65rem + env(safe-area-inset-bottom))',
        zIndex: 50
      }}>
        {bottomNavTabs.map(tab => {
          const isActive = activeTab === tab.key ||
            (tab.key === 'incoming_vendor' && activeTab === 'incoming_driver');
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, background: 'none', border: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                cursor: 'pointer', color: isActive ? '#3b82f6' : '#64748b',
                transition: 'color 0.2s', padding: '0.25rem',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={22} color={isActive ? '#3b82f6' : '#64748b'} />
                {tab.count > 0 && (
                  <span style={{
                    position: 'absolute', top: '-5px', right: '-9px',
                    background: tab.key === 'available' ? '#22c55e' : '#f59e0b',
                    color: '#000', fontSize: '0.62rem',
                    fontWeight: '900', width: '16px', height: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%'
                  }}>
                    {tab.count}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.63rem', fontWeight: isActive ? '800' : '600' }}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Refresh button */}
        <button
          onClick={() => agent && loadPackages(agent.dropPointId)}
          disabled={loadingData}
          style={{
            flex: 1, background: 'none', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
            cursor: loadingData ? 'not-allowed' : 'pointer',
            color: '#64748b', padding: '0.25rem',
          }}
        >
          <RefreshCw size={22} color="#64748b" style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }} />
          <span style={{ fontSize: '0.63rem', fontWeight: '600' }}>Sync</span>
        </button>
      </nav>

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

      {/* MODAL: Refus de prise en charge colis */}
      {parcelToRefuse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh',
          background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '24px', padding: '1.75rem', maxWidth: '440px', width: '100%',
            position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            maxHeight: '90dvh', overflowY: 'auto'
          }}>
            <button
              onClick={() => { setParcelToRefuse(null); setRefusalError(null); }}
              aria-label="Fermer"
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444'
              }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: '800' }}>
                  Refuser la réception
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  #{parcelToRefuse.id} &bull; {parcelToRefuse.clientName}
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 1.25rem', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.45 }}>
              Le colis sera marqué comme <strong>refusé au point relais</strong> et restera entre les mains du livreur pour retour ou réacheminement.
            </p>

            <form onSubmit={handleConfirmRefusal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Motif obligatoire de refus</label>
                <select
                  value={refusalReasonCode}
                  onChange={(e) => setRefusalReasonCode(e.target.value)}
                  style={{
                    ...inputStyle,
                    minHeight: '48px',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    background: '#1e293b'
                  }}
                  required
                >
                  {DROP_POINT_REFUSAL_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Commentaire complémentaire (optionnel)</label>
                <textarea
                  value={refusalComment}
                  onChange={(e) => setRefusalComment(e.target.value)}
                  placeholder="Détails visibles par le livreur et le vendeur (ex: carton écrasé, fuite de liquide...)"
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'none',
                    fontSize: '0.9rem',
                    lineHeight: 1.4
                  }}
                />
              </div>

              {refusalError && (
                <div style={{
                  padding: '0.75rem 0.9rem', borderRadius: '10px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5', fontSize: '0.85rem'
                }}>
                  {refusalError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setParcelToRefuse(null); setRefusalError(null); }}
                  disabled={refusalSubmitting}
                  style={{
                    flex: 1, minHeight: '48px', padding: '0.75rem', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                    color: '#94a3b8', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit'
                  }}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={refusalSubmitting}
                  style={{
                    flex: 1.5, minHeight: '48px', padding: '0.75rem', borderRadius: '12px',
                    border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff', fontWeight: '800', cursor: refusalSubmitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.4)', opacity: refusalSubmitting ? 0.7 : 1
                  }}
                >
                  {refusalSubmitting ? 'Enregistrement...' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #1e293b; color: #fff; }
        nav button:active { opacity: 0.7; transform: scale(0.93); }
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
