/**
 * Moncolis Mobile Design System — Tokens
 * Cohérence graphique stricte pour interfaces mobiles vendeurs, livreurs et points relais.
 */

export const MOBILE_THEME = {
  // Couleurs de marque
  brand: {
    primary: '#22c55e',      // Vert vif pour action principale
    primaryHover: '#16a34a',
    primaryDark: '#15803d',
    primaryGlow: 'rgba(34, 197, 94, 0.25)',
    contrastText: '#000000',
  },

  // Couleurs réservées aux statuts
  status: {
    delivered: {
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.3)',
      label: 'Livré / Retiré',
    },
    inProgress: {
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      label: 'En cours',
    },
    transit: {
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      label: 'En transit',
    },
    relay: {
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)',
      label: 'Au point relais',
    },
    problem: {
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.35)',
      label: 'Problème / Refusé / Réclamation',
    },
    waiting: {
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.12)',
      border: 'rgba(148, 163, 184, 0.25)',
      label: 'En attente',
    },
  },

  // Arrière-plans sombres premium
  bg: {
    canvas: '#090d16',
    card: '#0f172a',
    cardElevated: '#1e293b',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.15)',
    navBar: 'rgba(15, 23, 42, 0.95)',
  },

  // Échelle de texte (Optimisée plein soleil et petits écrans)
  typography: {
    titleLarge: { fontSize: '1.25rem', fontWeight: '800', lineHeight: 1.25 },
    titleMedium: { fontSize: '1.05rem', fontWeight: '700', lineHeight: 1.3 },
    body: { fontSize: '0.9rem', fontWeight: '500', lineHeight: 1.45 },
    secondary: { fontSize: '0.8rem', fontWeight: '400', color: '#94a3b8', lineHeight: 1.4 },
    caption: { fontSize: '0.72rem', fontWeight: '600', letterSpacing: '0.02em' },
  },

  // Ergonomie tactile
  touch: {
    minTargetSize: '44px',
    buttonHeight: '48px',
    inputHeight: '46px',
    cardPadding: '14px',
    sheetRadius: '24px',
    cardRadius: '16px',
    buttonRadius: '12px',
  },
} as const;

export function getStatusStyle(statusString: string) {
  const s = statusString.toLowerCase();
  if (s.includes('livré') || s.includes('delivered')) {
    return MOBILE_THEME.status.delivered;
  }
  if (s.includes('réclamation') || s.includes('refusé') || s.includes('annulé') || s.includes('dispute')) {
    return MOBILE_THEME.status.problem;
  }
  if (s.includes('relais')) {
    return MOBILE_THEME.status.relay;
  }
  if (s.includes('transit') || s.includes('cours')) {
    return MOBILE_THEME.status.transit;
  }
  return MOBILE_THEME.status.waiting;
}
