'use client';

import React from 'react';
import { ColisItem } from '@/lib/data-service';
import MobileStatusBadge from './MobileStatusBadge';
import { ChevronRight, MapPin, DollarSign, User, AlertTriangle } from 'lucide-react';
import { MOBILE_THEME } from './MobileDesignTokens';

interface MobilePackageCardProps {
  colis: ColisItem;
  onClick: () => void;
  formatPrice: (amountUSD: number) => string;
}

export default function MobilePackageCard({ colis, onClick, formatPrice }: MobilePackageCardProps) {
  const isProblem =
    colis.status === 'Refusé par le point relais' ||
    colis.status === 'En réclamation' ||
    colis.claimStatus === 'OPEN';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        background: isProblem ? 'rgba(239, 68, 68, 0.05)' : MOBILE_THEME.bg.card,
        border: isProblem ? '1px solid rgba(239, 68, 68, 0.35)' : `1px solid ${MOBILE_THEME.bg.border}`,
        borderRadius: MOBILE_THEME.touch.cardRadius,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        cursor: 'pointer',
        transition: 'transform 0.1s ease, border-color 0.15s ease',
        minHeight: '64px',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Ligne 1 : Nom du client + Statut immédiat */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', flexShrink: 0
          }}>
            <User size={15} />
          </div>
          <span style={{
            fontSize: '0.95rem', fontWeight: '800', color: '#ffffff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {colis.clientName || 'Client'}
          </span>
        </div>

        <MobileStatusBadge status={colis.status} size="sm" />
      </div>

      {/* Ligne 2 : Commune / Adresse + Montant + Chevron */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
          <MapPin size={13} color="#64748b" style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {colis.clientCommune || colis.clientAddress || 'Kinshasa'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#f8fafc' }}>
            {formatPrice(colis.prixColis || 0)}
          </span>
          <ChevronRight size={16} color="#64748b" />
        </div>
      </div>

      {/* Alerte discrète si réclamation ou refus */}
      {isProblem && (
        <div style={{
          fontSize: '0.72rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)',
          padding: '0.25rem 0.5rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem'
        }}>
          <AlertTriangle size={12} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {colis.claimReason || colis.refusalComment || 'Action requise sur ce colis'}
          </span>
        </div>
      )}
    </div>
  );
}
