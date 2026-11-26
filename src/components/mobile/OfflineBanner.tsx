'use client';

import React from 'react';
import { WifiOff } from 'lucide-react';
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

  if (isOnline === true) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: isDark ? 'rgba(234, 88, 12, 0.18)' : '#fff7ed',
        borderBottom: isDark ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid #fed7aa',
        color: isDark ? '#fb923c' : '#c2410c',
        padding: '0.65rem 1rem',
        fontSize: '0.78rem',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        zIndex: 50,
        width: '100%',
        boxSizing: 'border-box',
        lineHeight: 1.35,
      }}
    >
      <WifiOff size={16} style={{ flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
}
