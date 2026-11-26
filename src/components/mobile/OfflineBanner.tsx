'use client';

import React, { useState } from 'react';
import { WifiOff, X, AlertCircle } from 'lucide-react';
import { useTheme } from '@/components/ThemeContext';

interface OfflineBannerProps {
  message?: string;
  isOnline?: boolean;
}

export default function OfflineBanner({
  message = 'Mode hors-ligne : consultation uniquement. Les actions nécessitent une connexion internet.',
  isOnline
}: OfflineBannerProps) {
  const { isDark } = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  // Si l'utilisateur est en ligne, l'icône disparaît complètement
  if (isOnline === true) {
    return null;
  }

  return (
    <>
      <style jsx>{`
        @keyframes offlinePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
      `}</style>

      {/* Icône rouge flottante qui apparaît uniquement hors-ligne */}
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        aria-label="Mode hors-ligne actif — Cliquez pour plus d'informations"
        title="Mode hors-ligne : cliquez pour voir les détails"
        style={{
          position: 'fixed',
          bottom: '84px',
          right: 'max(16px, calc((100vw - 430px) / 2 + 16px))',
          zIndex: 9990,
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          border: '2px solid rgba(255, 255, 255, 0.9)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          animation: 'offlinePulse 2s infinite',
          boxShadow: '0 6px 18px rgba(239, 68, 68, 0.5)',
          transition: 'transform 0.15s ease',
        }}
      >
        <WifiOff size={22} strokeWidth={2.5} />
      </button>

      {/* Fenêtre modale explicative au clic */}
      {showDetails && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowDetails(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '360px',
              background: isDark ? '#0f172a' : '#ffffff',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Bouton fermeture croix */}
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              aria-label="Fermer"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>

            {/* Pastille Icône rouge */}
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                marginBottom: '1rem',
              }}
            >
              <WifiOff size={28} />
            </div>

            {/* Titre */}
            <h3
              style={{
                margin: '0 0 0.5rem',
                fontSize: '1.1rem',
                fontWeight: '900',
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            >
              Connexion internet requise
            </h3>

            {/* Badge Mode Hors-Ligne */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                fontSize: '0.72rem',
                fontWeight: '800',
                marginBottom: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <AlertCircle size={12} />
              Mode hors-ligne actif
            </span>

            {/* Message explicatif */}
            <p
              style={{
                margin: '0 0 1.25rem',
                fontSize: '0.84rem',
                color: isDark ? '#cbd5e1' : '#475569',
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>

            {/* Bouton de confirmation */}
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              style={{
                width: '100%',
                minHeight: '44px',
                borderRadius: '12px',
                border: 'none',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
