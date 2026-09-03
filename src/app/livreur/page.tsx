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
import { dataService, ColisItem, DriverAccount } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';

type ScreenState = 'login' | 'dashboard';

export default function LivreurPage() {
  const { user, loading: authLoading, sessionChecked, logout } = useAuth();
  
  const [screen, setScreen] = useState<ScreenState>('login');
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
      setScreen('dashboard');
      loadCourses(d);
    }
  }, [user, sessionChecked]);

  // Login form state
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Realtime updates
  useEffect(() => {
    let unsubscribe: () => void;
    if (screen === 'dashboard' && driver) {
      unsubscribe = dataService.subscribeToPackages(() => {
        loadCourses(driver);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [screen, driver]);

  // Dashboard state
  const [courses, setCourses] = useState<ColisItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpErrors, setOtpErrors] = useState<Record<string, string>>({});
  const [otpSuccess, setOtpSuccess] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'active' | 'done'>('active');

  /* ─── Login Handler ─── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pinCode: pin, role: 'livreur' }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Numéro de téléphone ou code PIN incorrect.');
        setLoginLoading(false);
        return;
      }

      // Successful login, set driver based on response
      const found = await dataService.authenticateDriver(phone, pin);
      if (found) {
        setDriver(found);
        setScreen('dashboard');
        loadCourses(found);
      }
    } catch {
      setLoginError('Impossible de joindre le serveur. Vérifiez votre connexion.');
    }
    setLoginLoading(false);
  };

  /* ─── Load Deliveries for this Driver ─── */
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

  /* ─── OTP Validation ─── */
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
    setScreen('login');
    setCourses([]);
    setPhone('');
    setPin('');
    setLoginError('');
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
     SCREEN 1: LOGIN (Numéro + Code PIN)
  ═══════════════════════════════════════════════════════════ */
  if (screen === 'login') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #07090e 0%, #0d1520 50%, #070e14 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
        color: '#f8fafc'
      }}>
        <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          {/* Back link */}
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            color: '#94a3b8', fontSize: '0.85rem', textDecoration: 'none'
          }}>
            <ArrowLeft size={16} />
            Retour à l'accueil
          </Link>

          {/* Logo + Title */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '70px', height: '70px', borderRadius: '20px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)'
            }}>
              <Truck size={36} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0, color: '#fff' }}>
              Espace Livreur
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
              Connectez-vous avec votre numéro et votre code PIN pour accéder à vos courses.
            </p>
          </div>

          {/* Login Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '2rem',
            backdropFilter: 'blur(20px)'
          }}>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Phone Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  📱 Votre Numéro de Téléphone
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="tel"
                    placeholder="Ex : +243 81 44 55 660"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem 0.8rem 2.75rem',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '1rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* PIN Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  🔐 Votre Code PIN (attribué par votre agence)
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type={showPin ? 'text' : 'password'}
                    placeholder="••••"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    inputMode="numeric"
                    style={{
                      width: '100%',
                      padding: '0.8rem 3rem 0.8rem 2.75rem',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '1.25rem',
                      letterSpacing: '4px',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{
                      position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem'
                    }}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {loginError && (
                <div style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loginLoading || phone.length < 8 || pin.length < 4}
                style={{
                  padding: '0.9rem',
                  borderRadius: '12px',
                  background: loginLoading || phone.length < 8 || pin.length < 4
                    ? 'rgba(59, 130, 246, 0.4)'
                    : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '1rem',
                  cursor: loginLoading || phone.length < 8 || pin.length < 4 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                {loginLoading ? 'Verification...' : 'Acceder a mes livraisons'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     SCREEN 2: DRIVER DASHBOARD
  ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{
      minHeight: '100vh',
      background: '#07090e',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* ── Header ── */}
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

      {/* ── Main Content ── */}
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
                error={otpErrors[c.id]}
                success={otpSuccess[c.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Delivery Card Component
───────────────────────────────────────────── */
function DeliveryCard({
  colis,
  isDone,
  otpValue,
  onOtpChange,
  onValidate,
  error,
  success
}: {
  colis: ColisItem;
  isDone: boolean;
  otpValue: string;
  onOtpChange: (val: string) => void;
  onValidate: () => void;
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

      {/* OTP Section — only for active deliveries */}
      {!isDone && (
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
