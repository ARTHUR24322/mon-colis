'use client';

/**
 * useAuth — Hook React client-side pour gérer la session utilisateur
 * - Vérifie la session via GET /api/auth/me au montage
 * - Fournit une fonction logout() qui appelle POST /api/auth/logout
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  role: 'vendeur' | 'agence' | 'livreur' | 'admin';
  name: string;
  email?: string;
  phone?: string;
  agencyId?: string;
  driverId?: string;
}

export function useAuth(requiredRole?: string) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // ── Vérification de la session au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            setUser(null);
            // Si un rôle est requis et que la session est invalide, redirige
            if (requiredRole) {
              router.push(`/auth/${requiredRole}/login`);
            }
          }
          setLoading(false);
          setSessionChecked(true);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
          setSessionChecked(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [requiredRole, router]);

  // ── Déconnexion sécurisée
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch { /* ignore */ }
    setUser(null);
    // Redirige vers la page de connexion appropriée
    if (requiredRole) {
      router.push(`/auth/${requiredRole}/login`);
    } else {
      router.push('/');
    }
  }, [requiredRole, router]);

  return { user, loading, sessionChecked, logout };
}
