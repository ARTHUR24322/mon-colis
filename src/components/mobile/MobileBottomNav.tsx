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
        background: 'rgba(5, 5, 5, 0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
              gap: '4px',
              cursor: 'pointer',
              color: isActive ? '#22c55e' : '#64748b',
              position: 'relative',
              transition: 'color 0.15s ease',
              padding: '4px 0',
              fontFamily: 'inherit',
            }}
          >
            {/* Indicateur de badge dot rouge discret (Conforme aux images) */}
            {item.badge !== undefined && item.badge !== null && item.badge !== 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: 'calc(50% - 12px)',
                  width: '6px',
                  height: '6px',
                  background: '#ef4444',
                  borderRadius: '50%',
                }}
              />
            )}

            {/* Icône */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </div>

            {/* Libellé */}
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? '700' : '500',
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
