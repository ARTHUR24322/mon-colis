'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Lock, Mail, Hash, AlertCircle, Building2, CheckCircle2, ChevronDown } from 'lucide-react';

/**
 * /agence/login — Formulaire de connexion agence secret.
 * - Directeur : se connecte avec son EMAIL + mot de passe
 * - Personnel (agent, gestionnaire, comptable...) : se connecte avec son IDENTIFIANT STAFF (MC-XXX-0001) + mot de passe
 * - noindex (ne pas révéler l'URL dans les résultats de recherche)
 * - Rate-limit côté serveur (5 essais / 15 min par IP)
 */
export default function AgenceLoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<'directeur' | 'personnel'>('directeur');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // Reset identifiant quand on change de type
  useEffect(() => {
    setIdentifier('');
    setError('');
  }, [loginType]);

  // Compte à rebours de verrouillage
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => {
      setLockoutSeconds(s => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  // Auto-formater le staff_id : ajouter tirets automatiquement
  const handleIdentifierChange = (val: string) => {
    if (loginType === 'personnel') {
      // Capitaliser et nettoyer
      let v = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      setIdentifier(v);
    } else {
      setIdentifier(val);
    }
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || lockoutSeconds > 0) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agence/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (res.status === 429) {
        const wait = data.retryAfter || 900;
        setLockoutSeconds(wait);
        setError(`Trop de tentatives. Réessayez dans ${Math.ceil(wait / 60)} min.`);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setError('Compte temporairement verrouillé. Contactez votre directeur.');
        } else {
          setError(data.error || 'Identifiant ou mot de passe incorrect.');
        }
        setLoading(false);
        return;
      }

      setAttempts(0);
      router.push('/agence/dashboard');
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
      setLoading(false);
    }
  };

  const isLocked = lockoutSeconds > 0;
  const isPersonnel = loginType === 'personnel';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(245,158,11,0.07), transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.05), transparent 50%), #07090e',
      padding: '2rem 1rem',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', margin: '0 0 0.3rem' }}>
            Espace Agence
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
            Accès réservé aux partenaires agence
          </p>
        </div>

        {/* Sélecteur de type de connexion */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '4px', gap: '4px',
        }}>
          {(['directeur', 'personnel'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setLoginType(type)}
              style={{
                padding: '0.65rem 0.5rem',
                borderRadius: '10px',
                border: 'none',
                background: loginType === type
                  ? type === 'directeur'
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.15))'
                    : 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(79,70,229,0.15))'
                  : 'transparent',
                color: loginType === type ? '#fff' : '#475569',
                fontWeight: loginType === type ? '700' : '500',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                borderWidth: loginType === type ? '1px' : '0',
                borderStyle: 'solid',
                borderColor: loginType === type
                  ? type === 'directeur' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'
                  : 'transparent',
              }}
            >
              {type === 'directeur' ? '👑 Directeur' : '🪪 Personnel'}
            </button>
          ))}
        </div>

        {/* Info contextuelle */}
        <div style={{
          padding: '0.65rem 0.9rem',
          background: isPersonnel ? 'rgba(99,102,241,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${isPersonnel ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.2)'}`,
          borderRadius: '10px',
          fontSize: '0.78rem',
          color: isPersonnel ? '#a5b4fc' : '#fcd34d',
          display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        }}>
          {isPersonnel ? <Hash size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> : <Mail size={14} style={{ flexShrink: 0, marginTop: '1px' }} />}
          <span>
            {isPersonnel
              ? 'Utilisez votre identifiant personnel (ex: MC-KIN-0042) communiqué par votre directeur.'
              : 'Connectez-vous avec l\'adresse e-mail de votre agence.'}
          </span>
        </div>

        {/* Formulaire */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '2rem',
        }}>
          {/* Alerte erreur */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '10px', padding: '0.75rem', marginBottom: '1.25rem',
              color: '#fca5a5', fontSize: '0.82rem',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Alerte verrouillage */}
          {isLocked && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: '10px', padding: '0.75rem', marginBottom: '1.25rem',
              color: '#fcd34d', fontSize: '0.82rem', fontWeight: '700',
            }}>
              <Lock size={16} style={{ flexShrink: 0 }} />
              <span>Connexion bloquée — {Math.floor(lockoutSeconds / 60)}:{String(lockoutSeconds % 60).padStart(2, '0')}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Identifiant : email ou staff_id */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                {isPersonnel ? 'Identifiant personnel' : 'Adresse e-mail'}
              </label>
              <div style={{ position: 'relative' }}>
                {isPersonnel
                  ? <Hash size={16} color="#6366f1" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  : <Mail size={16} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                }
                <input
                  type={isPersonnel ? 'text' : 'email'}
                  required
                  autoComplete={isPersonnel ? 'username' : 'email'}
                  value={identifier}
                  onChange={e => handleIdentifierChange(e.target.value)}
                  disabled={isLocked}
                  placeholder={isPersonnel ? 'MC-KIN-0042' : 'agence@exemple.com'}
                  style={{
                    width: '100%', height: '48px', borderRadius: '10px',
                    background: isLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isPersonnel ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    paddingLeft: '2.5rem', paddingRight: '0.85rem',
                    color: '#fff',
                    fontSize: isPersonnel ? '1rem' : '0.9rem',
                    fontFamily: isPersonnel ? 'monospace' : 'inherit',
                    letterSpacing: isPersonnel ? '0.1em' : 'normal',
                    boxSizing: 'border-box',
                    opacity: isLocked ? 0.5 : 1,
                  }}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLocked}
                  placeholder="••••••••"
                  style={{
                    width: '100%', height: '48px', borderRadius: '10px',
                    background: isLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    paddingLeft: '2.5rem', paddingRight: '2.75rem',
                    color: '#fff', fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    opacity: isLocked ? 0.5 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading || isLocked}
              style={{
                width: '100%', height: '48px', borderRadius: '12px', border: 'none',
                background: isLocked
                  ? 'rgba(100,116,139,0.3)'
                  : isPersonnel
                    ? 'linear-gradient(135deg, #4338ca, #6366f1)'
                    : 'linear-gradient(135deg, #d97706, #f59e0b)',
                color: isLocked ? '#64748b' : '#fff',
                fontWeight: '800', fontSize: '0.95rem',
                cursor: loading || isLocked ? 'not-allowed' : 'pointer',
                marginTop: '0.25rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Connexion...
                </>
              ) : isLocked ? (
                <>
                  <Lock size={16} />
                  Bloqué
                </>
              ) : (
                <>
                  <Shield size={16} />
                  {isPersonnel ? 'Accéder au tableau de bord' : 'Se connecter'}
                </>
              )}
            </button>
          </form>

          {/* Info sécurité */}
          <div style={{
            marginTop: '1.25rem', paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#475569' }}>
              <CheckCircle2 size={12} color="#22c55e" />
              <span>Connexion chiffrée HTTPS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#475569' }}>
              <CheckCircle2 size={12} color="#22c55e" />
              <span>Limitation automatique des tentatives par IP</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#475569' }}>
              <CheckCircle2 size={12} color="#22c55e" />
              <span>Session courte — déconnexion automatique après 4h</span>
            </div>
          </div>
        </div>

        {/* Lien demande d'adhésion */}
        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#475569', margin: 0 }}>
          Pas encore partenaire ?{' '}
          <a
            href="/agence/rejoindre"
            style={{ color: '#f59e0b', fontWeight: '700', textDecoration: 'none' }}
          >
            Faire une demande d&apos;adhésion
          </a>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input { outline: none; }
        input:focus { border-color: rgba(245,158,11,0.5) !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
      `}</style>
    </div>
  );
}
