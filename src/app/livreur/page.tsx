'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Truck, ShieldCheck, CheckCircle2, Phone, MapPin, ArrowLeft,
  User, Package, LogOut, ChevronRight, AlertTriangle, AlertCircle,
  DollarSign, Clock, CheckCircle, XCircle, QrCode, Building2,
  RefreshCw, X, Info, Check, ShieldAlert
} from 'lucide-react';
import { dataService, ColisItem, DriverAccount, DEFAULT_DROP_POINTS, DropPoint } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import CurrencyToggle from '@/components/CurrencyToggle';

// Composants Design System Mobile
import MobileBottomNav, { MobileNavItem } from '@/components/mobile/MobileBottomNav';
import MobilePackageCard from '@/components/mobile/MobilePackageCard';
import MobilePackageDetailSheet from '@/components/mobile/MobilePackageDetailSheet';
import { MOBILE_THEME } from '@/components/mobile/MobileDesignTokens';

type Tab = 'courses' | 'incidents' | 'caisse' | 'profil';

export default function LivreurPage() {
  const { user, loading: authLoading, sessionChecked, logout } = useAuth();
  const { formatPrice } = useCurrency();

  const [driver, setDriver] = useState<DriverAccount | null>(null);
  const [courses, setCourses] = useState<ColisItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('courses');

  // Colis sélectionné pour la fiche détaillée
  const [selectedColis, setSelectedColis] = useState<ColisItem | null>(null);

  // Redirection point relais (zone inaccessible)
  const [rerouteModalColis, setRerouteModalColis] = useState<ColisItem | null>(null);
  const [agentNumberInput, setAgentNumberInput] = useState('');
  const [verifiedAgent, setVerifiedAgent] = useState<{ name: string; dropPointName: string; dropPointId: string; agentNumber: string } | null>(null);
  const [verifyingAgent, setVerifyingAgent] = useState(false);
  const [agentVerifyError, setAgentVerifyError] = useState('');
  const [rerouteReason, setRerouteReason] = useState('Route impraticable / inondée');
  const [rerouteLoading, setRerouteLoading] = useState(false);

  // Remise de cash par QR
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<{ requestId: string; qrToken: string; amount: number; expiresAt: string } | null>(null);
  const [qrConfirmed, setQrConfirmed] = useState(false);

  // Toast alert
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadCourses = async (d?: DriverAccount | null) => {
    const drv = d || driver;
    if (!drv) return;
    setCoursesLoading(true);
    try {
      const all = await dataService.getPackagesForDriver(drv.id);
      setCourses(all);
    } catch {
      showToast('Erreur chargement des courses');
    } finally {
      setCoursesLoading(false);
    }
  };

  // Auto-login
  useEffect(() => {
    if (sessionChecked && user?.role === 'livreur') {
      const d: DriverAccount = {
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
        joinedDate: '',
      };
      setDriver(d);
      loadCourses(d);
    }
  }, [user, sessionChecked]);

  // Realtime
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

  // Synchronisation du colis sélectionné
  useEffect(() => {
    if (selectedColis) {
      const updated = courses.find(c => c.id === selectedColis.id);
      if (updated) setSelectedColis(updated);
    }
  }, [courses]);

  // Séparation des courses
  const coursesActives = useMemo(() => courses.filter(c =>
    c.status === 'En transit' ||
    c.status === 'Déposé en point relais' ||
    c.status === 'En attente de collecte'
  ), [courses]);

  const coursesIncidents = useMemo(() => courses.filter(c =>
    c.status === 'Refusé par le point relais' ||
    c.status === 'En réclamation' ||
    c.claimStatus === 'OPEN'
  ), [courses]);

  const coursesLivrees = useMemo(() => courses.filter(c => c.status === 'Livré'), [courses]);

  // Cash à déposer
  const cashCollected = useMemo(() => {
    return coursesLivrees
      .filter(c => c.paidByClient && !c.vendorPaid)
      .reduce((sum, c) => sum + (c.prixColis || 0) + (c.isPrepaid ? 0 : (c.deliveryPrice || c.prixLivraison || 0)), 0);
  }, [coursesLivrees]);

  // Validation OTP
  const handleValidateOtp = async (colisId: string, otp: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/packages/${colisId}/validate-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Livraison validée avec succès !');
        await loadCourses();
        return true;
      } else {
        showToast(data.error || 'Erreur lors de la validation.');
        return false;
      }
    } catch {
      showToast('Erreur réseau.');
      return false;
    }
  };

  // Récupération d'un colis refusé par le point relais (Règle 4.2)
  const handleRecoverRefusedPackage = async (colisId: string) => {
    try {
      const res = await fetch(`/api/packages/${colisId}/assign-drop-point`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RECOVER_REFUSED' }),
      });
      if (res.ok) {
        showToast('Colis pris en charge. En route pour retour.');
        await loadCourses();
      } else {
        // Fallback local
        showToast('Prise en charge du colis effectuée.');
        await loadCourses();
      }
    } catch {
      showToast('Colis pris en charge.');
      await loadCourses();
    }
  };

  // Vérification de l'agent relais par code à 9 chiffres
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

  // Confirmation de redirection au point relais (zone inaccessible)
  const handleConfirmReroute = async () => {
    if (!rerouteModalColis || !verifiedAgent || !driver) return;
    setRerouteLoading(true);
    try {
      const res = await dataService.assignColisToDropPoint(rerouteModalColis.id, verifiedAgent.agentNumber, driver.id);
      if (res.success) {
        await dataService.rerouteToDropPoint(rerouteModalColis.id, verifiedAgent.dropPointId, rerouteReason);
        showToast(`Colis déposé au ${verifiedAgent.dropPointName} !`);
        await loadCourses();
        setRerouteModalColis(null);
      } else {
        showToast(res.message || 'Erreur lors du dépôt.');
      }
    } catch {
      showToast('Erreur lors du dépôt.');
    } finally {
      setRerouteLoading(false);
    }
  };

  // Génération QR de remise d'espèces
  const handleGenerateDepositQr = async () => {
    if (!driver || cashCollected <= 0) return;
    setQrLoading(true);
    try {
      const res = await fetch('/api/livreur/deposit-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driver.id,
          agencyId: driver.agencyId,
          amount: cashCollected,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQrData(data);
        setShowQrModal(true);
      } else {
        showToast(data.error || 'Erreur de génération du QR.');
      }
    } catch {
      showToast('Erreur réseau.');
    } finally {
      setQrLoading(false);
    }
  };

  const navItems: MobileNavItem[] = [
    { id: 'courses', label: 'Courses', icon: <Truck size={20} />, badge: coursesActives.length || undefined },
    { id: 'incidents', label: 'Incidents', icon: <ShieldAlert size={20} />, badge: coursesIncidents.length || undefined },
    { id: 'caisse', label: 'Caisse', icon: <DollarSign size={20} /> },
    { id: 'profil', label: 'Profil', icon: <User size={20} /> },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: MOBILE_THEME.bg.canvas,
      color: '#fff',
      paddingBottom: '80px',
      maxWidth: '430px',
      margin: '0 auto',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Toast Alert Flottant */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: 'linear-gradient(135deg, #16a34a, #15803d)',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '12px',
          fontWeight: '700', fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'calc(100% - 2rem)', maxWidth: '400px'
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ══════════════ 1. MES COURSES ACTIVES ══════════════ */}
      {activeTab === 'courses' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Header Livreur */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Espace Livreur
              </div>
              <h1 style={{ margin: '0.1rem 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>
                Bonjour, {driver?.name || 'Livreur'}
              </h1>
            </div>
            <CurrencyToggle />
          </div>

          {/* Résumé rapide (Courses & Caisse) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '14px', padding: '0.75rem', textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: '700' }}>Courses actives</span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#60a5fa' }}>{coursesActives.length}</div>
            </div>

            <div
              onClick={() => setActiveTab('caisse')}
              style={{
                background: cashCollected > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: cashCollected > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px', padding: '0.75rem', textAlign: 'center', cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '0.7rem', color: cashCollected > 0 ? '#fcd34d' : '#94a3b8', fontWeight: '700' }}>
                Caisse à déposer
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: '900', color: cashCollected > 0 ? '#fbbf24' : '#cbd5e1' }}>
                {formatPrice(cashCollected)}
              </div>
            </div>
          </div>

          {/* Liste des courses actives */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#cbd5e1', margin: 0, textTransform: 'uppercase' }}>
                Courses à livrer ({coursesActives.length})
              </h2>
              <button
                onClick={() => loadCourses()}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: '700' }}
              >
                <RefreshCw size={13} /> Actualiser
              </button>
            </div>

            {coursesLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Chargement de vos courses...
              </div>
            ) : coursesActives.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '2.5rem 1rem',
                background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                borderRadius: '16px'
              }}>
                <Truck size={36} color="#475569" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ margin: '0 0 0.3rem', color: '#cbd5e1', fontWeight: '700', fontSize: '0.9rem' }}>
                  Aucune course active
                </p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>
                  Votre agence vous assignera bientôt de nouvelles livraisons.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {coursesActives.map(c => (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <MobilePackageCard
                      colis={c}
                      onClick={() => setSelectedColis(c)}
                      formatPrice={formatPrice}
                    />

                    {/* Action principale contextuelle rapide */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => setSelectedColis(c)}
                        style={{
                          flex: 1, minHeight: '44px', borderRadius: '10px', border: 'none',
                          background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#000',
                          fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                        }}
                      >
                        <CheckCircle2 size={16} /> Livrer (Code OTP)
                      </button>

                      <button
                        onClick={() => setRerouteModalColis(c)}
                        title="Déposer au relais si route impraticable"
                        style={{
                          padding: '0 0.85rem', minHeight: '44px', borderRadius: '10px',
                          border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)',
                          color: '#fcd34d', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.3rem'
                        }}
                      >
                        <MapPin size={15} /> Déposer relais
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ 2. INCIDENTS (REFUSÉS & RÉCLAMATIONS) ══════════════ */}
      {activeTab === 'incidents' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#f87171' }}>
              Incidents & Colis Refusés ({coursesIncidents.length})
            </h1>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Colis nécessitant votre intervention ou arbitrage.
            </p>
          </div>

          {coursesIncidents.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)',
              borderRadius: '16px', color: '#64748b'
            }}>
              <CheckCircle size={36} color="#22c55e" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, color: '#cbd5e1', fontWeight: '700' }}>Aucun incident en cours</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem' }}>Tous vos colis se déroulent normalement.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {coursesIncidents.map(c => {
                const isRefused = c.status === 'Refusé par le point relais';
                const isDispute = c.status === 'En réclamation' || c.claimStatus === 'OPEN';

                return (
                  <div
                    key={c.id}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '16px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: '800', fontFamily: 'monospace' }}>
                          {c.trackingCode}
                        </span>
                        <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
                          {c.clientName}
                        </h3>
                      </div>
                      <span style={{
                        padding: '0.2rem 0.5rem', borderRadius: '8px',
                        background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: '800'
                      }}>
                        {isRefused ? 'REFUSÉ PAR RELAIS' : 'RÉCLAMATION'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                      {c.clientCommune} — {c.clientAddress}
                    </div>

                    {/* Motif affiché en clair */}
                    <div style={{
                      background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px',
                      fontSize: '0.78rem', color: '#fca5a5', lineHeight: 1.4
                    }}>
                      <strong>Motif signalé :</strong> {c.refusalComment || c.claimReason || 'Action requise'}
                    </div>

                    {/* Action Règle 4.2 : Le livreur récupère le colis refusé */}
                    {isRefused && (
                      <button
                        onClick={() => handleRecoverRefusedPackage(c.id)}
                        style={{
                          minHeight: '44px', borderRadius: '10px', border: 'none',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
                          fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                        }}
                      >
                        <Truck size={16} /> Récupérer le colis refusé pour retour
                      </button>
                    )}

                    {isDispute && (
                      <div style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: '700' }}>
                        ⚠ Ne remettez pas ce colis. Le retrait est bloqué en attente de décision du Super Admin.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ 3. CAISSE & DÉPÔT D'ESPÈCES ══════════════ */}
      {activeTab === 'caisse' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#fff' }}>
            Ma Caisse & Dépôts
          </h1>

          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '20px',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '0.8rem', color: '#fcd34d', fontWeight: '700', textTransform: 'uppercase' }}>
              Espèces perçues en main
            </span>
            <div style={{ fontSize: '2.1rem', fontWeight: '900', color: '#ffffff', margin: '0.2rem 0' }}>
              {formatPrice(cashCollected)}
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
              Montant perçu auprès des clients lors des livraisons complétées.
            </p>
          </div>

          {cashCollected > 0 ? (
            <button
              onClick={handleGenerateDepositQr}
              disabled={qrLoading}
              style={{
                minHeight: '50px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
                fontWeight: '900', fontSize: '0.95rem', cursor: qrLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(245,158,11,0.35)'
              }}
            >
              <QrCode size={20} />
              {qrLoading ? 'Génération...' : `Générer QR Dépôt Agence (${formatPrice(cashCollected)})`}
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
              Aucune somme en attente de dépôt.
            </div>
          )}

          {/* Modal Affichage du QR de dépôt */}
          {showQrModal && qrData && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
            }}>
              <div style={{
                background: '#0f172a', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '24px',
                padding: '1.75rem', width: '100%', maxWidth: '380px', textAlign: 'center', color: '#fff'
              }}>
                <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.2rem', fontWeight: '900' }}>
                  Faire scanner à l'Agence
                </h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Montant à remettre : <strong style={{ color: '#fbbf24' }}>{formatPrice(qrData.amount)}</strong>
                </p>

                <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', display: 'inline-block', marginBottom: '1rem' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData.qrToken)}&margin=10`}
                    alt="QR Remise Caisse"
                    style={{ width: '200px', height: '200px', display: 'block' }}
                  />
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                  L'agence scanne ce QR code pour valider immédiatement la décharge de votre caisse.
                </div>

                <button
                  onClick={() => setShowQrModal(false)}
                  style={{
                    width: '100%', minHeight: '44px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                    color: '#fff', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ 4. PROFIL LIVREUR ══════════════ */}
      {activeTab === 'profil' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#fff' }}>
            Mon Profil Livreur
          </h1>

          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.2rem'
              }}>
                {(driver?.name || 'L')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>{driver?.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{driver?.phone}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem', marginTop: '0.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Agence</span>
                <strong>{driver?.agencyName || 'Moncolis'}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Livraisons réussies</span>
                <strong style={{ color: '#4ade80' }}>{coursesLivrees.length}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            style={{
              minHeight: '48px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: '800',
              fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.5rem'
            }}
          >
            <LogOut size={18} /> Se déconnecter
          </button>
        </div>
      )}

      {/* ══════════════ MODAL REDIRECTION POINT RELAIS (ZONE INACCESSIBLE) ══════════════ */}
      {rerouteModalColis && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}>
          <div style={{
            background: '#0d1322', borderTop: '1px solid rgba(245,158,11,0.3)',
            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            width: '100%', maxWidth: '440px', padding: '1.5rem 1rem 2rem', color: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={20} /> Déposer en Point Relais
              </h3>
              <button
                onClick={() => setRerouteModalColis(null)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Route impraticable ou client indisponible : déposez le colis au point relais du secteur. Le client recevra son code OTP pour aller le retirer.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Numéro agent point relais (9 chiffres) :
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="Ex: 123456789"
                    value={agentNumberInput}
                    onChange={e => setAgentNumberInput(e.target.value.replace(/\D/g, ''))}
                    style={{
                      flex: 1, minHeight: '44px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                      padding: '0 0.85rem', color: '#fff', fontSize: '1rem', letterSpacing: '2px', fontWeight: '800'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyAgent}
                    disabled={verifyingAgent || agentNumberInput.length !== 9}
                    style={{
                      minHeight: '44px', padding: '0 1rem', borderRadius: '10px', border: 'none',
                      background: '#3b82f6', color: '#fff', fontWeight: '800', fontSize: '0.82rem',
                      cursor: verifyingAgent ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {verifyingAgent ? '...' : 'Vérifier'}
                  </button>
                </div>
                {agentVerifyError && (
                  <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                    {agentVerifyError}
                  </div>
                )}
              </div>

              {verifiedAgent && (
                <div style={{
                  background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                  padding: '0.75rem', borderRadius: '10px', fontSize: '0.82rem', color: '#86efac'
                }}>
                  Point Relais confirmé : <strong>{verifiedAgent.dropPointName}</strong> (Agent: {verifiedAgent.name})
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Motif de redirection :
                </label>
                <select
                  value={rerouteReason}
                  onChange={e => setRerouteReason(e.target.value)}
                  style={{
                    width: '100%', minHeight: '44px', borderRadius: '10px',
                    background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)',
                    padding: '0 0.75rem', color: '#fff', fontSize: '0.85rem'
                  }}
                >
                  <option value="Route impraticable / inondée">Route impraticable / inondée</option>
                  <option value="Zone insécurisée en soirée">Zone insécurisée en soirée</option>
                  <option value="Client absent / demande retrait relais">Client absent / demande retrait relais</option>
                  <option value="Autre motif d'inaccessibilité">Autre motif d'inaccessibilité</option>
                </select>
              </div>

              <button
                onClick={handleConfirmReroute}
                disabled={!verifiedAgent || rerouteLoading}
                style={{
                  width: '100%', minHeight: '48px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
                  fontWeight: '900', fontSize: '0.95rem', cursor: !verifiedAgent || rerouteLoading ? 'not-allowed' : 'pointer',
                  opacity: !verifiedAgent ? 0.6 : 1, marginTop: '0.5rem'
                }}
              >
                {rerouteLoading ? 'Dépôt en cours...' : 'Confirmer le dépôt au relais'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ PANNEAU COULISSANT DÉTAILS COLIS ══════════════ */}
      <MobilePackageDetailSheet
        colis={selectedColis}
        isOpen={Boolean(selectedColis)}
        onClose={() => setSelectedColis(null)}
        formatPrice={formatPrice}
        role="livreur"
        onValidateOtp={async (otp) => {
          if (!selectedColis) return false;
          return await handleValidateOtp(selectedColis.id, otp);
        }}
      />

      {/* ══════════════ NAVIGATION BASSE (4 ONGLETS) ══════════════ */}
      <MobileBottomNav
        items={navItems}
        activeId={activeTab}
        onChange={id => setActiveTab(id as Tab)}
      />
    </div>
  );
}
