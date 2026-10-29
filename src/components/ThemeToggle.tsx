"use client";

import React from 'react';
import { useTheme } from './ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? 'Basculer en mode sombre' : 'Basculer en mode clair'}
      aria-label="Basculer le thème"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        height: '38px',
        padding: showLabel ? '0 12px' : '0 10px',
        borderRadius: '12px',
        border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.12)',
        background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
        color: isLight ? '#0f172a' : '#f8fafc',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '0.8rem',
        transition: 'all 0.2s ease',
      }}
    >
      {isLight ? (
        <Moon size={16} color="#475569" style={{ display: 'block' }} />
      ) : (
        <Sun size={16} color="#fbbf24" style={{ display: 'block' }} />
      )}
      {showLabel && (
        <span>{isLight ? 'Sombre' : 'Clair'}</span>
      )}
    </button>
  );
}
