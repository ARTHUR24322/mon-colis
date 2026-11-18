'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Eye, EyeOff } from 'lucide-react';
import { KINSHASA_COMMUNES, sanitizeDrcPhoneDigits, formatDrcPhoneDisplay } from '@/utils/kinshasa';

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator component
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = [1, 2, 3];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '0.5rem' }}>
      {steps.map((s, i) => {
        const done = s < current;
        const active = s === current;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            {/* Circle */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.9rem',
              flexShrink: 0,
              background: done ? '#22c55e' : active ? '#f97316' : 'transparent',
              border: done || active ? 'none' : '2px solid #374151',
              color: done || active ? '#fff' : '#6b7280',
              transition: 'all 0.3s ease',
            }}>
              {done ? <Check size={16} strokeWidth={3} /> : s}
            </div>
            {/* Dashed line */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: '2px',
                background: done ? '#22c55e' : '#374151',
                backgroundImage: done ? 'none' : 'repeating-linear-gradient(90deg, #374151 0, #374151 6px, transparent 6px, transparent 12px)',
                margin: '0 4px',
                transition: 'background 0.3s ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STEP_LABELS: Record<number, string> = {
  1: 'votre boutique',
  2: 'votre adresse',
  3: 'mot de passe',
};

// Password strength checks
function PasswordChecks({ password }: { password: string }) {
  const checks = [
    { label: 'Au moins 8 caractères', ok: password.length >= 8 },
    { label: 'Une lettre', ok: /[a-zA-Z]/.test(password) },
    { label: 'Un chiffre', ok: /[0-9]/.test(password) },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.6rem' }}>
      {checks.map(({ label, ok }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%',
            border: `1.5px solid ${ok ? '#22c55e' : '#4b5563'}`,
            background: ok ? '#22c55e' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.2s',
          }}>
            {ok && <Check size={9} color="#fff" strokeWidth={3} />}
          </div>
          <span style={{ color: ok ? '#d1d5db' : '#6b7280' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [email, setEmail] = useState('');

  // Step 2
  const [commune, setCommune] = useState('');
  const [quartier, setQuartier] = useState('');
  const [avenue, setAvenue] = useState('');
  const [numero, setNumero] = useState('');

  // Step 3
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Step validation ──────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!name.trim()) { setErrorMsg('Le nom de la boutique est requis.'); return false; }
    if (phoneDigits.length !== 9) { setErrorMsg('Le numéro doit contenir 9 chiffres après +243.'); return false; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { setErrorMsg('Adresse e-mail invalide.'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!commune.trim()) { setErrorMsg('Veuillez sélectionner une commune.'); return false; }
    if (!quartier.trim()) { setErrorMsg('Le quartier est requis.'); return false; }
    if (!avenue.trim()) { setErrorMsg("L'avenue ou rue est requise."); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (password.length < 8) { setErrorMsg('Le mot de passe doit comporter au moins 8 caractères.'); return false; }
    if (!/[a-zA-Z]/.test(password)) { setErrorMsg('Le mot de passe doit contenir au moins une lettre.'); return false; }
    if (!/[0-9]/.test(password)) { setErrorMsg('Le mot de passe doit contenir au moins un chiffre.'); return false; }
    if (password !== confirmPassword) { setErrorMsg('Les mots de passe ne correspondent pas.'); return false; }
    if (!acceptTerms) { setErrorMsg('Veuillez accepter les conditions d\'utilisation.'); return false; }
    return true;
  };

  const goNext = () => {
    setErrorMsg('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const goBack = () => {
    setErrorMsg('');
    if (step === 1) router.push('/');
    else setStep(s => s - 1);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setErrorMsg('');
    if (!validateStep3()) return;
    setLoading(true);

    const fullPhone = `+243${phoneDigits}`;
    // Build complete address: "N°3 Avenue kinshasa limete, hyr, Makala, Kinshasa"
    const addressParts = [
      numero ? `N°${numero} ${avenue.trim()}` : avenue.trim(),
      quartier.trim(),
      commune.trim(),
      'Kinshasa',
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'vendeur',
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: fullPhone,
          city: 'Kinshasa',
          address: fullAddress,
          password,
          coverageZones: [commune || 'Kinshasa'],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Erreur lors de la création du compte.');
        return;
      }
      router.push('/dashboard/vendeur');
    } catch {
      setErrorMsg('Une erreur réseau est survenue. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles ────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#1e2433',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.88rem',
    fontWeight: '600',
    color: '#e5e7eb',
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e1117',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>Moncolis</span>
        </div>

        {/* Back */}
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500',
            padding: '0.25rem 0',
          }}
        >
          Retour
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '1.5rem 1rem 2rem',
      }}>
        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Step indicator + label */}
          <div>
            <StepIndicator current={step} />
            <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: '0.4rem 0 0' }}>
              Étape {step} sur 3 : {STEP_LABELS[step]}
            </p>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              color: '#fca5a5',
              fontSize: '0.84rem',
            }}>
              {errorMsg}
            </div>
          )}

          {/* ───────────────── STEP 1 ───────────────── */}
          {step === 1 && (
            <div style={{
              background: '#161b27',
              borderRadius: '20px',
              padding: '1.75rem 1.5rem',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff', marginBottom: '0.4rem', lineHeight: 1.25 }}>
                Créez votre compte vendeur
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Expédiez vos colis à Kinshasa et suivez-les jusqu'à la remise.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Nom boutique */}
                <div>
                  <label style={labelStyle}>Nom de la boutique</label>
                  <input
                    type="text"
                    placeholder="Ex: Mode & Chic"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && goNext()}
                  />
                </div>

                {/* Téléphone */}
                <div>
                  <label style={labelStyle}>Téléphone WhatsApp</label>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    borderRadius: '10px', overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: '#1e2433',
                    height: '48px',
                  }}>
                    <div style={{
                      padding: '0 1rem', height: '100%',
                      display: 'flex', alignItems: 'center',
                      background: '#252d3d',
                      borderRight: '1px solid rgba(255,255,255,0.08)',
                      color: '#fff', fontWeight: '700', fontSize: '0.95rem',
                      flexShrink: 0,
                    }}>
                      +243
                    </div>
                    <input
                      type="tel"
                      placeholder="834 590 319"
                      value={formatDrcPhoneDisplay(phoneDigits)}
                      onChange={e => setPhoneDigits(sanitizeDrcPhoneDigits(e.target.value))}
                      maxLength={12}
                      style={{
                        flex: 1, height: '100%', background: 'transparent', border: 'none',
                        padding: '0 1rem', color: '#fff', fontSize: '0.95rem',
                        fontWeight: '500', letterSpacing: '0.03em', outline: 'none',
                      }}
                      onKeyDown={e => e.key === 'Enter' && goNext()}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email"
                    placeholder="contact@boutique.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && goNext()}
                  />
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={goNext}
                style={{
                  marginTop: '1.5rem', width: '100%', padding: '1rem',
                  borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff', fontWeight: '700', fontSize: '1rem',
                  boxShadow: '0 4px 20px rgba(249,115,22,0.35)',
                }}
              >
                Continuer
              </button>

              {/* Login link */}
              <p style={{ textAlign: 'center', marginTop: '1.25rem', color: '#9ca3af', fontSize: '0.88rem' }}>
                Déjà un compte ?{' '}
                <Link href="/auth/vendeur/login" style={{ color: '#fff', fontWeight: '700', textDecoration: 'underline' }}>
                  Se connecter
                </Link>
              </p>
            </div>
          )}

          {/* ───────────────── STEP 2 ───────────────── */}
          {step === 2 && (
            <div style={{
              background: '#161b27',
              borderRadius: '20px',
              padding: '1.75rem 1.5rem',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff', marginBottom: '0.4rem', lineHeight: 1.25 }}>
                Où se trouve votre boutique ?
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Les agences utilisent cette adresse pour venir récupérer vos colis.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Commune */}
                <div>
                  <label style={labelStyle}>Commune</label>
                  <select
                    value={commune}
                    onChange={e => setCommune(e.target.value)}
                    style={{ ...inputStyle, appearance: 'auto', cursor: 'pointer' }}
                  >
                    <option value="" style={{ background: '#1e2433' }}>Sélectionner une commune</option>
                    {KINSHASA_COMMUNES.map(c => (
                      <option key={c} value={c} style={{ background: '#1e2433' }}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Quartier */}
                <div>
                  <label style={labelStyle}>Quartier</label>
                  <input
                    type="text"
                    placeholder="Ex: Matonge"
                    value={quartier}
                    onChange={e => setQuartier(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {/* Avenue + Numéro côte à côte */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Avenue ou rue</label>
                    <input
                      type="text"
                      placeholder="Ex: Avenue du Commerce"
                      value={avenue}
                      onChange={e => setAvenue(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Numéro</label>
                    <input
                      type="text"
                      placeholder="3"
                      value={numero}
                      onChange={e => setNumero(e.target.value)}
                      style={{ ...inputStyle, width: '80px', textAlign: 'center' }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={goNext}
                style={{
                  marginTop: '1.5rem', width: '100%', padding: '1rem',
                  borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff', fontWeight: '700', fontSize: '1rem',
                  boxShadow: '0 4px 20px rgba(249,115,22,0.35)',
                }}
              >
                Continuer
              </button>
            </div>
          )}

          {/* ───────────────── STEP 3 ───────────────── */}
          {step === 3 && (
            <div style={{
              background: '#161b27',
              borderRadius: '20px',
              padding: '1.75rem 1.5rem',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff', marginBottom: '0.4rem', lineHeight: 1.25 }}>
                Choisissez un mot de passe
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Il protège vos colis et vos paiements.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Password */}
                <div>
                  <label style={labelStyle}>Mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder=""
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{
                        position: 'absolute', right: '1rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#9ca3af', fontSize: '0.84rem', fontWeight: '600',
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      {showPassword ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                  <PasswordChecks password={password} />
                </div>

                {/* Confirm password */}
                <div>
                  <label style={labelStyle}>Confirmez le mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder=""
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      style={{
                        position: 'absolute', right: '1rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#9ca3af', fontSize: '0.84rem', fontWeight: '600',
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                      }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      {showConfirm ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  cursor: 'pointer', fontSize: '0.84rem', color: '#9ca3af', lineHeight: 1.5,
                }}>
                  <div
                    onClick={() => setAcceptTerms(v => !v)}
                    style={{
                      width: '18px', height: '18px', borderRadius: '4px',
                      border: `2px solid ${acceptTerms ? '#f97316' : '#4b5563'}`,
                      background: acceptTerms ? '#f97316' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '1px', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {acceptTerms && <Check size={11} color="#fff" strokeWidth={3} />}
                  </div>
                  <span>
                    J'accepte les{' '}
                    <span style={{ color: '#fff', textDecoration: 'underline', cursor: 'pointer' }}>conditions d'utilisation</span>
                    {' '}et la{' '}
                    <span style={{ color: '#fff', textDecoration: 'underline', cursor: 'pointer' }}>politique de confidentialité</span>.
                  </span>
                </label>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  marginTop: '1.5rem', width: '100%', padding: '1rem',
                  borderRadius: '12px', border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading
                    ? 'rgba(249,115,22,0.5)'
                    : 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff', fontWeight: '700', fontSize: '1rem',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(249,115,22,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? 'Création du compte...' : 'Créer mon compte'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
