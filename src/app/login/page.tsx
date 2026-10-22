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
  Phone,
  HelpCircle,
} from 'lucide-react';

// --- Tooltips d'aide par espace ---
const HELP: Record<'vendeur' | 'agence', { title: string; lines: string[] }> = {
  vendeur: {
    title: 'Espace Vendeur',
    lines: [
      'Connectez-vous avec votre numero de telephone enregistre lors de la creation de votre compte.',
      'Vous pouvez aussi utiliser votre adresse email en cliquant sur "Utiliser mon email".',
      'Mot de passe oublie ? Contactez le support Moncolis.',
    ],
  },
  agence: {
    title: 'Espace Agence',
    lines: [
      "Connectez-vous avec l'email et le mot de passe de votre compte agence.",
      "Votre acces a ete cree lors de l'enregistrement de votre agence partenaire.",
      "Pour le personnel (livreurs, agents), utilisez l'Espace Agence dedie.",
    ],
  },
};

export default function GlobalLoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'vendeur' | 'agence'>('vendeur');
  const [useEmail, setUseEmail] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const isVendeur = role === 'vendeur';
  const usePhone = isVendeur && !useEmail;

  const handleRoleSwitch = (r: 'vendeur' | 'agence') => {
    setRole(r);
    setIdentifier('');
    setErrorMsg('');
    setShowHelp(false);
    if (r === 'agence') setUseEmail(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const body: Record<string, string> = { role, password };
    if (usePhone) {
      body.phone = identifier.trim();
    } else {
      body.email = identifier.trim().toLowerCase();
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Identifiant ou mot de passe incorrect.');
        setLoading(false);
        return;
      }

      try { localStorage.setItem('moncolis_last_role', role); } catch {}

      router.push(role === 'vendeur' ? '/dashboard/vendeur' : '/dashboard/agence');
    } catch {
      setErrorMsg('Impossible de joindre le serveur. Verifiez votre connexion.');
      setLoading(false);
    }
  };

  const help = HELP[role];

  const accent = isVendeur
    ? { main: '#22c55e', dark: '#16a34a', glow: 'rgba(34,197,94,0.4)', border: 'rgba(34,197,94,0.35)', text: '#4ade80', faint: 'rgba(34,197,94,0.15)' }
    : { main: '#2563eb', dark: '#1d4ed8', glow: 'rgba(37,99,235,0.4)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa', faint: 'rgba(59,130,246,0.15)' };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(1.5rem + env(safe-area-inset-top)) 1rem calc(1.5rem + env(safe-area-inset-bottom))',
      background: 'radial-gradient(circle at 50% 20%, rgba(34,197,94,0.07), transparent 55%), radial-gradient(circle at 80% 80%, rgba(59,130,246,0.05), transparent 50%), #07090e',
      boxSizing: 'border-box',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          fontSize: '0.85rem', color: '#64748b', textDecoration: 'none',
          alignSelf: 'flex-start', minHeight: '44px', padding: '0.25rem 0',
        }}>
          <ArrowLeft size={15} />
          Retour a l&apos;accueil
        </Link>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '24px',
          padding: '2rem 1.5rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
        }}>

          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: `linear-gradient(135deg, ${accent.main}, ${accent.dark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', margin: '0 auto 0.9rem',
              boxShadow: `0 8px 20px ${accent.glow}`,
              transition: 'all 0.3s ease',
            }}>
              {isVendeur ? <Store size={26} /> : <Truck size={26} />}
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', margin: '0 0 0.3rem', letterSpacing: '-0.02em' }}>
              Espace {isVendeur ? 'Vendeur' : 'Agence'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.83rem', margin: 0 }}>
              Accedez a votre tableau de bord
            </p>
          </div>

          {/* Role tabs */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '0.4rem', background: 'rgba(255,255,255,0.04)',
            padding: '0.3rem', borderRadius: '14px', marginBottom: '1.25rem',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            {(['vendeur', 'agence'] as const).map((r) => {
              const ac = r === 'vendeur'
                ? { faint: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.35)', text: '#4ade80' }
                : { faint: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa' };
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleSwitch(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '0.45rem', minHeight: '44px', padding: '0.5rem',
                    borderRadius: '10px',
                    border: active ? `1px solid ${ac.border}` : '1px solid transparent',
                    cursor: 'pointer', fontSize: '0.88rem', fontWeight: active ? '700' : '500',
                    background: active ? ac.faint : 'transparent',
                    color: active ? ac.text : '#64748b',
                    transition: 'all 0.2s ease', fontFamily: 'inherit',
                  }}
                >
                  {r === 'vendeur' ? <Store size={15} /> : <Truck size={15} />}
                  {r === 'vendeur' ? 'Vendeur' : 'Agence'}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.55rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)',
              borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1.1rem',
              fontSize: '0.83rem', color: '#fca5a5',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} noValidate>

            {/* Identifier */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1' }}>
                  {usePhone ? 'Numero de telephone' : 'Adresse email'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  {isVendeur && (
                    <button
                      type="button"
                      onClick={() => { setUseEmail(!useEmail); setIdentifier(''); setErrorMsg(''); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.72rem', color: accent.text, fontWeight: '600',
                        padding: 0, fontFamily: 'inherit',
                      }}
                    >
                      {useEmail ? 'Utiliser mon numero' : 'Utiliser mon email'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHelp(v => !v)}
                    aria-label="Aide"
                    title="En savoir plus"
                    style={{
                      background: showHelp ? 'rgba(255,255,255,0.1)' : 'none',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '50%',
                      width: '22px', height: '22px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#64748b', padding: 0,
                      transition: 'all 0.2s',
                    }}
                  >
                    <HelpCircle size={13} />
                  </button>
                </div>
              </div>

              {showHelp && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${accent.border}`,
                  borderRadius: '10px',
                  padding: '0.75rem 0.9rem',
                  marginBottom: '0.6rem',
                  fontSize: '0.76rem',
                  color: '#94a3b8',
                  lineHeight: 1.65,
                }}>
                  <p style={{ margin: '0 0 0.35rem', fontWeight: '700', color: accent.text, fontSize: '0.78rem' }}>
                    {help.title}
                  </p>
                  {help.lines.map((l, i) => (
                    <p key={i} style={{ margin: i < help.lines.length - 1 ? '0 0 0.2rem' : '0' }}>• {l}</p>
                  ))}
                </div>
              )}

              <div style={{ position: 'relative' }}>
                {usePhone
                  ? <Phone size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  : <Mail size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                }
                <input
                  type={usePhone ? 'tel' : 'email'}
                  inputMode={usePhone ? 'tel' : 'email'}
                  placeholder={usePhone ? '+243 8X XXX XXXX' : (isVendeur ? 'boutique@exemple.com' : 'contact@agence.com')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete={usePhone ? 'tel' : 'email'}
                  className="mc-input"
                  style={{ paddingLeft: '2.6rem' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="mc-input"
                  style={{ paddingLeft: '2.6rem', paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  style={{
                    position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
                    minWidth: '44px', minHeight: '44px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.25rem', width: '100%', minHeight: '48px',
                borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer', color: '#fff',
                background: `linear-gradient(135deg, ${accent.main}, ${accent.dark})`,
                boxShadow: `0 4px 14px ${accent.glow}`,
                opacity: loading ? 0.7 : 1, transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                fontFamily: 'inherit',
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px', height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'mc-spin 0.8s linear infinite',
                  }} />
                  Connexion en cours...
                </>
              ) : (
                <>
                  {isVendeur ? <Store size={16} /> : <Truck size={16} />}
                  Se connecter ({isVendeur ? 'Vendeur' : 'Agence'})
                </>
              )}
            </button>
          </form>

          {/* Register / info */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
            {isVendeur ? (
              <>Pas encore de compte ?{' '}
                <Link href="/register" style={{ color: accent.text, fontWeight: '600', textDecoration: 'none' }}>
                  Creer un compte Vendeur
                </Link>
              </>
            ) : (
              <>Pas encore partenaire ?{' '}
                <Link href="/agence/rejoindre" style={{ color: accent.text, fontWeight: '600', textDecoration: 'none' }}>
                  Faire une demande d&apos;adhesion
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Quick access */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.55rem', width: '100%' }}>
          <Link href="/point-relais" style={{
            padding: '0.75rem 0.5rem', borderRadius: '12px',
            background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.22)',
            color: '#93c5fd', textDecoration: 'none', fontSize: '0.78rem', fontWeight: '700',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}>
            <MapPin size={14} color="#3b82f6" />
            Agent Relais
          </Link>
          <Link href="/livreur" style={{
            padding: '0.75rem 0.5rem', borderRadius: '12px',
            background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)',
            color: '#86efac', textDecoration: 'none', fontSize: '0.78rem', fontWeight: '700',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}>
            <Smartphone size={14} color="#22c55e" />
            Livreur
          </Link>
        </div>

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', color: '#374151', fontSize: '0.76rem' }}>
          <ShieldCheck size={14} />
          <span>Plateforme securisee - chiffrement de bout en bout</span>
        </div>
      </div>

      <style>{`
        @keyframes mc-spin { to { transform: rotate(360deg); } }
        .mc-input {
          width: 100%;
          height: 48px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 0.95rem;
          font-family: inherit;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          padding-right: 0.85rem;
        }
        .mc-input::placeholder { color: #374151; }
        .mc-input:focus {
          border-color: rgba(245,158,11,0.55);
          box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
        }
      `}</style>
    </div>
  );
}
