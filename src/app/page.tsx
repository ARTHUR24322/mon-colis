'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package, Search, ArrowRight, ChevronRight, LogIn,
} from 'lucide-react';

export default function HomeEntryPage() {
  const router = useRouter();
  const [trackingCode, setTrackingCode] = useState('');
  const [lastRole, setLastRole] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState(false);

  useEffect(() => {
    // 1. Lire le dernier espace utilisé dans localStorage (jamais de données sensibles, juste le rôle)
    try {
      const stored = localStorage.getItem('moncolis_last_role');
      // NB: 'agence' est exclu — l'espace agence n'est pas accessible depuis la page publique
      if (stored && ['vendeur', 'livreur', 'point-relais'].includes(stored)) {
        setLastRole(stored);

        // 2. Détection PWA installée (standalone) : si ouverte depuis l'écran d'accueil, aller directement à la connexion du rôle
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) {
          router.replace(`/auth/${stored}/login`);
        }
      }
    } catch {
      // Ignorer si localStorage non disponible
    }
  }, [router]);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackingCode.trim();
    if (code) {
      router.push(`/track/${encodeURIComponent(code)}`);
    } else {
      setTrackingError(true);
      setTimeout(() => setTrackingError(false), 2000);
    }
  };

  const handleLogin = () => {
    router.push('/auth/vendeur/login');
  };

  return (
    <main style={{
      minHeight: '100dvh',
      height: '100dvh',
      background: 'radial-gradient(circle at 50% 15%, rgba(34, 197, 94, 0.08), transparent 50%), #07090e',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px))',
      maxWidth: '430px',
      margin: '0 auto',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* ─── 1. HAUT : LOGO & TITRE ─── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)'
            }}>
              <Package size={20} strokeWidth={2.5} />
            </div>
            <div>
              <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em', lineHeight: 1, display: 'block' }}>
                Moncolis
              </span>
              <span style={{ fontSize: '0.62rem', color: '#4ade80', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Kinshasa
              </span>
            </div>
          </div>

          <Link
            href="/decouvrir"
            style={{
              fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8',
              textDecoration: 'none', padding: '0.35rem 0.65rem',
              borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            En savoir plus →
          </Link>
        </div>

        {/* ─── 2. SUIVI DE COLIS EXPRESS (POUR DESTINATAIRES SANS COMPTE) ─── */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '0.65rem 0.75rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Search size={12} color="#60a5fa" />
            <span>Destinataire ? Suivez votre colis sans compte :</span>
          </div>
          <form onSubmit={handleTrack} style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              placeholder="Ex: MC-000044 ou code suivi..."
              value={trackingCode}
              onChange={e => setTrackingCode(e.target.value)}
              style={{
                flex: 1,
                minHeight: '40px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.4)',
                border: trackingError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.85rem',
                padding: '0 0.65rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                minHeight: '40px',
                padding: '0 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontWeight: '800',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              Suivre
            </button>
          </form>
        </div>

        {/* Reprise rapide si dernier espace mémorisé */}
        {lastRole && (
          <div style={{ marginBottom: '0.65rem' }}>
            <button
              onClick={() => router.push(`/auth/${lastRole}/login`)}
              style={{
                width: '100%',
                minHeight: '46px',
                borderRadius: '12px',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.08))',
                color: '#86efac',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1rem',
              }}
            >
              <span>Continuer dans mon espace <strong>{lastRole.toUpperCase()}</strong></span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ─── 3. CENTRE : BOUTON SE CONNECTER ─── */}
      <div style={{ margin: '0.5rem 0' }}>
        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            minHeight: '54px',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff',
            fontWeight: '800',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem',
            boxShadow: '0 6px 20px rgba(34,197,94,0.35)',
            transition: 'opacity 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
            letterSpacing: '-0.01em',
          }}
        >
          <LogIn size={20} />
          Se connecter
        </button>
      </div>

      {/* ─── 4. BAS : S'INSCRIRE & LIEN PRÉSENTATION ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <span>Nouveau sur Moncolis ?</span>
          <Link
            href="/register"
            style={{ color: '#4ade80', fontWeight: '800', textDecoration: 'none' }}
          >
            Créer un compte vendeur
          </Link>
        </div>

        <Link
          href="/decouvrir"
          style={{
            fontSize: '0.78rem', color: '#64748b', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
            padding: '0.4rem'
          }}
        >
          <span>Découvrir toutes les fonctionnalités</span>
          <ChevronRight size={13} />
        </Link>
      </div>
    </main>
  );
}
