'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  hashPassword,
  createSession,
  isAuthenticated,
  checkBruteForce,
  recordFailedAttempt,
  resetAttempts,
} from '@/utils/adminAuth';

type Step = 'password' | 'otp';

export default function AdminLoginPage() {
  const router = useRouter();

  const [step, setStep]             = useState<Step>('password');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [otp, setOtp]               = useState('');
  const [error, setError]           = useState('');
  const [adminRole, setAdminRole]   = useState('superadmin');
  const [targetEmail, setTargetEmail] = useState('');
  const [loading, setLoading]       = useState(false);
  const [locked, setLocked]         = useState(false);
  const [countdown, setCountdown]   = useState(0);
  const [showPass, setShowPass]     = useState(false);
  const [otpSent, setOtpSent]       = useState(false);
  const [otpExpiry, setOtpExpiry]   = useState<number | null>(null);
  const [timeLeft, setTimeLeft]     = useState(300); // 5 min


  const otpRef = useRef<HTMLInputElement>(null);
  const lockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) router.replace('/admin-x9k2/dashboard');
  }, [router]);

  // Brute-force countdown ticker
  useEffect(() => {
    if (!locked) return;
    lockTimer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setLocked(false);
          setError('');
          clearInterval(lockTimer.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(lockTimer.current!);
  }, [locked]);

  // OTP timer ticker
  useEffect(() => {
    if (!otpSent || !otpExpiry) return;
    otpTimer.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((otpExpiry - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(otpTimer.current!);
        setError('Le code OTP a expiré. Veuillez recommencer.');
        setStep('password');
        setOtpSent(false);
      }
    }, 1000);
    return () => clearInterval(otpTimer.current!);
  }, [otpSent, otpExpiry]);

  // -- Step 1: Verify password ----------------------------------------------
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { locked: isLocked, remainingMs } = checkBruteForce();
    if (isLocked) {
      setLocked(true);
      setCountdown(Math.ceil(remainingMs / 1000));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-otp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const { locked: nowLocked, remainingMs: ms } = recordFailedAttempt();
        if (nowLocked) {
          setLocked(true);
          setCountdown(Math.ceil(ms / 1000));
          setError(`Trop de tentatives. Réessayez dans ${Math.ceil(ms / 1000)}s.`);
        } else {
          setError('Email ou mot de passe incorrect.');
        }
        setLoading(false);
        return;
      }

      // Password correct — OTP sent via email
      resetAttempts();
      const expiry = Date.now() + 5 * 60 * 1000;
      setOtpExpiry(expiry);
      setTimeLeft(300);
      setOtpSent(true);
      setStep('otp');
      setAdminRole(data.role || 'superadmin');
      setTargetEmail(data.targetEmail || email);
      
      // Auto-fill OTP has been removed by user request
      
      setTimeout(() => otpRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }

  };

  // -- Step 2: Verify OTP ---------------------------------------------------
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const verifyRes = await fetch('/api/auth/admin-otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok && verifyData.success) {
      createSession();
      try {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: adminRole, email, password }),
        });
      } catch (err) {
        console.warn('Could not set server session cookie:', err);
      }
      router.push('/admin-x9k2/dashboard');
    } else {
      setError(verifyData.error || 'Code OTP incorrect ou expiré.');
      setOtp('');
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // -- Styles ---------------------------------------------------------------
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'radial-gradient(ellipse at top, rgba(249,115,22,0.07) 0%, transparent 60%), #000',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '2.5rem',
    backdropFilter: 'blur(16px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle} className="animate-fade-in">

        {/* Top badge */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #f97316, #c2410c)',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(249,115,22,0.3)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5L12 1z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>
            Moncolis <span style={{ color: '#f97316' }}>Admin</span>
          </h1>
          <p style={{ opacity: 0.5, fontSize: '0.82rem', marginTop: '0.3rem' }}>Accès restreint — Autorisation requise</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2rem' }}>
          {[
            { n: 1, label: 'Mot de passe' },
            { n: 2, label: 'Code OTP' },
          ].map(({ n, label }, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                opacity: step === 'password' && n === 2 ? 0.35 : 1,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '0.8rem',
                  background: (step === 'otp' && n === 1) ? '#10b981' :
                               (step === 'password' && n === 1) || (step === 'otp' && n === 2)
                               ? '#f97316' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                }}>
                  {step === 'otp' && n === 1 ? 'OK' : n}
                </div>
                <span style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {i === 0 && <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 0.75rem' }} />}
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)',
            borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
            fontSize: '0.875rem', color: '#fca5a5',
          }}>
            {error}
          </div>
        )}

        {/* -- STEP 1: Password -- */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.875rem', opacity: 0.75 }}>
                Email administrateur
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="admin@moncolis.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={locked}
                required
                autoFocus
                autoComplete="off"
                style={{ marginBottom: '1.25rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.875rem', opacity: 0.75 }}>
                Mot de passe administrateur
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={locked}
                  required
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit',
                  }}
                >
                  {showPass ? 'Masquer' : 'Afficher'}
                </button>
              </div>

            </div>

            {locked && (
              <div style={{
                background: 'rgba(249,115,22,0.08)', border: '1px dashed rgba(249,115,22,0.3)',
                borderRadius: '10px', padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem',
              }}>
                Formulaire bloque — Reessayez dans{' '}
                <strong style={{ color: '#f97316' }}>{countdown}s</strong>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || locked}
              style={{
                width: '100%', padding: '0.85rem',
                borderRadius: '9999px', border: 'none',
                background: locked ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #f97316, #c2410c)',
                color: locked ? 'rgba(255,255,255,0.3)' : 'white',
                fontWeight: '700', fontSize: '0.95rem',
                cursor: locked ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.25s',
                boxShadow: locked ? 'none' : '0 4px 20px rgba(249,115,22,0.35)',
              }}
            >
              {loading ? 'Verification...' : 'Continuer'}
            </button>
          </form>
        )}

        {/* -- STEP 2: OTP -- */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1px dashed rgba(34,197,94,0.35)',
              borderRadius: '14px', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Un code de sécurité OTP a été envoyé à votre adresse email : <br />
                <strong style={{ color: '#4ade80' }}>{targetEmail || email}</strong>
              </span>
              <span style={{ fontSize: '0.75rem', color: '#fb923c' }}>
                Valable pendant : <strong>{formatTime(timeLeft)}</strong>
              </span>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.875rem', opacity: 0.75 }}>
                Code OTP a 6 chiffres
              </label>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="input-field"
                placeholder="______"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoComplete="off"
                style={{ letterSpacing: '0.4em', fontSize: '1.4rem', textAlign: 'center', fontWeight: '700' }}
              />
            </div>

            <button
              type="submit"
              disabled={otp.length !== 6}
              style={{
                width: '100%', padding: '0.85rem',
                borderRadius: '9999px', border: 'none',
                background: otp.length === 6 ? 'linear-gradient(135deg, #f97316, #c2410c)' : 'rgba(255,255,255,0.06)',
                color: otp.length === 6 ? 'white' : 'rgba(255,255,255,0.3)',
                fontWeight: '700', fontSize: '0.95rem',
                cursor: otp.length === 6 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'all 0.25s',
                boxShadow: otp.length === 6 ? '0 4px 20px rgba(249,115,22,0.35)' : 'none',
              }}
            >
              Acceder au panneau
            </button>

            <button
              type="button"
              onClick={() => { setStep('password'); setOtp(''); setError(''); }}
              style={{
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)',
                fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
              }}
            >
              Recommencer
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', opacity: 0.3 }}>
          Toute tentative non autorisee est enregistree.
        </p>
      </div>
    </div>
  );
}

