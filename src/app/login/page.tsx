'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Store,
  Truck,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  MapPin,
  Smartphone,
} from 'lucide-react';

export default function GlobalLoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'vendeur' | 'agence'>('vendeur');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ role, email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Identifiant ou mot de passe incorrect. Veuillez vérifier vos accès.');
        setLoading(false);
        return;
      }

      // Mémorisation de l'espace dans le stockage local
      try {
        localStorage.setItem('moncolis_last_role', role);
      } catch {}

      // Rediriger vers le bon dashboard
      if (role === 'vendeur') {
        router.push('/dashboard/vendeur');
      } else {
        router.push('/dashboard/agence');
      }
    } catch {
      setErrorMsg('Impossible de joindre le serveur. Vérifiez votre connexion.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(1.5rem + env(safe-area-inset-top)) 1rem calc(1.5rem + env(safe-area-inset-bottom))',
      background: 'radial-gradient(circle at 50% 20%, rgba(34, 197, 94, 0.08), transparent 60%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.06), transparent 50%), #07090e',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Back Link */}
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          color: '#94a3b8',
          transition: 'color 0.2s ease',
          alignSelf: 'flex-start',
          minHeight: '44px',
          padding: '0.25rem 0'
        }}>
          <ArrowLeft size={16} />
          Retour à l&apos;accueil
        </Link>

        {/* Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2rem 1.5rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Brand header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: role === 'vendeur'
                ? 'linear-gradient(135deg, #22c55e, #10b981)'
                : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              margin: '0 auto 1rem auto',
              boxShadow: role === 'vendeur'
                ? '0 8px 20px rgba(34, 197, 94, 0.35)'
                : '0 8px 20px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.3s ease'
            }}>
              {role === 'vendeur' ? <Store size={26} /> : <Truck size={26} />}
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
              Espace {role === 'vendeur' ? 'Vendeur' : 'Agence'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0, lineHeight: 1.4 }}>
              Accédez à votre tableau de bord de gestion
            </p>
          </div>

          {/* Role selector tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0.35rem',
            borderRadius: '14px',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              type="button"
              onClick={() => { setRole('vendeur'); setErrorMsg(''); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', minHeight: '44px', padding: '0.5rem', borderRadius: '10px',
                border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600',
                transition: 'all 0.2s ease',
                background: role === 'vendeur' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                color: role === 'vendeur' ? '#4ade80' : '#94a3b8',
                borderWidth: '1px', borderStyle: 'solid',
                borderColor: role === 'vendeur' ? 'rgba(34, 197, 94, 0.4)' : 'transparent'
              }}
            >
              <Store size={16} />
              Vendeur
            </button>

            <button
              type="button"
              onClick={() => { setRole('agence'); setErrorMsg(''); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', minHeight: '44px', padding: '0.5rem', borderRadius: '10px',
                border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600',
                transition: 'all 0.2s ease',
                background: role === 'agence' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: role === 'agence' ? '#60a5fa' : '#94a3b8',
                borderWidth: '1px', borderStyle: 'solid',
                borderColor: role === 'agence' ? 'rgba(59, 130, 246, 0.4)' : 'transparent'
              }}
            >
              <Truck size={16} />
              Agence
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
              fontSize: '0.875rem', color: '#fca5a5'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                Adresse Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="email"
                  className="input-field"
                  placeholder={role === 'vendeur' ? 'boutique@exemple.com' : 'contact@agence.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.75rem', fontSize: '1rem', minHeight: '48px', boxSizing: 'border-box' }}
                  required
                  autoComplete="username"
                  inputMode="email"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem', paddingRight: '3rem', fontSize: '1rem', minHeight: '48px', boxSizing: 'border-box' }}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{
                    position: 'absolute', right: '0.25rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    color: '#64748b', cursor: 'pointer',
                    minWidth: '44px', minHeight: '44px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem', width: '100%', minHeight: '48px', padding: '0.85rem',
                borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer', color: '#fff',
                background: role === 'vendeur'
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: role === 'vendeur'
                  ? '0 4px 14px rgba(34, 197, 94, 0.4)'
                  : '0 4px 14px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Connexion en cours...' : `Se connecter (${role === 'vendeur' ? 'Vendeur' : 'Agence'})`}
            </button>
          </form>

          {/* Register switch */}
          <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Pas encore de compte ?{' '}
            <Link
              href="/register"
              style={{
                color: role === 'vendeur' ? '#4ade80' : '#60a5fa',
                fontWeight: '600',
                textDecoration: 'none'
              }}
            >
              Créer un compte {role === 'vendeur' ? 'Vendeur' : 'Agence'}
            </Link>
          </div>
        </div>

        {/* Quick Access to other spaces: Livreur, Point Relais */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.6rem', width: '100%'
        }}>
          <Link
            href="/point-relais"
            style={{
              padding: '0.75rem 0.5rem', borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)',
              color: '#93c5fd', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '700',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              textAlign: 'center'
            }}
          >
            <MapPin size={15} color="#3b82f6" />
            <span>Agent Relais</span>
          </Link>

          <Link
            href="/livreur"
            style={{
              padding: '0.75rem 0.5rem', borderRadius: '12px',
              background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)',
              color: '#86efac', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '700',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              textAlign: 'center'
            }}
          >
            <Smartphone size={15} color="#22c55e" />
            <span>Livreur</span>
          </Link>
        </div>

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
          <ShieldCheck size={16} />
          <span>Plateforme sécurisée avec chiffrement de bout en bout</span>
        </div>
      </div>
    </div>
  );
}
