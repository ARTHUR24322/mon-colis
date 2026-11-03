'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RotateCw,
  KeyRound,
  ShieldCheck,
  Hash,
  Users
} from 'lucide-react';

export default function AgenceRecuperationPage() {
  const router = useRouter();

  // Steps: 'request' | 'verify' | 'new_password' | 'success'
  const [step, setStep] = useState<'request' | 'verify' | 'new_password' | 'success'>('request');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Timer for OTP resend (60s countdown)
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(c => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Step 1: Request OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setError('Veuillez saisir votre adresse e-mail d’agence.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/agence/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la demande.');
        setLoading(false);
        return;
      }

      setMaskedEmail(data.maskedEmail || identifier);
      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
      }
      setCountdown(60);
      setStep('verify');
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setError('Le code de vérification doit comporter exactement 6 chiffres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agence/auth/reset-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: cleanOtp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Code de vérification incorrect.');
        setLoading(false);
        return;
      }

      setDevOtpHint(null);
      setStep('new_password');
    } catch {
      setError('Erreur lors de la validation du code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Confirm new password
  const handleConfirmPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agence/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la mise à jour.');
        setLoading(false);
        return;
      }

      setStep('success');
    } catch {
      setError('Erreur serveur lors de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(245,158,11,0.07), transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.05), transparent 50%), #07090e',
      padding: '2rem 1rem',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#fff',
    }}>
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header Agence */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Building2 size={28} color="#f59e0b" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0 0 0.3rem' }}>
            Récupération de compte Agence
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
            Réinitialisez l&apos;accès sécurisé à votre espace agence
          </p>
        </div>

        {/* Indicateur d'étape */}
        {step !== 'success' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {[
              { id: 'request', label: 'Identification' },
              { id: 'verify', label: 'Vérification' },
              { id: 'new_password', label: 'Nouveau mot de passe' },
            ].map((s, idx) => {
              const active = step === s.id;
              const completed = (s.id === 'request' && (step === 'verify' || step === 'new_password')) ||
                                (s.id === 'verify' && step === 'new_password');
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: active ? '#f59e0b' : completed ? '#10b981' : 'rgba(255,255,255,0.08)',
                    color: active || completed ? '#000' : '#64748b',
                    fontSize: '0.72rem', fontWeight: '800',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {completed ? <CheckCircle2 size={14} color="#000" /> : idx + 1}
                  </div>
                  {idx < 2 && (
                    <div style={{
                      width: '30px', height: '2px',
                      background: completed ? '#10b981' : 'rgba(255,255,255,0.08)',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Boîte principale */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}>

          {/* Erreur */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '10px', padding: '0.75rem',
              color: '#fca5a5', fontSize: '0.82rem',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Info */}
          {infoMessage && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '10px', padding: '0.75rem',
              color: '#86efac', fontSize: '0.82rem',
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ÉTAPE 1 : IDENTIFICATION
          ══════════════════════════════════════════════════════════════════ */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Adresse e-mail de l&apos;agence
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="directeur@agence-kinshasa.com"
                    value={identifier}
                    onChange={e => { setIdentifier(e.target.value); setError(''); }}
                    style={{
                      width: '100%', height: '48px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      paddingLeft: '2.5rem', paddingRight: '0.85rem',
                      color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                  Saisissez l&apos;e-mail utilisé lors de la création de votre compte agence.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  color: '#fff', fontWeight: '800', fontSize: '0.92rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <>
                    <RotateCw size={16} className="animate-spin" />
                    <span>Envoi du code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    <span>Envoyer le code de récupération</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ÉTAPE 2 : CODE DE VÉRIFICATION OTP
          ══════════════════════════════════════════════════════════════════ */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '10px', padding: '0.75rem', fontSize: '0.8rem', color: '#fcd34d',
              }}>
                Un code à 6 chiffres a été envoyé à <strong>{maskedEmail}</strong>.
              </div>

              {/* Dev hint si disponible */}
              {devOtpHint && (
                <div style={{
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '10px', padding: '0.65rem', fontSize: '0.78rem', color: '#93c5fd',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>Code de test disponible : <strong>{devOtpHint}</strong></span>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtpHint)}
                    style={{
                      background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
                      padding: '3px 8px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    Insérer
                  </button>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Code de vérification (6 chiffres)
                </label>
                <div style={{ position: 'relative' }}>
                  <Hash size={16} color="#f59e0b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                      setError('');
                    }}
                    style={{
                      width: '100%', height: '52px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245,158,11,0.3)',
                      paddingLeft: '2.5rem', paddingRight: '0.85rem',
                      color: '#fff', fontSize: '1.25rem', letterSpacing: '0.3em',
                      fontWeight: '800', fontFamily: 'monospace', textAlign: 'center',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={countdown > 0 || loading}
                    onClick={() => handleRequestOtp()}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: countdown > 0 ? '#64748b' : '#f59e0b',
                      fontSize: '0.75rem', fontWeight: '700',
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {countdown > 0 ? `Renvoyer le code (${countdown}s)` : 'Renvoyer un code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('request'); setError(''); }}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer'
                    }}
                  >
                    Changer d&apos;e-mail
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  color: '#fff', fontWeight: '800', fontSize: '0.92rem',
                  cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'opacity 0.2s', opacity: (loading || otp.length !== 6) ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <>
                    <RotateCw size={16} className="animate-spin" />
                    <span>Vérification...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Confirmer le code</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ÉTAPE 3 : NOUVEAU MOT DE PASSE
          ══════════════════════════════════════════════════════════════════ */}
          {step === 'new_password' && (
            <form onSubmit={handleConfirmPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Nouveau mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Au moins 6 caractères"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    style={{
                      width: '100%', height: '48px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      paddingLeft: '2.5rem', paddingRight: '2.5rem',
                      color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Confirmer le nouveau mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Répétez le mot de passe"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    style={{
                      width: '100%', height: '48px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      paddingLeft: '2.5rem', paddingRight: '0.85rem',
                      color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || newPassword.length < 6}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', fontWeight: '800', fontSize: '0.92rem',
                  cursor: (loading || newPassword.length < 6) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'opacity 0.2s', opacity: (loading || newPassword.length < 6) ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <>
                    <RotateCw size={16} className="animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Enregistrer le nouveau mot de passe</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ÉTAPE 4 : SUCCÈS
          ══════════════════════════════════════════════════════════════════ */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
              }}>
                <CheckCircle2 size={32} color="#10b981" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 0.35rem' }}>
                  Mot de passe mis à jour !
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Votre accès à l&apos;espace agence a été sécurisé et rétabli. Vous pouvez maintenant vous connecter.
                </p>
              </div>

              <button
                onClick={() => router.push('/agence/login')}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  color: '#fff', fontWeight: '800', fontSize: '0.92rem',
                  cursor: 'pointer', marginTop: '0.5rem',
                }}
              >
                Accéder à la connexion
              </button>
            </div>
          )}
        </div>

        {/* Note pour le personnel (agents, manutentionnaires) */}
        <div style={{
          padding: '0.85rem 1rem', borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
          fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4,
        }}>
          <Users size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong style={{ color: '#a5b4fc' }}>Membre d&apos;équipe (Agent / Staff) ?</strong> Si vous avez oublié votre code PIN ou mot de passe, contactez directement votre directeur d&apos;agence qui peut réinitialiser votre accès depuis son tableau de bord.
          </span>
        </div>

        {/* Retour connexion */}
        <div style={{ textAlign: 'center' }}>
          <Link
            href="/agence/login"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none', fontWeight: '600',
            }}
          >
            <ArrowLeft size={14} />
            <span>Retour à la connexion</span>
          </Link>
        </div>

      </div>
    </div>
  );
}

