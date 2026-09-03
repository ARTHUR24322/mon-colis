'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Truck, ArrowLeft, ShieldCheck, Lock, Mail, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';

export default function GlobalLoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'vendeur' | 'agence'>('vendeur');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const fillDemo = (selectedRole: 'vendeur' | 'agence') => {
    setRole(selectedRole);
    if (selectedRole === 'vendeur') {
      setEmail('vendeur@moncolis.cd');
      setPassword('password123');
    } else {
      setEmail('contact@expressdelivery.cd');
      setPassword('password123');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (role === 'vendeur') {
        router.push('/dashboard/vendeur');
      } else {
        router.push('/dashboard/agence');
      }
    }, 800);
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
            
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
              Espace {role === 'vendeur' ? 'Vendeur' : 'Agence'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
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
            marginBottom: '1.75rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              type="button"
              onClick={() => setRole('vendeur')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: role === 'vendeur' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                color: role === 'vendeur' ? '#4ade80' : '#94a3b8',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: role === 'vendeur' ? 'rgba(34, 197, 94, 0.4)' : 'transparent'
              }}
            >
              <Store size={16} />
              Vendeur
            </button>

            <button
              type="button"
              onClick={() => setRole('agence')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: role === 'agence' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: role === 'agence' ? '#60a5fa' : '#94a3b8',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: role === 'agence' ? 'rgba(59, 130, 246, 0.4)' : 'transparent'
              }}
            >
              <Truck size={16} />
              Agence
            </button>
          </div>

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
                <a href="#" onClick={(e) => { e.preventDefault(); alert('Fonctionnalité de réinitialisation disponible prochainement'); }} style={{ fontSize: '0.8rem', color: '#22c55e', opacity: 0.9 }}>
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
                background: role === 'vendeur'
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: role === 'vendeur'
                  ? '0 4px 14px rgba(34, 197, 94, 0.4)'
                  : '0 4px 14px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Connexion en cours...' : `Se connecter comme ${role === 'vendeur' ? 'Vendeur' : 'Agence'}`}
            </button>
          </form>

          {/* Quick Demo Test Access */}
          <div style={{
            marginTop: '1.5rem',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              <Sparkles size={14} color="#f59e0b" />
              <span>Accès rapide de démonstration :</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => fillDemo('vendeur')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#4ade80',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  cursor: 'pointer'
                }}
              >
                Démo Vendeur
              </button>
              <button
                type="button"
                onClick={() => fillDemo('agence')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  cursor: 'pointer'
                }}
              >
                Démo Agence
              </button>
            </div>
          </div>

          {/* Register switch */}
          <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Pas encore de compte ?{' '}
            <Link
              href={role === 'vendeur' ? '/auth/vendeur/register' : '/auth/agence/register'}
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

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
          <ShieldCheck size={16} />
          <span>Plateforme sécurisée avec chiffrement de bout en bout</span>
        </div>
      </div>
    </div>
  );
}
