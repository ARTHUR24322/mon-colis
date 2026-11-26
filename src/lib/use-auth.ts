'use client';

/**
 * useAuth — Hook React client-side pour gérer la session utilisateur
 * - Vérifie la session via GET /api/auth/me au montage
 * - Fournit une fonction logout() qui appelle POST /api/auth/logout
 * - Redirige vers /login si la session est invalide et qu'un rôle est requis
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveOfflineSession, getOfflineSession, purgeUserOfflineData } from '@/lib/offline-storage';

export type UserRole = 'vendeur' | 'agence' | 'livreur' | 'point_relais' | 'superadmin';

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  email?: string;
  phone?: string;
  agencyId?: string;
  agencyRole?: string; // directeur, gestionnaire, agent_comptoir, comptable, lecture_seule
  driverId?: string;
  // Point Relais
  agentNumber?: string;
  dropPointId?: string;
  dropPointName?: string;
  dropPointCommune?: string;
}

// Mapping rôle → URL de login
const ROLE_LOGIN_URLS: Record<string, string> = {
  vendeur:      '/login',
  agence:       '/agence/login',
  livreur:      '/livreur',
  point_relais: '/point-relais',
  superadmin:   '/admin-x9k2',
};

export function useAuth(requiredRole?: UserRole | string) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // -- Vérification de la session au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            const authUser = data.user as AuthUser;
            setUser(authUser);
            // Sauvegarder la session minimale (sans token ni mot de passe) pour consultation hors-ligne
            saveOfflineSession(authUser);
          } else {
            setUser(null);
            purgeUserOfflineData();
            // Si un rôle est requis et que la session est invalide, redirige vers la bonne page
            if (requiredRole) {
              const loginUrl = ROLE_LOGIN_URLS[requiredRole] ?? '/login';
              router.push(loginUrl);
            }
          }
          setLoading(false);
          setSessionChecked(true);
        }
      } catch {
        if (!cancelled) {
          // En cas de panne réseau ou mode hors-ligne, restaurer la session locale consultable
          const cachedUser = getOfflineSession<AuthUser>();
          if (cachedUser && (!requiredRole || cachedUser.role === requiredRole)) {
            setUser(cachedUser);
          } else {
            setUser(null);
            if (requiredRole) {
              const loginUrl = ROLE_LOGIN_URLS[requiredRole] ?? '/login';
              router.push(loginUrl);
            }
          }
          setLoading(false);
          setSessionChecked(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [requiredRole, router]);

  // -- Déconnexion sécurisée (purge immédiate du cache local)
  const logout = useCallback(async () => {
    // Purger toutes les données hors-ligne de cet utilisateur
    purgeUserOfflineData(user?.id);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch { /* ignore */ }
    setUser(null);
    // Redirige vers la page de connexion appropriée selon le rôle
    const loginUrl = requiredRole ? (ROLE_LOGIN_URLS[requiredRole] ?? '/login') : '/login';
    router.push(loginUrl);
  }, [requiredRole, router, user?.id]);

  return { user, loading, sessionChecked, logout };
}
