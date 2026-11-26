/**
 * offline-storage.ts
 * Gestionnaire de stockage local sécurisé pour consultation hors-ligne (Vendeur, Livreur, Point Relais).
 *
 * RÈGLES DE SÉCURITÉ STRICTES :
 * - Aucun OTP, code de retrait (pickupCode), code PIN, mot de passe ou jeton d'accès n'est stocké en local.
 * - Les données sont associées au userId de la session et sont purgées à la déconnexion.
 * - Le mode hors-ligne est STRICTEMENT en lecture seule (consultation des colis, tournées, stocks).
 * - Code écrit en TypeScript strict (zéro `any`).
 */

import { ColisItem } from './data-service';

const STORAGE_PREFIX = 'moncolis_offline_';
const SESSION_CACHE_KEY = 'moncolis_offline_session';

/**
 * Nettoie un colis avant stockage local pour éliminer tout code sensible (OTP, PIN, token).
 */
export function sanitizePackageForOffline(pkg: ColisItem): ColisItem {
  return {
    ...pkg,
    otp: '', // Interdiction formelle de stocker le code OTP de validation
    pickupCode: null, // Interdiction de stocker le code de retrait point relais
  };
}

/**
 * Nettoie une liste de colis pour le cache hors-ligne.
 */
export function sanitizePackagesForOffline(packages: readonly ColisItem[]): ColisItem[] {
  return packages.map(sanitizePackageForOffline);
}

/**
 * Sauvegarde des données dans le cache local de l'utilisateur.
 */
export function saveOfflineData<T>(userId: string, key: string, data: T): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const storageKey = `${STORAGE_PREFIX}${userId}_${key}`;
    const payload = JSON.stringify({
      savedAt: new Date().toISOString(),
      data,
    });
    localStorage.setItem(storageKey, payload);
  } catch (err) {
    console.warn('[OfflineStorage] Erreur de sauvegarde locale:', err);
  }
}

/**
 * Récupère des données depuis le cache local de l'utilisateur.
 */
export function getOfflineData<T>(userId: string, key: string): T | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const storageKey = `${STORAGE_PREFIX}${userId}_${key}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: string; data: T };
    return parsed.data ?? null;
  } catch (err) {
    console.warn('[OfflineStorage] Erreur de lecture locale:', err);
    return null;
  }
}

/**
 * Sauvegarde la session publique de l'utilisateur (sans mot de passe ni token) pour permettre l'accès hors-ligne.
 */
export function saveOfflineSession<T extends { id: string; role: string; name: string }>(user: T): void {
  if (typeof window === 'undefined' || !user.id) return;
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('[OfflineStorage] Erreur sauvegarde session:', err);
  }
}

/**
 * Récupère la session mise en cache hors-ligne.
 */
export function getOfflineSession<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Purge intégrale de toutes les données hors-ligne de l'utilisateur à la déconnexion.
 */
export function purgeUserOfflineData(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    // Supprimer la session en cache
    localStorage.removeItem(SESSION_CACHE_KEY);

    // Supprimer toutes les clés appartenant au préfixe ou à l'utilisateur
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        if (!userId || key.startsWith(`${STORAGE_PREFIX}${userId}_`)) {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[OfflineStorage] Erreur lors de la purge locale:', err);
  }
}
