'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Lock, Mail, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';

/**
 * /agence/login — Formulaire de connexion agence secret.
 * - noindex (ne pas révéler l'URL dans les résultats de recherche)
 * - Rate-limit côté serveur (5 essais / 15 min par IP)
 * - Pas de lien depuis les pages publiques
 */
export default function AgenceLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attempts, setAttempts] = useState(0);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || lockoutSeconds > 0) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agence/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (res.status === 429) {
        // Rate-limited : le serveur indique combien de secondes attendre
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
          setError('Compte temporairement verrouillé. Contactez votre administrateur.');
        } else {
          setError(data.error || 'Email ou mot de passe incorrect.');
        }
        setLoading(false);
        return;
      }

      // Succès — redirection vers le dashboard agence
      setAttempts(0);
      router.push('/agence/dashboard');
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
      setLoading(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

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
      <div style={{
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>

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
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Adresse e-mail
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isLocked}
                  placeholder="agence@exemple.com"
                  style={{
                    width: '100%', height: '44px', borderRadius: '10px',
                    background: isLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    paddingLeft: '2.5rem', paddingRight: '0.85rem',
                    color: '#fff', fontSize: '0.9rem',
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
                    width: '100%', height: '44px', borderRadius: '10px',
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
                  : 'linear-gradient(135deg, #d97706, #f59e0b)',
                color: isLocked ? '#64748b' : '#000',
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
                    width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.3)',
                    borderTopColor: '#000', borderRadius: '50%',
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
                  Se connecter
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
              <span>Session courte — déconnexion automatique</span>
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
            Faire une demande d'adhésion
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
