'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook pour détecter l'état de la connexion internet en temps réel.
 * Conçu spécialement pour les environnements à réseau instable (Kinshasa / RDC).
 */
export function useOnlineStatus(): { isOnline: boolean; checkConnection: () => Promise<boolean> } {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return true;
    }

    if (!navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    // Ping rapide pour vérifier la connectivité réelle (au cas où le Wi-Fi/4G est connecté mais sans accès internet)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/manifest.json', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const online = res.ok || res.status === 304;
      setIsOnline(online);
      return online;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérification initiale
    checkConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  return { isOnline, checkConnection };
}
