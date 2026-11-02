'use client';

import React from 'react';
import { ColisItem } from '@/lib/data-service';
import { ChevronRight, AlertTriangle } from 'lucide-react';

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

  const isDelivered = colis.status.toLowerCase().includes('livré');
  const isTransit = colis.status.toLowerCase().includes('transit');
  const statusColor = isProblem
    ? '#ef4444'
    : isDelivered
    ? '#22c55e'
    : isTransit
    ? '#38bdf8'
    : '#fbbf24';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        background: isProblem ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '1rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        {/* Colonne gauche : Client & Ville/Commune */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '1rem', fontWeight: '700', color: '#ffffff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {colis.clientName || 'Client'}
          </div>
          <div style={{
            fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {colis.clientCommune || colis.clientAddress || 'Kinshasa'}
          </div>
        </div>

        {/* Colonne droite : Montant & Statut en texte coloré discret */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff' }}>
            {formatPrice(colis.prixColis || 0)}
          </div>
          <div style={{
            fontSize: '0.75rem', fontWeight: '600', color: statusColor, marginTop: '0.15rem'
          }}>
            {colis.status}
          </div>
        </div>
      </div>

      {/* Alerte discrète si incident */}
      {isProblem && (
        <div style={{
          fontSize: '0.72rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.08)',
          padding: '0.3rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.35rem',
          marginTop: '0.2rem'
        }}>
          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {colis.claimReason || colis.refusalComment || 'Action requise sur ce colis'}
          </span>
        </div>
      )}
    </div>
  );
}
