'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Store, Truck, MapPin, ArrowLeft, Lock, Mail, Eye, EyeOff,
  ShieldCheck, AlertCircle, Phone, HelpCircle,
} from 'lucide-react';

function MonColisLogo() {
  return (
    <svg viewBox="0 0 260 260" width="56" height="56" role="img" aria-label="Logo Mon Colis">
      <rect x="10" y="10" width="240" height="240" rx="48" fill="#1B2A4A"/>
      <g stroke="#1B2A4A" strokeWidth="2" strokeLinejoin="round">
        <polygon points="130,58 182,86 130,114 78,86" fill="#FFFFFF"/>
        <polygon points="182,86 182,150 130,178 130,114" fill="#C89B3C"/>
        <polygon points="78,86 78,150 130,178 130,114" fill="#D9E0EC"/>
      </g>
    </svg>
  );
}

const ROLE_CONFIG = {
  vendeur: {
    label: 'Vendeur',
    identifierLabel: 'Telephone du compte vendeur',
    identifierPlaceholder: '+243 8X XXX XXXX',
    inputType: 'tel' as const,
    inputMode: 'tel' as const,
    pwdLabel: 'Mot de passe',
    pwdMode: 'text' as const,
    btnText: 'Se connecter en tant que vendeur',
    hint: 'Pas encore de compte ?',
    hintLink: '/register',
    hintLinkText: 'Creer un compte gratuit',
    helpLines: [
      'Utilisez le numero de telephone enregistre lors de votre inscription.',
      'Ou cliquez sur "Utiliser mon email" si vous avez un compte email.',
    ],
    accentColor: '#C89B3C',
    accentGlow: 'rgba(200,155,60,0.4)',
    accentFaint: 'rgba(200,155,60,0.15)',
    accentBorder: 'rgba(200,155,60,0.35)',
    gradient: 'linear-gradient(135deg, #C89B3C, #a07828)',
    redirect: '/dashboard/vendeur',
  },
  livreur: {
    label: 'Livreur',
    identifierLabel: 'Numero de telephone',
    identifierPlaceholder: '+243 8X XXX XXXX',
    inputType: 'tel' as const,
    inputMode: 'tel' as const,
    pwdLabel: 'Code PIN (6 chiffres)',
    pwdMode: 'numeric' as const,
    btnText: 'Se connecter en tant que livreur',
    hint: null,
    hintLink: '',
    hintLinkText: '',
    helpLines: [
      'Votre compte est cree par votre agence.',
      'Utilisez le numero et le code PIN communiques par votre directeur.',
    ],
    accentColor: '#f97316',
    accentGlow: 'rgba(249,115,22,0.4)',
    accentFaint: 'rgba(249,115,22,0.15)',
    accentBorder: 'rgba(249,115,22,0.35)',
    gradient: 'linear-gradient(135deg, #f97316, #c2410c)',
    redirect: '/livreur',
  },
  'point-relais': {
    label: 'Point relais',
    identifierLabel: 'Numero agent (9 chiffres)',
    identifierPlaceholder: '000 000 000',
    inputType: 'text' as const,
    inputMode: 'numeric' as const,
    pwdLabel: 'Code PIN (6 chiffres)',
    pwdMode: 'numeric' as const,
    btnText: 'Se connecter en tant que point relais',
    hint: 'Devenir point relais ?',
    hintLink: '/demande-relais',
    hintLinkText: 'Faire une demande',
    helpLines: [
      'Utilisez le numero agent a 9 chiffres et le code PIN fournis par Moncolis.',
    ],
    accentColor: '#eab308',
    accentGlow: 'rgba(234,179,8,0.4)',
    accentFaint: 'rgba(234,179,8,0.15)',
    accentBorder: 'rgba(234,179,8,0.35)',
    gradient: 'linear-gradient(135deg, #eab308, #a16207)',
    redirect: '/point-relais',
  },
} as const;

type ValidRole = keyof typeof ROLE_CONFIG;
const ROLES_ORDER: ValidRole[] = ['vendeur', 'livreur', 'point-relais'];
const ROLE_ICONS: Record<ValidRole, React.ReactNode> = {
  vendeur: <Store size={18} />,
  livreur: <Truck size={18} />,
  'point-relais': <MapPin size={18} />,
};

function resolveRole(raw: string | string[] | undefined): ValidRole {
  const r = Array.isArray(raw) ? raw[0] : (raw ?? 'vendeur');
  return (r in ROLE_CONFIG ? r : 'vendeur') as ValidRole;
}

export default function LoginPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = resolveRole(params?.role);
  const cfg = ROLE_CONFIG[role];
  const isVendeur = role === 'vendeur';

  const [identifier, setIdentifier] = useState('');
  const [credential, setCredential] = useState('');
  const [showCred, setShowCred] = useState(false);
  const [useEmail, setUseEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const usePhone = isVendeur && !useEmail;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload: Record<string, string> = { role: role.replace('-', '_') };
    if (role === 'livreur') {
      payload.phone = identifier.trim();
      payload.pinCode = credential.trim();
    } else if (role === 'point-relais') {
      payload.agentNumber = identifier.trim().replace(/\s/g, '');
      payload.pinCode = credential.trim();
    } else {
      if (usePhone) { payload.phone = identifier.trim(); }
      else { payload.email = identifier.trim().toLowerCase(); }
      payload.password = credential;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Identifiant ou mot de passe incorrect.');
        setLoading(false);
        return;
      }
      try { localStorage.setItem('moncolis_last_role', role); } catch {}
      const rawRedirect = searchParams?.get('redirect') ?? '';
      const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.startsWith('/\\')
        ? rawRedirect
        : cfg.redirect;
      router.push(safeRedirect);
    } catch {
      setError('Impossible de joindre le serveur. Verifiez votre connexion.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'calc(1.5rem + env(safe-area-inset-top)) 1rem calc(1.5rem + env(safe-area-inset-bottom))',
      background: '#0F1B2D', boxSizing: 'border-box',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          fontSize: '0.85rem', color: '#64748b', textDecoration: 'none',
          alignSelf: 'flex-start', minHeight: '44px', padding: '0.25rem 0',
        }}>
          <ArrowLeft size={15} /> Retour a l&apos;accueil
        </Link>

        {/* Card */}
        <div style={{
          background: '#1B2A4A', border: '1px solid rgba(200,155,60,0.18)',
          borderRadius: '20px', padding: '1.75rem 1.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>

          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ margin: '0 auto 0.7rem', display: 'flex', justifyContent: 'center' }}>
              <MonColisLogo />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
              Mon Colis
            </h1>
            <p style={{ color: '#8899bb', fontSize: '0.81rem', margin: 0 }}>
              Connectez-vous pour continuer
            </p>
          </div>

          {/* 3 role tabs — pas d'Agence */}
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.4rem' }}>
            <legend style={{ fontSize: '0.75rem', color: '#8899bb', marginBottom: '0.55rem', fontWeight: '600' }}>
              Vous etes :
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {ROLES_ORDER.map((r) => {
                const rc = ROLE_CONFIG[r];
                const active = role === r;
                return (
                  <Link key={r} href={`/auth/${r}/login`} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '5px',
                    padding: '11px 4px',
                    borderRadius: '10px',
                    border: active ? `2px solid ${rc.accentColor}` : '1px solid rgba(255,255,255,0.1)',
                    background: active ? rc.accentFaint : 'rgba(255,255,255,0.02)',
                    color: active ? rc.accentColor : '#8899bb',
                    textDecoration: 'none',
                    fontSize: '11.5px', fontWeight: active ? '700' : '500',
                    textAlign: 'center', transition: 'all 0.18s',
                  }}>
                    {ROLE_ICONS[r]}
                    {rc.label}
                  </Link>
                );
              })}
            </div>
          </fieldset>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)',
              borderRadius: '9px', padding: '0.7rem 0.85rem', marginBottom: '0.9rem',
              fontSize: '0.81rem', color: '#fca5a5',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }} noValidate>

            {/* Identifier */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.38rem' }}>
                <label style={{ fontSize: '0.77rem', fontWeight: '600', color: '#cbd5e1' }}>
                  {isVendeur && useEmail ? 'Adresse email' : cfg.identifierLabel}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  {isVendeur && (
                    <button type="button" onClick={() => { setUseEmail(v => !v); setIdentifier(''); setError(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.69rem', color: cfg.accentColor, fontWeight: '700', padding: 0, fontFamily: 'inherit' }}>
                      {useEmail ? 'Utiliser mon numero' : 'Utiliser mon email'}
                    </button>
                  )}
                  <button type="button" onClick={() => setShowHelp(v => !v)} aria-label="En savoir plus"
                    style={{ background: showHelp ? 'rgba(255,255,255,0.08)' : 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                    <HelpCircle size={12} />
                  </button>
                </div>
              </div>

              {showHelp && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${cfg.accentBorder}`, borderRadius: '9px', padding: '0.6rem 0.8rem', marginBottom: '0.45rem', fontSize: '0.73rem', color: '#8899bb', lineHeight: 1.6 }}>
                  {cfg.helpLines.map((l, i) => <p key={i} style={{ margin: i < cfg.helpLines.length - 1 ? '0 0 0.18rem' : '0' }}>• {l}</p>)}
                </div>
              )}

              <div style={{ position: 'relative' }}>
                {(isVendeur && useEmail)
                  ? <Mail size={16} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  : role === 'point-relais'
                  ? <MapPin size={16} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  : <Phone size={16} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                }
                <input
                  type={isVendeur && useEmail ? 'email' : cfg.inputType}
                  inputMode={isVendeur && useEmail ? 'email' : cfg.inputMode}
                  placeholder={isVendeur && useEmail ? 'boutique@exemple.com' : cfg.identifierPlaceholder}
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setError(''); }}
                  required autoComplete={isVendeur && useEmail ? 'email' : 'username'}
                  className="mc-field" style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            {/* Password / PIN */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.38rem' }}>
                <label style={{ fontSize: '0.77rem', fontWeight: '600', color: '#cbd5e1' }}>{cfg.pwdLabel}</label>
                {isVendeur && (
                  <a href="#" onClick={e => { e.preventDefault(); alert('Contactez le support Moncolis via WhatsApp.'); }}
                    style={{ fontSize: '0.72rem', color: cfg.accentColor, fontWeight: '700', textDecoration: 'none' }}>
                    Mot de passe oublie ?
                  </a>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type={showCred ? 'text' : 'password'}
                  inputMode={cfg.pwdMode}
                  placeholder="••••••••"
                  value={credential}
                  onChange={e => { setCredential(e.target.value); setError(''); }}
                  required autoComplete={isVendeur ? 'current-password' : 'one-time-code'}
                  className="mc-field" style={{ paddingLeft: '2.5rem', paddingRight: '5.5rem' }}
                />
                <button type="button" onClick={() => setShowCred(v => !v)}
                  style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#C89B3C', minWidth: '52px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.73rem', fontWeight: '700', fontFamily: 'inherit' }}>
                  {showCred ? <EyeOff size={15} /> : 'Afficher'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              marginTop: '0.2rem', width: '100%', minHeight: '48px',
              borderRadius: '12px', border: 'none', fontWeight: '800', fontSize: '0.93rem',
              cursor: loading ? 'not-allowed' : 'pointer', color: '#1B2A4A',
              background: cfg.gradient, boxShadow: `0 4px 14px ${cfg.accentGlow}`,
              opacity: loading ? 0.75 : 1, transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontFamily: 'inherit',
            }}>
              {loading ? (
                <><div style={{ width: '15px', height: '15px', border: '2px solid rgba(27,42,74,0.3)', borderTopColor: '#1B2A4A', borderRadius: '50%', animation: 'mc-spin 0.8s linear infinite' }} /> Connexion en cours...</>
              ) : cfg.btnText}
            </button>
          </form>

          {cfg.hint && (
            <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.82rem', color: '#8899bb', margin: '1.2rem 0 0' }}>
              {cfg.hint}{' '}
              <Link href={cfg.hintLink} style={{ color: cfg.accentColor, fontWeight: '700', textDecoration: 'none' }}>{cfg.hintLinkText}</Link>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#3d4f6b', fontSize: '0.74rem' }}>
          <ShieldCheck size={13} /><span>Connexion chiffree SSL 256-bit</span>
        </div>
      </div>

      <style>{`
        @keyframes mc-spin { to { transform: rotate(360deg); } }
        .mc-field {
          width: 100%; height: 48px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; color: #fff; font-size: 0.94rem;
          font-family: inherit; box-sizing: border-box; outline: none;
          padding-right: 0.85rem; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .mc-field::placeholder { color: #3d4f6b; }
        .mc-field:focus { border-color: rgba(200,155,60,0.55); box-shadow: 0 0 0 3px rgba(200,155,60,0.12); }
      `}</style>
    </div>
  );
}