'use client';

import React from 'react';
import { getStatusStyle } from './MobileDesignTokens';
import { CheckCircle2, Clock, Truck, MapPin, AlertTriangle, XCircle } from 'lucide-react';

interface MobileStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function MobileStatusBadge({ status, size = 'md' }: MobileStatusBadgeProps) {
  const style = getStatusStyle(status);

  const getIcon = () => {
    const s = status.toLowerCase();
    const iconSize = size === 'sm' ? 12 : 14;
    if (s.includes('livré')) return <CheckCircle2 size={iconSize} />;
    if (s.includes('réclamation') || s.includes('dispute')) return <AlertTriangle size={iconSize} />;
    if (s.includes('refusé') || s.includes('annulé')) return <XCircle size={iconSize} />;
    if (s.includes('relais')) return <MapPin size={iconSize} />;
    if (s.includes('transit')) return <Truck size={iconSize} />;
    return <Clock size={iconSize} />;
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: size === 'sm' ? '0.2rem 0.5rem' : '0.3rem 0.65rem',
        borderRadius: '20px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: size === 'sm' ? '0.72rem' : '0.78rem',
        fontWeight: '700',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{getIcon()}</span>
      <span>{status}</span>
    </span>
  );
}
