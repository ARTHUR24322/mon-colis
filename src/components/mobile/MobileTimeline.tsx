'use client';

import React from 'react';
import { Check, Clock, AlertTriangle, XCircle, Truck, MapPin, CheckCircle2 } from 'lucide-react';

interface Step {
  title: string;
  subtitle?: string;
  status: 'completed' | 'current' | 'upcoming' | 'error';
  date?: string;
}

interface MobileTimelineProps {
  currentStatus: string;
  createdAt?: string;
  deliveredAt?: string | null;
  claimReason?: string | null;
  refusalComment?: string | null;
  deliveryMode?: string;
}

export default function MobileTimeline({
  currentStatus,
  createdAt,
  deliveredAt,
  claimReason,
  refusalComment,
}: MobileTimelineProps) {
  const s = currentStatus.toLowerCase();
  const isDelivered = s.includes('livré') || s.includes('retiré');
  const isDispute = s.includes('réclamation');
  const isRefused = s.includes('refusé');
  const isRelay = s.includes('relais');
  const isTransit = s.includes('transit') || isRelay;

  const steps: Step[] = [
    {
      title: 'Colis créé',
      subtitle: 'Enregistré sur Moncolis',
      status: 'completed',
      date: createdAt ? new Date(createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined,
    },
    {
      title: 'Prise en charge & Acheminement',
      subtitle: isTransit || isDelivered ? 'Pris en charge par le transporteur' : 'En attente d\'attribution agence/livreur',
      status: isTransit || isDelivered ? 'completed' : 'current',
    },
  ];

  if (isRelay) {
    steps.push({
      title: 'Point Relais',
      subtitle: s.includes('disponible') ? 'Disponible pour le retrait client' : 'Déposé au point relais',
      status: isDelivered ? 'completed' : isDispute ? 'error' : 'current',
    });
  }

  if (isDispute) {
    steps.push({
      title: 'Réclamation Vendeur en cours',
      subtitle: claimReason ? `Motif: ${claimReason}` : 'Retrait temporairement bloqué par le vendeur',
      status: 'error',
    });
  } else if (isRefused) {
    steps.push({
      title: 'Refusé par le point relais',
      subtitle: refusalComment ? `Motif: ${refusalComment}` : 'Reprise en charge par le livreur',
      status: 'error',
    });
  } else {
    steps.push({
      title: 'Livraison client',
      subtitle: isDelivered ? 'Colis remis avec code OTP' : 'En attente de remise client',
      status: isDelivered ? 'completed' : 'upcoming',
      date: deliveredAt ? new Date(deliveredAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : undefined,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;

        let iconNode = <Clock size={12} />;
        let circleBg = 'rgba(255,255,255,0.06)';
        let circleBorder = 'rgba(255,255,255,0.2)';
        let circleColor = '#94a3b8';
        let lineColor = 'rgba(255,255,255,0.1)';

        if (step.status === 'completed') {
          iconNode = <Check size={12} strokeWidth={3} />;
          circleBg = 'rgba(34, 197, 94, 0.15)';
          circleBorder = '#22c55e';
          circleColor = '#22c55e';
          lineColor = '#22c55e';
        } else if (step.status === 'current') {
          iconNode = <Truck size={12} />;
          circleBg = 'rgba(59, 130, 246, 0.2)';
          circleBorder = '#3b82f6';
          circleColor = '#60a5fa';
        } else if (step.status === 'error') {
          iconNode = <AlertTriangle size={12} />;
          circleBg = 'rgba(239, 68, 68, 0.2)';
          circleBorder = '#ef4444';
          circleColor = '#f87171';
        }

        return (
          <div key={idx} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            {/* Ligne verticale */}
            {!isLast && (
              <div
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '24px',
                  bottom: '-14px',
                  width: '2px',
                  background: lineColor,
                  opacity: 0.5,
                }}
              />
            )}

            {/* Pastille */}
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: circleBg,
                border: `2px solid ${circleBorder}`,
                color: circleColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
                zIndex: 1,
              }}
            >
              {iconNode}
            </div>

            {/* Contenu */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: step.status === 'error' ? '#f87171' : '#fff' }}>
                  {step.title}
                </span>
                {step.date && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{step.date}</span>
                )}
              </div>
              {step.subtitle && (
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  {step.subtitle}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
