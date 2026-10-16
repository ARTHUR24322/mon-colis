'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  ShieldCheck,
  CheckCircle2,
  Phone,
  MapPin,
  ArrowLeft,
  Lock,
  User,
  Package,
  LogOut,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  Info,
  DollarSign,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  QrCode,
  Building2,
  RefreshCw,
  X
} from 'lucide-react';
import { dataService, ColisItem, DriverAccount, DEFAULT_DROP_POINTS, DropPoint } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';

export default function LivreurPage() {
  const { user, loading: authLoading, sessionChecked, logout } = useAuth();
  const { formatPrice } = useCurrency();
  
  const [driver, setDriver] = useState<DriverAccount | null>(null);

  // Auto-login if session exists
  useEffect(() => {
    if (sessionChecked && user?.role === 'livreur') {
      const d = {
        id: user.driverId || user.id,
        name: user.name,
        phone: user.phone || '',
        pinCode: '',
        vehicle: '',
        agencyId: user.agencyId || 'ag-1',
        agencyName: 'Agence',
        available: true,
        deliveries: 0,
        rating: 5,
        joinedDate: ''
      };
      setDriver(d);
      loadCourses(d);
    }
  }, [user, sessionChecked]);

  // Realtime updates
  useEffect(() => {
    let unsubscribe: () => void;
    if (driver) {
      unsubscribe = dataService.subscribeToPackages(() => {
        loadCourses(driver);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [driver]);

  // Dashboard state
  const [courses, setCourses] = useState<ColisItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpErrors, setOtpErrors] = useState<Record<string, string>>({});
  const [otpSuccess, setOtpSuccess] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'to_collect' | 'deposited' | 'to_deliver' | 'delivered'>('to_collect');

  // Drop Point rerouting state (zone inaccessible)
  const [rerouteModalColis, setRerouteModalColis] = useState<ColisItem | null>(null);
  const [agentNumberInput, setAgentNumberInput] = useState('');
  const [verifiedAgent, setVerifiedAgent] = useState<{ name: string; dropPointName: string; dropPointId: string; agentNumber: string } | null>(null);
  const [verifyingAgent, setVerifyingAgent] = useState(false);
  const [agentVerifyError, setAgentVerifyError] = useState('');
  const [rerouteReason, setRerouteReason] = useState('Route impraticable / inondée');
  const [customReason, setCustomReason] = useState('');
  const [rerouteLoading, setRerouteLoading] = useState(false);
  const [rerouteToast, setRerouteToast] = useState<string | null>(null);

  // Cash request states
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [cashLoading, setCashLoading] = useState(false);
  const [cashRequests, setCashRequests] = useState<Array<{ id: string; amount: number; status: string; note: string | null; reject_reason: string | null; created_at: string }>>([]);
  const [cashRequestsLoading, setCashRequestsLoading] = useState(false);
  const [cashSuccess, setCashSuccess] = useState<string | null>(null);

  // QR Deposit states
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<{ requestId: string; qrToken: string; amount: number; expiresAt: string } | null>(null);
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const [qrPollingInterval, setQrPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const handleOpenRerouteModal = (colis: ColisItem) => {
    setRerouteModalColis(colis);
    setAgentNumberInput('');
    setVerifiedAgent(null);
    setAgentVerifyError('');
    setRerouteReason('Route impraticable / inondée');
    setCustomReason('');
  };

  const handleVerifyAgent = async () => {
    if (agentNumberInput.length !== 9) return;
    setVerifyingAgent(true);
    setAgentVerifyError('');
    setVerifiedAgent(null);
    try {
      const res = await fetch('/api/drop-points/agents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentNumber: agentNumberInput }),
      });
      const json = await res.json();
      if (res.ok && json.agent) {
        setVerifiedAgent({
          name: json.agent.name,
          dropPointName: json.agent.dropPointName,
          dropPointId: json.agent.dropPointId,
          agentNumber: json.agent.agentNumber,
        });
      } else {
        setAgentVerifyError(json.error || 'Numéro agent introuvable.');
      }
    } catch {
      setAgentVerifyError('Erreur réseau. Réessayez.');
    } finally {
      setVerifyingAgent(false);
    }
  };

  const handleConfirmReroute = async () => {
    if (!rerouteModalColis || !verifiedAgent || !driver) return;
    setRerouteLoading(true);
    const note = rerouteReason === 'Autre motif' ? (customReason || 'Zone inaccessible') : rerouteReason;
    const res = await dataService.assignColisToDropPoint(rerouteModalColis.id, verifiedAgent.agentNumber, driver.id);
    if (res.success) {
      // Also record inaccessibility note in cache
      await dataService.rerouteToDropPoint(rerouteModalColis.id, verifiedAgent.dropPointId, note);
      setRerouteToast(`Colis #${rerouteModalColis.id.substring(0, 8)} déposé au ${verifiedAgent.dropPointName} — agent notifié !`);
      await loadCourses();
      setTimeout(() => {
        setRerouteModalColis(null);
        setRerouteToast(null);
      }, 2000);
    }
    setRerouteLoading(false);
  };

  /* --- Load Deliveries for this Driver --- */
  const loadCourses = async (d?: DriverAccount) => {
    const driverInfo = d || driver;
    if (!driverInfo) return;
    setCoursesLoading(true);
    try {
      const res = await fetch(`/api/livreur/${driverInfo.id}/dashboard?name=${encodeURIComponent(driverInfo.name)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setCourses(json.courses || []);
      }
    } catch (e) {
      console.error('Failed to load courses', e);
    } finally {
      setCoursesLoading(false);
    }
  };

  /* --- Load Cash Requests --- */
  const loadCashRequests = async () => {
    setCashRequestsLoading(true);
    try {
      const res = await fetch('/api/livreur/cash-request');
      const json = await res.json();
      if (res.ok) setCashRequests(json.requests || []);
    } catch (e) {
      console.error('Failed to load cash requests', e);
    } finally {
      setCashRequestsLoading(false);
    }
  };

  /* --- Collect a vendor deposit from Drop Point (Cas A: livreur → relais → livreur) --- */
  const handleCollectDeposit = async (colisId: string) => {
    const res = await dataService.markVendorDepositCollected(colisId);
    if (res.success) {
      setRerouteToast('Colis collecté au point relais. Il est maintenant en transit.');
      await loadCourses();
      setTimeout(() => setRerouteToast(null), 3000);
    } else {
      alert(res.message || 'Erreur lors de la collecte.');
    }
  };

  /* --- OTP Validation --- */
  const handleValidateOtp = async (colisId: string) => {
    const code = otpInputs[colisId] || '';
    if (code.length < 6) {
      setOtpErrors(prev => ({ ...prev, [colisId]: 'Le code OTP doit contenir 6 chiffres.' }));
      return;
    }

    const res = await dataService.validateDeliveryOtp(colisId, code);
    if (res.success) {
      setOtpSuccess(prev => ({ ...prev, [colisId]: true }));
      setOtpErrors(prev => ({ ...prev, [colisId]: '' }));
      await loadCourses();
    } else {
      setOtpErrors(prev => ({ ...prev, [colisId]: res.message }));
    }
  };

  /* --- Generate QR Deposit token --- */
  const handleGenerateDepositQr = async () => {
    if (!driver || cashCollected <= 0) return;
    setQrLoading(true);
    setQrConfirmed(false);
    setQrData(null);
    try {
      const res = await fetch('/api/livreur/deposit-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cashCollected }),
      });
      const json = await res.json();
      if (res.ok && json.qrToken) {
        setQrData({
          requestId: json.requestId,
          qrToken: json.qrToken,
          amount: json.amount,
          expiresAt: json.expiresAt,
        });
        // Polling pour détecter confirmation agence
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch('/api/livreur/deposit-qr');
            const pollJson = await pollRes.json();
            if (!pollJson.pending) {
              // Plus de demande PENDING → confirmé !
              setQrConfirmed(true);
              clearInterval(interval);
              // Recharger les courses pour mettre à jour le solde
              await loadCourses();
            }
          } catch {
            // Ignorer les erreurs de polling
          }
        }, 4000);
        setQrPollingInterval(interval);
      } else {
        alert(json.error || 'Erreur lors de la génération du QR.');
      }
    } catch {
      alert('Erreur réseau. Réessayez.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleCloseQrModal = () => {
    setShowQrModal(false);
    setQrData(null);
    setQrConfirmed(false);
    if (qrPollingInterval) {
      clearInterval(qrPollingInterval);
      setQrPollingInterval(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setDriver(null);
    setCourses([]);
  };

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

  const toCollectCourses = courses.filter(c => c.status === 'En attente de collecte' || (c.deliveryMode === 'DROP_POINT_FIRST_MILE' && (c.status === 'Créé' || c.status === 'Accepté')));
  const depositedCourses = courses.filter(c => c.status === 'Déposé en point relais' || c.status === 'Disponible au point relais' || c.status === 'En attente de confirmation relais');
  const toDeliverCourses = courses.filter(c => c.status !== 'Livré' && c.status !== 'Annulé' && !['En attente de collecte', 'Déposé en point relais', 'Disponible au point relais', 'En attente de confirmation relais'].includes(c.status) && !(c.deliveryMode === 'DROP_POINT_FIRST_MILE' && (c.status === 'Créé' || c.status === 'Accepté')));
  const deliveredCourses = courses.filter(c => c.status === 'Livré');

  const getActiveList = () => {
    switch (activeTab) {
      case 'to_collect': return toCollectCourses;
      case 'deposited': return depositedCourses;
      case 'to_deliver': return toDeliverCourses;
      case 'delivered': return deliveredCourses;
      default: return [];
    }
  };

  const activeList = getActiveList();
  
  // Keep these for the info banner stats
  const activeCourses = courses.filter(c => c.status !== 'Livré' && c.status !== 'Annulé');
  const doneCourses = deliveredCourses;

  // Cash total collecté = somme des prix colis livrés (cash à remettre à l'agence)
  const cashCollected = deliveredCourses.reduce((sum, c) => sum + (c.prixColis || 0) + (!c.paidByClient ? (c.prixLivraison || 0) : 0), 0);

  // Agency phone for WhatsApp (from driver info)
  const agencyWhatsApp = driver?.agencyId ? `https://wa.me/?text=${encodeURIComponent(`Bonjour, je suis ${driver.name} (livreur), je voudrais discuter de mon versement.`)}` : null;

  /* ═══════════════════════════════════════════════════════════
     DASHBOARD
  ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{
      minHeight: '100vh',
      background: '#07090e',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* -- Header Mobile-First -- */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        backdropFilter: 'blur(16px)',
        background: 'rgba(7, 9, 14, 0.92)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.75rem 1rem'
      }}>
        <div style={{ margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Truck size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#fff' }}>{driver?.name}</div>
              <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: '600' }}>
                Livreur &bull; {driver?.agencyName}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px', padding: '0.4rem 0.6rem',
              color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer'
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* -- Main Content -- */}
      <div style={{ maxWidth: '720px', margin: '0 auto', width: '100%', padding: '1.25rem 1rem 6rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Mobile-Optimized Driver Summary Strip */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          {/* Driver Name & Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                Bonjour, {driver?.name?.split(' ')[0]} 👋
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                {driver?.vehicle || 'Moto'} &bull; {driver?.agencyName || 'Agence'}
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.25rem 0.65rem', borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ade80', fontSize: '0.72rem', fontWeight: '700'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              En service
            </div>
          </div>

          {/* Quick Metrics Row (3 compact pills) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px', padding: '0.6rem 0.4rem', textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#60a5fa' }}>{activeCourses.length}</div>
              <div style={{ fontSize: '0.68rem', color: '#93c5fd', fontWeight: '600' }}>À livrer</div>
            </div>

            <div style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '12px', padding: '0.6rem 0.4rem', textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#4ade80' }}>{doneCourses.length}</div>
              <div style={{ fontSize: '0.68rem', color: '#86efac', fontWeight: '600' }}>Livrées</div>
            </div>

            <div 
              onClick={() => {
                if (cashCollected > 0) {
                  setShowQrModal(true);
                  handleGenerateDepositQr();
                }
              }}
              style={{
                background: cashCollected > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: cashCollected > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px', padding: '0.6rem 0.4rem', textAlign: 'center',
                cursor: cashCollected > 0 ? 'pointer' : 'default'
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: '900', color: cashCollected > 0 ? '#fbbf24' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cashCollected > 0 ? formatPrice(cashCollected) : '0'}
              </div>
              <div style={{ fontSize: '0.68rem', color: cashCollected > 0 ? '#fcd34d' : '#64748b', fontWeight: '600' }}>
                {cashCollected > 0 ? 'À déposer' : 'Caisse'}
              </div>
            </div>
          </div>

          {/* Quick Cash Remise Action (Only if cashCollected > 0) */}
          {cashCollected > 0 && (
            <button
              onClick={() => { setShowQrModal(true); handleGenerateDepositQr(); }}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#000', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
              }}
            >
              <QrCode size={18} />
              Déposer le cash à l'agence ({formatPrice(cashCollected)})
            </button>
          )}
        </div>

        {/* Courses List */}
        {coursesLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            Chargement de vos courses...
          </div>
        ) : activeList.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: '16px'
          }}>
            <Package size={40} color="#64748b" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: '#fff', fontWeight: '700', margin: '0 0 0.5rem' }}>
              Aucune course dans cette catégorie
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeList.map(c => (
              <DeliveryCard
                key={c.id}
                colis={c}
                isDone={c.status === 'Livré'}
                otpValue={otpInputs[c.id] || ''}
                onOtpChange={(val) => setOtpInputs(prev => ({ ...prev, [c.id]: val }))}
                onValidate={() => handleValidateOtp(c.id)}
                onOpenReroute={() => handleOpenRerouteModal(c)}
                onCollect={() => handleCollectDeposit(c.id)}
                error={otpErrors[c.id]}
                success={otpSuccess[c.id]}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        )}

        {/* Toast Notification */}
        {rerouteToast && (
          <div style={{
            position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', padding: '0.85rem 1.5rem', borderRadius: '14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: '700', fontSize: '0.9rem'
          }}>
            <CheckCircle2 size={18} />
            <span>{rerouteToast}</span>
          </div>
        )}

        {/* -- Modal Redirection Point Relais (Zone Inaccessible) -- */}
        {rerouteModalColis && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 999, padding: '1rem'
          }}>
            <div style={{
              width: '100%', maxWidth: '480px',
              background: '#0d1117', border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '24px', padding: '1.75rem',
              display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0
                }}>
                  <MapPin size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>
                    Déposer en Point Relais
                  </h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                    Zone inaccessible · Colis #{rerouteModalColis.id.substring(0, 8)}
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '12px', padding: '0.85rem', fontSize: '0.8rem', color: '#fde047', lineHeight: 1.5
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>Le colis sera déposé en sécurité au Point Relais. Le client <strong>{rerouteModalColis.clientName}</strong> pourra aller le récupérer avec son code secret OTP.</span>
              </div>
              </div>

              {/* Agent Number Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Numéro à 9 chiffres de l'agent du point relais :
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="• • • • • • • • •"
                    value={agentNumberInput}
                    disabled={rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais'}
                    onChange={e => {
                      setAgentNumberInput(e.target.value.replace(/\D/g, ''));
                      setVerifiedAgent(null);
                      setAgentVerifyError('');
                    }}
                    style={{
                      flex: 1, padding: '0.75rem 0.85rem', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${verifiedAgent ? 'rgba(34,197,94,0.5)' : agentVerifyError ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.3)'}`,
                      color: (rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais') ? '#64748b' : '#fff', 
                      fontSize: '1.1rem', letterSpacing: '4px',
                      fontFamily: 'monospace', fontWeight: '700',
                      cursor: (rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais') ? 'not-allowed' : 'text'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyAgent}
                    disabled={agentNumberInput.length !== 9 || verifyingAgent || rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais'}
                    style={{
                      padding: '0.75rem 1.1rem', borderRadius: '10px', border: 'none',
                      background: verifiedAgent ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)',
                      color: verifiedAgent ? '#4ade80' : '#60a5fa',
                      fontWeight: '700', fontSize: '0.82rem', cursor: (rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais') ? 'not-allowed' : 'pointer',
                      opacity: (agentNumberInput.length !== 9 || rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais') ? 0.5 : 1, fontFamily: 'inherit',
                    }}
                  >
                    {verifyingAgent ? '...' : verifiedAgent ? 'Vérifié ' : 'Vérifier'}
                  </button>
                </div>

                {agentVerifyError && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#fca5a5' }}>{agentVerifyError}</p>
                )}

                {verifiedAgent && (
                  <div style={{
                    marginTop: '0.6rem', padding: '0.65rem 0.85rem', borderRadius: '10px',
                    background: 'rgba(34,197,94,0.09)', border: '1px solid rgba(34,197,94,0.3)',
                    fontSize: '0.82rem', color: '#4ade80',
                  }}>
                    <strong>Agent :</strong> {verifiedAgent.name}<br />
                    <strong>Point Relais :</strong> {verifiedAgent.dropPointName}
                  </div>
                )}
              </div>

              {/* Inaccessibility Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Motif d'inaccessibilité de l'adresse :
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {[
                    'Route impraticable / inondée',
                    'Quartier enclavé / hors piste praticable',
                    'Client absent / injoignable après plusieurs appels',
                    'Autre motif'
                  ].map(motif => (
                    <label key={motif} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.45rem 0.65rem', borderRadius: '8px',
                      background: rerouteReason === motif ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      cursor: 'pointer', fontSize: '0.82rem', color: '#fff'
                    }}>
                      <input
                        type="radio"
                        name="rerouteReason"
                        checked={rerouteReason === motif}
                        onChange={() => setRerouteReason(motif)}
                        style={{ accentColor: '#f59e0b' }}
                      />
                      {motif}
                    </label>
                  ))}
                </div>

                {rerouteReason === 'Autre motif' && (
                  <input
                    type="text"
                    placeholder="Précisez la situation..."
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    style={{
                      marginTop: '0.5rem', width: '100%', padding: '0.65rem',
                      borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem'
                    }}
                  />
                )}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRerouteModalColis(null)}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'transparent', color: '#cbd5e1',
                    fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  disabled={rerouteLoading || !verifiedAgent || rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais'}
                  onClick={handleConfirmReroute}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px',
                    border: 'none',
                    background: (verifiedAgent && rerouteModalColis.status !== 'Déposé en point relais' && rerouteModalColis.status !== 'En attente de confirmation relais') ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.08)',
                    color: (verifiedAgent && rerouteModalColis.status !== 'Déposé en point relais' && rerouteModalColis.status !== 'En attente de confirmation relais') ? '#000' : '#475569',
                    fontSize: '0.88rem', fontWeight: '800',
                    cursor: (rerouteLoading || !verifiedAgent || rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais') ? 'not-allowed' : 'pointer',
                    boxShadow: (verifiedAgent && rerouteModalColis.status !== 'Déposé en point relais' && rerouteModalColis.status !== 'En attente de confirmation relais') ? '0 4px 14px rgba(245, 158, 11, 0.4)' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  {(rerouteModalColis.status === 'Déposé en point relais' || rerouteModalColis.status === 'En attente de confirmation relais') ? 'Déjà Déposé' : rerouteLoading ? 'Enregistrement...' : 'Confirmer le Dépôt'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL : QR Code de Dépôt
      ══════════════════════════════════════════════════════ */}
      {showQrModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, padding: '1rem'
        }}>
          <div style={{
            width: '100%', maxWidth: '400px',
            background: '#0d1117',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: '28px', padding: '1.75rem',
            display: 'flex', flexDirection: 'column', gap: '1.25rem',
            boxShadow: '0 30px 70px rgba(0,0,0,0.8)',
            position: 'relative'
          }}>
            {/* Close button */}
            <button
              onClick={handleCloseQrModal}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'rgba(255,255,255,0.08)', border: 'none',
                borderRadius: '8px', padding: '0.4rem',
                color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingRight: '2rem' }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '14px',
                background: 'rgba(245,158,11,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <QrCode size={24} color="#fbbf24" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>
                  Dépôt à l'agence
                </h2>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Présentez ce QR code à votre agence
                </p>
              </div>
            </div>

            {/* Contenu selon état */}
            {qrLoading ? (
              /* Chargement */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                <div style={{
                  width: '60px', height: '60px', border: '3px solid rgba(245,158,11,0.2)',
                  borderTopColor: '#f59e0b', borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>Génération du QR code...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : qrConfirmed ? (
              /* Confirmé ! */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem 0' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: 'rgba(34,197,94,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(34,197,94,0.4)'
                }}>
                  <CheckCircle2 size={40} color="#22c55e" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#4ade80', marginBottom: '0.35rem' }}>
                    Dépôt confirmé !
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#86efac' }}>
                    L'agence a confirmé la réception de
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#4ade80', margin: '0.3rem 0' }}>
                    {qrData?.amount.toLocaleString('fr-FR')} CDF
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Votre solde a été remis à zéro.
                  </div>
                </div>
                <button
                  onClick={handleCloseQrModal}
                  style={{
                    padding: '0.75rem 2rem', borderRadius: '999px', border: 'none',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#000', fontWeight: '700', fontSize: '0.9rem',
                    cursor: 'pointer', fontFamily: 'inherit'
                  }}
                >
                  Fermer
                </button>
              </div>
            ) : qrData ? (
              /* QR Code affiché */
              <>
                {/* Montant */}
                <div style={{
                  textAlign: 'center',
                  padding: '0.85rem',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '14px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                    Montant à remettre
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '900', color: '#fbbf24' }}>
                    {qrData.amount.toLocaleString('fr-FR')} CDF
                  </div>
                </div>

                {/* QR Image */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
                }}>
                  <div style={{
                    padding: '1rem',
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
                  }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qrToken)}&bgcolor=ffffff&color=000000&margin=1`}
                      alt="QR Code dépôt"
                      width={200}
                      height={200}
                      style={{ display: 'block', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                    Code valide jusqu'à{' '}
                    <span style={{ color: '#fbbf24', fontWeight: '600' }}>
                      {new Date(qrData.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Instructions */}
                <div style={{
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '12px', padding: '0.85rem',
                  fontSize: '0.8rem', color: '#93c5fd', lineHeight: 1.5
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <Info size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      Présentez ce QR code à l'agent de votre agence.
                      Une fois scanné et confirmé, votre solde sera automatiquement remis à zéro.
                    </span>
                  </div>
                </div>

                {/* Refresh button */}
                <button
                  onClick={handleGenerateDepositQr}
                  disabled={qrLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.6rem', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: '#64748b',
                    fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  <RefreshCw size={14} /> Régénérer le QR
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* -- Bottom Navigation Bar (Mobile-First) -- */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, width: '100%',
        background: 'rgba(7, 9, 14, 0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0.75rem 0', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        zIndex: 50
      }}>
        {[
          { key: 'to_collect', icon: Package, label: 'Collecte', count: toCollectCourses.length },
          { key: 'deposited', icon: ShieldCheck, label: 'Déposés', count: depositedCourses.length },
          { key: 'to_deliver', icon: Truck, label: 'Livraison', count: toDeliverCourses.length },
          { key: 'delivered', icon: CheckCircle2, label: 'Livrés', count: deliveredCourses.length }
        ].map(tab => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '0.25rem', cursor: 'pointer',
                color: isActive ? '#3b82f6' : '#64748b', transition: 'color 0.2s'
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={22} color={isActive ? '#3b82f6' : '#64748b'} />
                {tab.count > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-8px',
                    background: '#ef4444', color: '#fff', fontSize: '0.65rem',
                    fontWeight: '800', width: '16px', height: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%'
                  }}>
                    {tab.count}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: isActive ? '700' : '600' }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* -- Modal: Demande de versement ----------------------------------- */}
      {showCashModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '480px', background: '#0f1117', borderRadius: '24px 24px 0 0', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} color="#4ade80" /> Demande de versement
              </h2>
              <button onClick={() => { setShowCashModal(false); setCashSuccess(null); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {cashSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <CheckCircle size={48} color="#4ade80" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ color: '#4ade80', fontWeight: '700', fontSize: '1rem', margin: 0 }}>{cashSuccess}</p>
                <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.4rem' }}>L'agence recevra votre demande et vous contactera.</p>
                <button onClick={() => { setShowCashModal(false); setCashSuccess(null); }} style={{ marginTop: '1.25rem', padding: '0.65rem 2rem', borderRadius: '9999px', border: 'none', background: '#22c55e', color: '#000', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Montant à récupérer (CDF)</label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)}
                    placeholder="Ex: 45000"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)', color: '#fff', fontSize: '1.2rem', fontWeight: '700', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Message pour l'agence (optionnel)</label>
                  <textarea
                    value={cashNote}
                    onChange={e => setCashNote(e.target.value)}
                    placeholder="Ex: Cash pour 12 livraisons cette semaine..."
                    rows={2}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {cashRequestsLoading ? (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>Chargement...</p>
                ) : cashRequests.length > 0 && (
                  <div style={{ marginBottom: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem', fontWeight: '600' }}>HISTORIQUE</p>
                    {cashRequests.slice(0, 4).map(r => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: '#fff', fontWeight: '600' }}>{r.amount.toLocaleString('fr-FR')} CDF</span>
                          <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                          {r.reject_reason && <div style={{ color: '#f87171', fontSize: '0.72rem' }}>Motif : {r.reject_reason}</div>}
                        </div>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: '600', fontSize: '0.72rem', background: r.status === 'PAID' ? 'rgba(34,197,94,0.15)' : r.status === 'REJECTED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: r.status === 'PAID' ? '#4ade80' : r.status === 'REJECTED' ? '#f87171' : '#fbbf24' }}>
                          {r.status === 'PAID' ? 'Versé ✓' : r.status === 'REJECTED' ? 'Refusé ✗' : 'En attente ⏳'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setShowCashModal(false)} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                  <button
                    disabled={cashLoading || !cashAmount || Number(cashAmount) <= 0}
                    onClick={async () => {
                      setCashLoading(true);
                      try {
                        const res = await fetch('/api/livreur/cash-request', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ amount: Number(cashAmount), note: cashNote || undefined }),
                        });
                        const json = await res.json();
                        if (res.ok) {
                          setCashSuccess(`Demande de ${Number(cashAmount).toLocaleString('fr-FR')} CDF envoyée !`);
                          loadCashRequests();
                        } else {
                          alert(json.error || 'Erreur.');
                        }
                      } catch { alert('Erreur réseau.'); }
                      finally { setCashLoading(false); }
                    }}
                    style={{ flex: 2, padding: '0.7rem', borderRadius: '10px', border: 'none', background: Number(cashAmount) > 0 ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.08)', color: Number(cashAmount) > 0 ? '#000' : '#64748b', fontWeight: '700', cursor: Number(cashAmount) > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                    <Send size={15} /> {cashLoading ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

/* ---------------------------------------------
   Delivery Card Component
--------------------------------------------- */
function DeliveryCard({
  colis,
  isDone,
  otpValue,
  onOtpChange,
  onValidate,
  onOpenReroute,
  onCollect,
  error,
  success,
  formatPrice
}: {
  colis: ColisItem;
  isDone: boolean;
  otpValue: string;
  onOtpChange: (val: string) => void;
  onValidate: () => void;
  onOpenReroute?: () => void;
  onCollect?: () => void;
  error?: string;
  success?: boolean;
  formatPrice: (priceInUsd: number) => string;
}) {
  return (
    <div style={{
      background: isDone ? 'rgba(34, 197, 94, 0.04)' : 'rgba(37, 99, 235, 0.04)',
      border: isDone ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(59, 130, 246, 0.2)',
      borderRadius: '20px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>{colis.clientName}</div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            Colis #{colis.id} · {colis.date}
          </div>
        </div>
        <span style={{
          padding: '0.25rem 0.65rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: '700',
          background: isDone ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          color: isDone ? '#4ade80' : '#60a5fa',
          border: isDone ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
          flexShrink: 0
        }}>
          {isDone ? 'Livré' : colis.status}
        </span>
      </div>

      {/* Itinéraire : Collecte → Livraison */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        
        {/* Colis Collecte : adresse de l'agence / boutique */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
          padding: '0.75rem', background: 'rgba(59, 130, 246, 0.06)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '12px'
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Package size={14} color="#60a5fa" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              COLLECTE (récupérer ici)
            </div>
            {colis.deliveryMode === 'DROP_POINT_FIRST_MILE' ? (
              <>
                <div style={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: '600' }}>
                  {colis.originDropPoint ? colis.originDropPoint.name : 'Point Relais (en attente info)'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  {colis.originDropPoint ? colis.originDropPoint.address : 'Adresse du point relais'}
                </div>
                {!isDone && colis.pickupCode && (
                  <div style={{ marginTop: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px', border: '1px dashed rgba(59, 130, 246, 0.4)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#93c5fd', marginBottom: '0.1rem' }}>Code de retrait :</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#60a5fa', letterSpacing: '2px' }}>
                      {colis.pickupCode}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: '600' }}>
                  {colis.vendeurName || colis.agence || 'Boutique vendeur'}
                </div>
                {colis.vendeurPhone && (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                    Tél : {colis.vendeurPhone}
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Collecte directe
                </div>
                {!isDone && colis.pickupCode && (
                  <div style={{ marginTop: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px', border: '1px dashed rgba(59, 130, 246, 0.4)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#93c5fd', marginBottom: '0.1rem' }}>Code de retrait :</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#60a5fa', letterSpacing: '2px' }}>
                      {colis.pickupCode}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Flèche de direction */}
        <div style={{ textAlign: 'center', color: '#475569', fontSize: '1rem' }}>↓</div>

        {/* Suivi Livraison : adresse du client */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.65rem',
          padding: '0.85rem', background: 'rgba(34, 197, 94, 0.05)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <MapPin size={14} color="#4ade80" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', color: '#4ade80', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                LIVRAISON DESTINATAIRE
              </div>
              <div style={{ fontSize: '0.92rem', color: '#fff', fontWeight: '700', marginTop: '0.15rem' }}>
                {colis.clientName}
              </div>
              <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginTop: '0.1rem' }}>
                {colis.clientAddress}
              </div>
            </div>
          </div>

          {/* 1-Tap Mobile Action Buttons for Couriers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
            <a
              href={`tel:${colis.clientPhone}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                padding: '0.6rem 0.75rem', borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#4ade80', fontSize: '0.82rem', fontWeight: '700', textDecoration: 'none'
              }}
            >
              <Phone size={14} />
              Appeler
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(colis.clientAddress + ' Kinshasa')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                padding: '0.6rem 0.75rem', borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.35)',
                color: '#60a5fa', fontSize: '0.82rem', fontWeight: '700', textDecoration: 'none'
              }}
            >
              <MapPin size={14} />
              Itinéraire
            </a>
          </div>
        </div>
      </div>

      {/* Amount to collect from client */}
      {(() => {
        const marchandise = colis.isPrepaid ? 0 : colis.prixColis;
        const livraison = colis.paidByClient ? (colis.prixLivraison || 0) : 0;
        const total = marchandise + livraison;
        return (
          <div style={{
            padding: '0.85rem 1rem',
            background: total === 0 ? 'rgba(34,197,94,0.06)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${total === 0 ? 'rgba(34,197,94,0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
            borderRadius: '10px'
          }}>
            <div style={{ fontSize: '0.72rem', color: total === 0 ? '#86efac' : '#fcd34d', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
              Montant a encaisser du client
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: total === 0 ? '#4ade80' : '#fbbf24' }}>
              {total === 0 ? 'Rien (tout est prépayé)' : formatPrice(total)}
            </div>
            {total > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                {!colis.isPrepaid && `Marchandise: ${formatPrice(colis.prixColis)}`}
                {!colis.isPrepaid && livraison > 0 && ' + '}
                {livraison > 0 && `Livraison: ${formatPrice(livraison)}`}
              </div>
            )}
          </div>
        );
      })()}

      {/* Point Relais Redirection Details (if rerouted) */}
      {(colis.destDropPoint || colis.status === 'Disponible au point relais') && (
        <div style={{
          padding: '0.9rem 1rem',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontSize: '0.84rem'
        }}>
          <div style={{ color: '#34d399', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={16} />
            <span>Déposé au Point Relais (Zone inaccessible)</span>
          </div>
          <div style={{ color: '#fff', fontWeight: '700' }}>
            {colis.destDropPoint ? `${colis.destDropPoint.name} — ${colis.destDropPoint.commune}` : 'Point Relais du secteur client'}
          </div>
          {colis.destDropPoint && (
            <div style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>
            <div style={{ color: '#cbd5e1', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <MapPin size={12} /> {colis.destDropPoint.address} · <Phone size={12} /> {colis.destDropPoint.phone}
            </div>
            </div>
          )}
          {colis.inaccessibilityNote && (
            <div style={{ color: '#fcd34d', fontSize: '0.75rem', marginTop: '0.15rem' }}>
              Motif : {colis.inaccessibilityNote}
            </div>
          )}
          <div style={{ color: '#86efac', fontSize: '0.75rem', marginTop: '0.15rem' }}>
            Le destinataire est notifié pour le retrait sur présentation de son code secret OTP.
          </div>
        </div>
      )}

      {/* Collect button — for packages waiting at drop point for agency pickup */}
      {!isDone && colis.status === 'En attente de collecte' && onCollect && (
        <button
          type="button"
          onClick={onCollect}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none',
            color: '#fff',
            fontSize: '0.88rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
          }}
        >
          <Package size={16} />
          J'ai collecté ce colis au relais
        </button>
      )}

      {/* Button to reroute to Drop Point if zone is inaccessible */}
      {!isDone && colis.status !== 'Disponible au point relais' && colis.status !== 'En attente de collecte' && onOpenReroute && (
        <button
          type="button"
          onClick={onOpenReroute}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <MapPin size={16} />
          Zone Inaccessible ? Déposer en Point Relais
        </button>
      )}

      {/* OTP Section — only for active deliveries that are picked up (En transit) */}
      {!isDone && colis.status === 'En transit' && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Validation Livraison (Code OTP Client)
            </span>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0' }}>
              Demandez le code à 6 chiffres au client au moment de la remise en main propre.
            </p>
          </div>

          {success ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.85rem', background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '10px'
            }}>
              <CheckCircle2 size={22} color="#22c55e" />
              <div>
                <div style={{ fontWeight: '700', color: '#4ade80', fontSize: '0.9rem' }}>Livraison Confirmée !</div>
                <div style={{ fontSize: '0.78rem', color: '#86efac' }}>Le colis a bien été remis au destinataire.</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpValue}
                  onChange={e => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: error ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '1.4rem',
                    fontWeight: '900',
                    letterSpacing: '6px',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={onValidate}
                  disabled={otpValue.length < 6}
                  style={{
                    padding: '0.75rem 1.1rem',
                    borderRadius: '10px',
                    background: otpValue.length >= 6 ? '#22c55e' : 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    color: otpValue.length >= 6 ? '#000' : '#64748b',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: otpValue.length >= 6 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <ShieldCheck size={16} />
                  Valider
                </button>
              </div>

              {error && (
                <div style={{ fontSize: '0.8rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* For done deliveries — show when it was delivered */}
      {isDone && colis.deliveredAt && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.8rem', color: '#4ade80',
          padding: '0.5rem 0.75rem', background: 'rgba(34, 197, 94, 0.08)',
          borderRadius: '8px'
        }}>
          <CheckCircle2 size={14} />
          Livré le {new Date(colis.deliveredAt).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </div>
      )}
    </div>
  );
}
