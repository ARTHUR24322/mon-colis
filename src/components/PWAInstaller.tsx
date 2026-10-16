'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Register service worker if supported
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration skipped/failed:', err);
      });
    }

    // Check if already running in standalone mode (already installed)
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    
    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // Check if dismissed previously
    const dismissedAt = localStorage.getItem('moncolis_pwa_dismissed');
    if (dismissedAt) {
      const hoursPassed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (hoursPassed < 72) return; // Don't annoy user for 3 days
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // Show for iOS after 3 seconds on mobile
      const timer = setTimeout(() => setShowPrompt(true), 2500);
      return () => clearTimeout(timer);
    }

    // Handle Chromium beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSModal(false);
    localStorage.setItem('moncolis_pwa_dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <>
      {/* Floating App Install Banner (Mobile Ergonomics) */}
      <aside 
        aria-label="Installation de l'application"
        style={{
          position: 'fixed',
          top: '12px',
          left: '12px',
          right: '12px',
          maxWidth: '460px',
          margin: '0 auto',
          background: 'rgba(11, 15, 25, 0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(34, 197, 94, 0.15)',
          borderRadius: '16px',
          padding: '0.75rem 0.9rem',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'slideDownFade 0.4s ease-out'
        }}
      >
        {/* App Icon */}
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #0b0f19, #020408)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)'
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="Moncolis" width="34" height="34" style={{ borderRadius: '8px' }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.88rem',
            fontWeight: '800',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            lineHeight: 1.2
          }}>
            Installer Moncolis
            <span style={{
              fontSize: '0.62rem',
              fontWeight: '700',
              padding: '0.1rem 0.4rem',
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#4ade80',
              borderRadius: '999px',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              App Mobile
            </span>
          </div>
          <div style={{
            fontSize: '0.72rem',
            color: '#94a3b8',
            marginTop: '0.15rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            Rapide, fluide et sans barre d'adresse
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleInstallClick}
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#000',
            fontWeight: '800',
            fontSize: '0.78rem',
            padding: '0.5rem 0.85rem',
            borderRadius: '10px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)'
          }}
        >
          <Download size={14} strokeWidth={2.5} />
          Installer
        </button>

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          aria-label="Fermer"
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <X size={16} />
        </button>
      </aside>

      {/* iOS Instruction Bottom Sheet */}
      {showIOSModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            background: '#0b0f19',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '24px 24px 0 0',
            padding: '1.75rem 1.5rem 2.5rem',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Smartphone size={22} color="#4ade80" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
                  Installer sur iPhone / iPad
                </h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Pour installer Moncolis comme une vraie application sur votre écran d&apos;accueil :
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.9rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60a5fa',
                  flexShrink: 0
                }}>
                  <Share size={18} />
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                  1. Appuyez sur le bouton <strong>Partager</strong> en bas de Safari.
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.9rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4ade80',
                  flexShrink: 0
                }}>
                  <PlusSquare size={18} />
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                  2. Faites défiler et choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Compris !
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideDownFade {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
