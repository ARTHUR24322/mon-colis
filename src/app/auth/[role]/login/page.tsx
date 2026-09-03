'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Truck, ArrowLeft, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Safe role unwrapping
  const rawRole = params?.role;
  const role = (Array.isArray(rawRole) ? rawRole[0] : rawRole) || 'vendeur';
  const isAgence = role === 'agence';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, role }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur de connexion. Vérifiez vos identifiants.');
        setLoading(false);
        return;
      }

      // Redirect to dashboard (or the originally requested page)
      const redirectTo = searchParams?.get('redirect') || (isAgence ? '/dashboard/agence' : '/dashboard/vendeur');
      router.push(redirectTo);
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
      setLoading(false);
    }
  };


  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'radial-gradient(circle at 50% 20%, rgba(34, 197, 94, 0.08), transparent 60%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.06), transparent 50%), #07090e'
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem'
      }}>
        {/* Back Link */}
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          color: '#94a3b8',
          transition: 'color 0.2s ease',
          alignSelf: 'flex-start'
        }}>
          <ArrowLeft size={16} />
          Retour à l'accueil
        </Link>

        {/* Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2.5rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Brand header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: isAgence 
                ? 'linear-gradient(135deg, #2563eb, #3b82f6)' 
                : 'linear-gradient(135deg, #22c55e, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              margin: '0 auto 1rem auto',
              boxShadow: isAgence 
                ? '0 8px 20px rgba(37, 99, 235, 0.35)' 
                : '0 8px 20px rgba(34, 197, 94, 0.35)'
            }}>
              {isAgence ? <Truck size={28} /> : <Store size={28} />}
            </div>
            
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
              Espace {isAgence ? 'Agence de Livraison' : 'Vendeur & Boutique'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Connectez-vous pour accéder à votre espace de travail
            </p>
          </div>

          {/* Role switch toggle */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0.35rem',
            borderRadius: '14px',
            marginBottom: '1.75rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <Link
              href="/auth/vendeur/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: !isAgence ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                color: !isAgence ? '#4ade80' : '#94a3b8',
                border: !isAgence ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent',
                textDecoration: 'none'
              }}
            >
              <Store size={16} />
              Vendeur
            </Link>

            <Link
              href="/auth/agence/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: isAgence ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: isAgence ? '#60a5fa' : '#94a3b8',
                border: isAgence ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                textDecoration: 'none'
              }}
            >
              <Truck size={16} />
              Agence
            </Link>
          </div>

          {/* Form */}
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
                  placeholder={isAgence ? 'contact@agence.com' : 'boutique@exemple.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required 
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                  Mot de passe
                </label>
                <a href="#" onClick={(e) => { e.preventDefault(); alert('Fonctionnalité disponible prochainement'); }} style={{ fontSize: '0.8rem', color: isAgence ? '#60a5fa' : '#4ade80', opacity: 0.9 }}>
                  Mot de passe oublié ?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="input-field" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.875rem',
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{error}</span>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#fff',
                opacity: loading ? 0.75 : 1,
                background: isAgence
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                boxShadow: isAgence
                  ? '0 4px 14px rgba(37, 99, 235, 0.4)'
                  : '0 4px 14px rgba(34, 197, 94, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? '🔍 Vérification en cours...' : `Se connecter comme ${isAgence ? 'Agence' : 'Vendeur'}`}
            </button>
          </form>

          {/* Register switch */}
          <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Pas encore de compte ?{' '}
            <Link 
              href={`/auth/${role}/register`} 
              style={{ 
                color: isAgence ? '#60a5fa' : '#4ade80', 
                fontWeight: '600',
                textDecoration: 'none'
              }}
            >
              Créer un compte {isAgence ? 'Agence' : 'Vendeur'}
            </Link>
          </div>
        </div>

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
          <ShieldCheck size={16} />
          <span>Connexion chiffrée SSL 256-bit</span>
        </div>
      </div>
    </div>
  );
}
