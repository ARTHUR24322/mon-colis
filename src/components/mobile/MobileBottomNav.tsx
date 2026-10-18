'use client';

import React from 'react';
import { MOBILE_THEME } from './MobileDesignTokens';

export interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface MobileBottomNavProps {
  items: MobileNavItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function MobileBottomNav({ items, activeId, onChange }: MobileBottomNavProps) {
  // Respecter la contrainte : 5 onglets maximum
  const safeItems = items.slice(0, 5);

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '62px',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {safeItems.map((item) => {
        const isActive = item.id === activeId;

        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              flex: 1,
              minWidth: '44px',
              minHeight: '48px',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              cursor: 'pointer',
              color: isActive ? MOBILE_THEME.brand.primary : '#94a3b8',
              position: 'relative',
              transition: 'transform 0.15s ease, color 0.15s ease',
              padding: '4px 0',
              fontFamily: 'inherit',
            }}
          >
            {/* Indicateur de badge numérique */}
            {item.badge !== undefined && item.badge !== null && item.badge !== 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: 'calc(50% - 18px)',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.62rem',
                  fontWeight: '800',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  minWidth: '16px',
                  textAlign: 'center',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                }}
              >
                {item.badge}
              </span>
            )}

            {/* Icône */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.15s ease',
              }}
            >
              {item.icon}
            </div>

            {/* Libellé */}
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? '800' : '600',
                letterSpacing: '0.01em',
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>

            {/* Petit point indicateur sous l'onglet actif */}
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: MOBILE_THEME.brand.primary,
                  boxShadow: `0 0 6px ${MOBILE_THEME.brand.primary}`,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
