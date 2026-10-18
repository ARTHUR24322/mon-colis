'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Truck, ArrowLeft, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, MapPin, User, Search } from 'lucide-react';

export default function LoginPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Safe role unwrapping
  const rawRole = params?.role;
  const role = (Array.isArray(rawRole) ? rawRole[0] : rawRole) || 'vendeur';
  const isAgence = role === 'agence';
  const isLivreur = role === 'livreur';
  const isPointRelais = role === 'point-relais';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [agentNumber, setAgentNumber] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: any = { role: role.replace('-', '_') };
      if (isLivreur) {
        payload.phone = phone.trim();
        payload.pinCode = pinCode.trim();
      } else if (isPointRelais) {
        payload.agentNumber = agentNumber.trim();
        payload.pinCode = pinCode.trim();
      } else {
        payload.email = email.trim();
        payload.password = password;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Identifiant ou mot de passe incorrect. Veuillez vérifier vos accès.');
        setLoading(false);
        return;
      }

      // Mémorisation de l'espace dans le stockage local
      try {
        localStorage.setItem('moncolis_last_role', role);
      } catch {}

      // Redirect to dashboard (or the originally requested page)
      let defaultRedirect = '/dashboard/vendeur';
      if (isAgence) defaultRedirect = '/dashboard/agence';
      if (isLivreur) defaultRedirect = '/livreur';
      if (isPointRelais) defaultRedirect = '/point-relais';

      const redirectTo = searchParams?.get('redirect') || defaultRedirect;
      router.push(redirectTo);
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
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
          Retour à l'accueil
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
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: isAgence 
                ? 'linear-gradient(135deg, #2563eb, #3b82f6)' 
                : isPointRelais
                ? 'linear-gradient(135deg, #eab308, #ca8a04)'
                : isLivreur
                ? 'linear-gradient(135deg, #f97316, #ea580c)'
                : 'linear-gradient(135deg, #22c55e, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              margin: '0 auto 1rem auto',
              boxShadow: isAgence 
                ? '0 8px 20px rgba(37, 99, 235, 0.35)' 
                : isPointRelais
                ? '0 8px 20px rgba(234, 179, 8, 0.35)'
                : isLivreur
                ? '0 8px 20px rgba(249, 115, 22, 0.35)'
                : '0 8px 20px rgba(34, 197, 94, 0.35)'
            }}>
              {isAgence ? <Truck size={28} /> : isPointRelais ? <MapPin size={28} /> : isLivreur ? <User size={28} /> : <Store size={28} />}
            </div>
            
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
              Espace {isAgence ? 'Agence de Livraison' : isPointRelais ? 'Point Relais' : isLivreur ? 'Livreur' : 'Vendeur & Boutique'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0, lineHeight: 1.4 }}>
              Connectez-vous pour accéder à vos opérations
            </p>
          </div>

          {/* Role switch toggle (Vendeur/Agence only for now) */}
          {(!isLivreur && !isPointRelais) && (
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
              <Link
                href="/auth/vendeur/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  minHeight: '44px',
                  padding: '0.5rem',
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
                  minHeight: '44px',
                  padding: '0.5rem',
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
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* EMAIL (Agence/Vendeur) */}
            {(!isLivreur && !isPointRelais) && (
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
                    style={{ paddingLeft: '2.75rem', fontSize: '1rem', minHeight: '48px', boxSizing: 'border-box' }}
                    required 
                    autoComplete="username"
                    inputMode="email"
                  />
                </div>
              </div>
            )}

            {/* PHONE (Livreur) */}
            {isLivreur && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                  Numéro de téléphone
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input 
                    type="tel" 
                    className="input-field" 
                    placeholder="ex: 0812345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ paddingLeft: '2.75rem', fontSize: '1rem', minHeight: '48px', boxSizing: 'border-box' }}
                    required 
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </div>
            )}

            {/* AGENT NUMBER (Point Relais) */}
            {isPointRelais && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                  Numéro Agent (9 chiffres)
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="ex: 123456789"
                    value={agentNumber}
                    onChange={(e) => setAgentNumber(e.target.value.replace(/\D/g, ''))}
                    style={{ paddingLeft: '2.75rem', fontSize: '1rem', minHeight: '48px', boxSizing: 'border-box' }}
                    required 
                    autoComplete="username"
                    inputMode="numeric"
                  />
                </div>
              </div>
            )}

            {/* PASSWORD / PIN CODE */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                  {isLivreur || isPointRelais ? 'Code PIN (6 chiffres)' : 'Mot de passe'}
                </label>
                {!isLivreur && !isPointRelais && (
                  <a href="#" onClick={(e) => { e.preventDefault(); alert('Veuillez contacter le support Moncolis Kinshasa via WhatsApp pour réinitialiser votre accès.'); }} style={{ fontSize: '0.8rem', color: isAgence ? '#60a5fa' : '#4ade80', opacity: 0.9 }}>
                    Mot de passe oublié ?
                  </a>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="input-field" 
                  placeholder={isLivreur || isPointRelais ? '••••••' : '••••••••'} 
                  value={isLivreur || isPointRelais ? pinCode : password}
                  onChange={(e) => isLivreur || isPointRelais ? setPinCode(e.target.value) : setPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem', paddingRight: '3rem', fontSize: '1rem', minHeight: '48px', boxSizing: 'border-box' }}
                  required 
                  autoComplete={isLivreur || isPointRelais ? 'one-time-code' : 'current-password'}
                  inputMode={isLivreur || isPointRelais ? 'numeric' : 'text'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{
                    position: 'absolute',
                    right: '0.25rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    minWidth: '44px',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                minHeight: '48px',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#fff',
                opacity: loading ? 0.75 : 1,
                background: isAgence
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : isPointRelais
                  ? 'linear-gradient(135deg, #eab308, #a16207)'
                  : isLivreur
                  ? 'linear-gradient(135deg, #f97316, #c2410c)'
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                boxShadow: isAgence
                  ? '0 4px 14px rgba(37, 99, 235, 0.4)'
                  : isPointRelais
                  ? '0 4px 14px rgba(234, 179, 8, 0.4)'
                  : isLivreur
                  ? '0 4px 14px rgba(249, 115, 22, 0.4)'
                  : '0 4px 14px rgba(34, 197, 94, 0.4)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Search size={16} /> Connexion en cours...
                </span>
              ) : `Se connecter (${isAgence ? 'Agence' : isPointRelais ? 'Point Relais' : isLivreur ? 'Livreur' : 'Vendeur'})`}
            </button>
          </form>

          {/* Register switch */}
          {(!isLivreur && !isPointRelais) && (
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
          )}
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
