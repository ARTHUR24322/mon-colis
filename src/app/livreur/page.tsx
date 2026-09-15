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
  AlertCircle
} from 'lucide-react';
import { dataService, ColisItem, DriverAccount, DEFAULT_DROP_POINTS, DropPoint } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';

export default function LivreurPage() {
  const { user, loading: authLoading, sessionChecked, logout } = useAuth();
  
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
  const [activeTab, setActiveTab] = useState<'active' | 'done'>('active');

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
    const all = await dataService.getPackagesForDriver(driverInfo.id);
    // Also try by name if no ID match
    if (all.length === 0) {
      const byName = await dataService.getPackagesForDriver(driverInfo.name);
      setCourses(byName);
    } else {
      setCourses(all);
    }
    setCoursesLoading(false);
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

  const handleLogout = async () => {
    await logout();
    setDriver(null);
    setCourses([]);
  };

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

  const activeCourses = courses.filter(c => c.status !== 'Livré' && c.status !== 'Annulé');
  const doneCourses = courses.filter(c => c.status === 'Livré');

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

      {/* -- Header -- */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        backdropFilter: 'blur(16px)',
        background: 'rgba(7, 9, 14, 0.92)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.75rem 1.25rem'
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Truck size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#fff' }}>{driver?.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: '600' }}>
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
              borderRadius: '8px', padding: '0.45rem 0.85rem',
              color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
            }}
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </header>

      {/* -- Main Content -- */}
      <div style={{ maxWidth: '720px', margin: '0 auto', width: '100%', padding: '1.25rem 1rem 6rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Driver Info Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(59, 130, 246, 0.1))',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderRadius: '20px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', margin: 0 }}>
              Bonjour, {driver?.name?.split(' ')[0]} 👋
            </h1>
            <p style={{ color: '#93c5fd', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
              {driver?.vehicle} · {activeCourses.length} course(s) active(s) en attente
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{
              textAlign: 'center',
              padding: '0.65rem 1rem',
              background: 'rgba(255, 255, 255, 0.07)',
              borderRadius: '12px'
            }}>
              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#60a5fa' }}>{activeCourses.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#93c5fd' }}>À livrer</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '0.65rem 1rem',
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(34, 197, 94, 0.2)'
            }}>
              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#4ade80' }}>{doneCourses.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#86efac' }}>Livrées</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.35rem',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.07)'
        }}>
          {[
            { key: 'active' as const, label: `En cours (${activeCourses.length})` },
            { key: 'done' as const, label: `Livrées (${doneCourses.length})` }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                padding: '0.55rem',
                borderRadius: '9px',
                border: 'none',
                background: activeTab === t.key ? '#2563eb' : 'transparent',
                color: activeTab === t.key ? '#fff' : '#94a3b8',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Courses List */}
        {coursesLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            Chargement de vos courses...
          </div>
        ) : (activeTab === 'active' ? activeCourses : doneCourses).length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: '16px'
          }}>
            <Package size={40} color="#64748b" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: '#fff', fontWeight: '700', margin: '0 0 0.5rem' }}>
              {activeTab === 'active' ? 'Aucune course active pour le moment' : 'Pas encore de livraisons effectuées'}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              {activeTab === 'active'
                ? 'Votre agence vous assignera des colis dès leur réception.'
                : 'Vos livraisons validées apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(activeTab === 'active' ? activeCourses : doneCourses).map(c => (
              <DeliveryCard
                key={c.id}
                colis={c}
                isDone={activeTab === 'done'}
                otpValue={otpInputs[c.id] || ''}
                onOtpChange={(val) => setOtpInputs(prev => ({ ...prev, [c.id]: val }))}
                onValidate={() => handleValidateOtp(c.id)}
                onOpenReroute={() => handleOpenRerouteModal(c)}
                error={otpErrors[c.id]}
                success={otpSuccess[c.id]}
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
                ℹ️ Le colis sera déposé en sécurité au Point Relais. Le client <strong>{rerouteModalColis.clientName}</strong> pourra aller le récupérer avec son code secret OTP.
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
                    {verifyingAgent ? '...' : verifiedAgent ? 'Vérifié ✓' : 'Vérifier'}
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
  error,
  success
}: {
  colis: ColisItem;
  isDone: boolean;
  otpValue: string;
  onOtpChange: (val: string) => void;
  onValidate: () => void;
  onOpenReroute?: () => void;
  error?: string;
  success?: boolean;
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
        
        {/* 📦 Collecte : adresse de l'agence / boutique */}
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
            <div style={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: '600' }}>
              {colis.agence || 'Boutique vendeur'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.1rem' }}>
              Agence de livraison partenaire
            </div>
          </div>
        </div>

        {/* Flèche de direction */}
        <div style={{ textAlign: 'center', color: '#475569', fontSize: '1rem' }}>↓</div>

        {/* 📍 Livraison : adresse du client */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
          padding: '0.75rem', background: 'rgba(34, 197, 94, 0.05)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '12px'
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'rgba(34, 197, 94, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <MapPin size={14} color="#4ade80" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              LIVRAISON (destination finale)
            </div>
            <div style={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: '600' }}>
              {colis.clientAddress}
            </div>
            <a href={`tel:${colis.clientPhone}`} style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
              <Phone size={12} />
              {colis.clientPhone} · {colis.clientName}
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
              {total === 0 ? 'Rien (tout est prepaye)' : `$${total.toFixed(2)} USD`}
            </div>
            {total > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                {!colis.isPrepaid && `Marchandise: $${colis.prixColis}`}
                {!colis.isPrepaid && livraison > 0 && ' + '}
                {livraison > 0 && `Livraison: $${livraison.toFixed(2)}`}
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
              📍 {colis.destDropPoint.address} · 📞 {colis.destDropPoint.phone}
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

      {/* Button to reroute to Drop Point if zone is inaccessible */}
      {!isDone && colis.status !== 'Disponible au point relais' && onOpenReroute && (
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

      {/* OTP Section — only for active deliveries */}
      {!isDone && colis.status !== 'Déposé en point relais' && colis.status !== 'Disponible au point relais' && (
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
