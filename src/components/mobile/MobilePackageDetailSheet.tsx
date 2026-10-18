'use client';

import React, { useState } from 'react';
import { ColisItem } from '@/lib/data-service';
import MobileStatusBadge from './MobileStatusBadge';
import MobileTimeline from './MobileTimeline';
import { MOBILE_THEME } from './MobileDesignTokens';
import {
  X, Phone, MapPin, Share2, Copy, Check, AlertTriangle,
  Building2, User, Truck, DollarSign, ShieldAlert, CheckCircle2
} from 'lucide-react';

interface MobilePackageDetailSheetProps {
  colis: ColisItem | null;
  isOpen: boolean;
  onClose: () => void;
  formatPrice: (amountUSD: number) => string;
  role: 'vendeur' | 'livreur';
  onClaimSubmitted?: () => void;
  // Actions livreur
  onValidateOtp?: (otp: string) => Promise<boolean>;
  onRerouteRelais?: () => void;
  onCollectRelais?: () => void;
}

export default function MobilePackageDetailSheet({
  colis,
  isOpen,
  onClose,
  formatPrice,
  role,
  onClaimSubmitted,
  onValidateOtp,
  onRerouteRelais,
  onCollectRelais,
}: MobilePackageDetailSheetProps) {
  const [copied, setCopied] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimReason, setClaimReason] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  // Livreur OTP input
  const [otpValue, setOtpValue] = useState('');
  const [otpValidating, setOtpValidating] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  if (!isOpen || !colis) return null;

  const trackingCode = colis.trackingCode || `MC-${colis.id.slice(0, 8).toUpperCase()}`;
  const isDispute = colis.status === 'En réclamation' || colis.claimStatus === 'OPEN';
  const isAvailableAtRelay = colis.status === 'Disponible au point relais';
  const isDelivered = colis.status === 'Livré';

  const handleCopyTracking = () => {
    const trackingUrl = `${window.location.origin}/track/${colis.id}`;
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const trackingUrl = `${window.location.origin}/track/${colis.id}`;
    const text = encodeURIComponent(`Bonjour ${colis.clientName}, voici le lien de suivi de votre colis Moncolis (${trackingCode}) : ${trackingUrl}`);
    window.open(`https://wa.me/${colis.clientPhone.replace(/\D/g, '')}?text=${text}`, '_blank');
  };

  const handleOpenClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimReason.trim()) return;
    setClaimSubmitting(true);
    setClaimError(null);

    try {
      const res = await fetch(`/api/packages/${colis.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: claimReason.trim(),
          idempotencyKey: `claim-${colis.id}-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || 'Erreur lors du dépôt de la réclamation.');
      } else {
        setClaimSuccess('Réclamation enregistrée ! Le retrait par le client est immédiatement bloqué.');
        if (onClaimSubmitted) onClaimSubmitted();
        setTimeout(() => {
          setShowClaimModal(false);
          setClaimSuccess(null);
        }, 2000);
      }
    } catch {
      setClaimError('Erreur de communication avec le serveur.');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpValue.trim() || !onValidateOtp) return;
    setOtpValidating(true);
    setOtpError(null);
    try {
      const ok = await onValidateOtp(otpValue.trim());
      if (ok) {
        setOtpValue('');
        onClose();
      } else {
        setOtpError('Code OTP incorrect ou retrait bloqué.');
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Erreur lors de la validation.');
    } finally {
      setOtpValidating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* Backdrop click to close */}
      <div style={{ flex: 1 }} onClick={onClose} />

      {/* Sheet Content */}
      <div style={{
        background: '#0d1322',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        borderTopLeftRadius: MOBILE_THEME.touch.sheetRadius,
        borderTopRightRadius: MOBILE_THEME.touch.sheetRadius,
        maxHeight: '88vh',
        overflowY: 'auto',
        padding: '1.25rem 1rem 2rem',
        color: '#fff',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Poignée de tirage */}
        <div style={{
          width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)',
          borderRadius: '2px', margin: '0 auto 1rem'
        }} />

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace', fontWeight: '700' }}>
              {trackingCode}
            </span>
            <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.3rem', fontWeight: '900', color: '#ffffff' }}>
              {colis.clientName}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Statut actuel */}
        <div style={{ marginBottom: '1.25rem' }}>
          <MobileStatusBadge status={colis.status} size="md" />
        </div>

        {/* Alerte si litige / réclamation en cours */}
        {isDispute && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '12px', padding: '0.85rem', marginBottom: '1rem', display: 'flex', gap: '0.6rem',
            alignItems: 'flex-start', color: '#fca5a5', fontSize: '0.82rem'
          }}>
            <ShieldAlert size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Réclamation active :</strong> Le retrait par le client est temporairement bloqué en attendant l'arbitrage du Super Admin.
              {colis.claimReason && (
                <div style={{ marginTop: '0.3rem', color: '#fff' }}>Motif : « {colis.claimReason} »</div>
              )}
            </div>
          </div>
        )}

        {/* Section 1 : Client & Destination */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px', padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
              Destinataire
            </span>
            {colis.clientPhone && (
              <a
                href={`tel:${colis.clientPhone}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.75rem', borderRadius: '20px',
                  background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80',
                  fontSize: '0.78rem', fontWeight: '700', textDecoration: 'none'
                }}
              >
                <Phone size={13} /> Appeler
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem' }}>
            <MapPin size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: '700', color: '#f8fafc' }}>
                {colis.clientCommune || 'Kinshasa'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.1rem' }}>
                {colis.clientAddress}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 : Montants Financiers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px', padding: '0.85rem'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', display: 'block' }}>
              Prix Marchandise
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ffffff' }}>
              {formatPrice(colis.prixColis || 0)}
            </span>
            <span style={{ fontSize: '0.68rem', color: colis.paidByClient ? '#4ade80' : '#fb923c', display: 'block', marginTop: '2px' }}>
              {colis.paidByClient ? 'À percevoir au retrait' : 'Déjà payé par client'}
            </span>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px', padding: '0.85rem'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', display: 'block' }}>
              Frais Livraison
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#60a5fa' }}>
              {formatPrice(colis.deliveryPrice || colis.prixLivraison || 0)}
            </span>
            <span style={{ fontSize: '0.68rem', color: colis.isPrepaid ? '#4ade80' : '#94a3b8', display: 'block', marginTop: '2px' }}>
              {colis.isPrepaid ? 'Prépayé' : 'À la livraison'}
            </span>
          </div>
        </div>

        {/* Section 3 : Transporteur & Point Relais */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px', padding: '0.9rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
          fontSize: '0.82rem'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Acheminement
          </span>
          {colis.agence && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1' }}>
              <Building2 size={15} color="#94a3b8" /> Agence : <strong>{colis.agence}</strong>
            </div>
          )}
          {colis.livreur && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1' }}>
                <Truck size={15} color="#60a5fa" /> Livreur : <strong>{colis.livreur}</strong>
              </div>
              {colis.livreurPhone && (
                <a href={`tel:${colis.livreurPhone}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '700', fontSize: '0.75rem' }}>
                  {colis.livreurPhone}
                </a>
              )}
            </div>
          )}
          {colis.destDropPoint && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1' }}>
              <MapPin size={15} color="#4ade80" /> Point Relais : <strong>{colis.destDropPoint.name}</strong> ({colis.destDropPoint.commune})
            </div>
          )}
        </div>

        {/* Section 4 : Chronologie de vie */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px', padding: '1rem', marginBottom: '1.25rem'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
            Chronologie du Colis
          </span>
          <MobileTimeline
            currentStatus={colis.status}
            createdAt={colis.date}
            deliveredAt={colis.deliveredAt}
            claimReason={colis.claimReason}
            refusalComment={colis.refusalComment}
          />
        </div>

        {/* Section 5 : Actions selon le rôle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Vendeur : Poser une réclamation si le colis est au relais */}
          {role === 'vendeur' && isAvailableAtRelay && !isDispute && (
            <button
              onClick={() => setShowClaimModal(true)}
              style={{
                width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontWeight: '800',
                fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.5rem'
              }}
            >
              <AlertTriangle size={18} /> Poser une réclamation (Bloquer le retrait)
            </button>
          )}

          {/* Livreur : Saisie de l'OTP si en cours de livraison directe */}
          {role === 'livreur' && !isDelivered && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '14px', padding: '1rem'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#86efac', display: 'block', marginBottom: '0.5rem' }}>
                Valider la remise avec le code OTP du client :
              </span>
              <form onSubmit={handleOtpSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Code OTP client (6 chiffres)"
                  value={otpValue}
                  onChange={e => setOtpValue(e.target.value)}
                  style={{
                    flex: 1, height: '46px', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', fontSize: '1.1rem', textAlign: 'center', letterSpacing: '3px', fontWeight: '800'
                  }}
                />
                <button
                  type="submit"
                  disabled={otpValidating || !otpValue.trim()}
                  style={{
                    height: '46px', padding: '0 1.25rem', borderRadius: '10px', border: 'none',
                    background: '#22c55e', color: '#000', fontWeight: '800', fontSize: '0.9rem',
                    cursor: otpValidating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {otpValidating ? '...' : 'Valider'}
                </button>
              </form>
              {otpError && (
                <div style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: '700' }}>
                  {otpError}
                </div>
              )}
            </div>
          )}

          {/* Partage du lien de tracking */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              onClick={handleCopyTracking}
              style={{
                height: '46px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.82rem',
                fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.4rem'
              }}
            >
              {copied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
              {copied ? 'Lien copié !' : 'Copier lien suivi'}
            </button>

            <button
              onClick={handleShareWhatsApp}
              style={{
                height: '46px', borderRadius: '12px', border: 'none',
                background: '#25D366', color: '#000', fontSize: '0.82rem',
                fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.4rem'
              }}
            >
              <Share2 size={16} /> WhatsApp client
            </button>
          </div>
        </div>

        {/* MODAL: Poser une réclamation */}
        {showClaimModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}>
            <div style={{
              background: '#0f172a', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '20px',
              padding: '1.5rem', width: '100%', maxWidth: '400px', color: '#fff'
            }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: '800', color: '#f87171' }}>
                Poser une réclamation
              </h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
                Cette action bloque immédiatement le retrait du colis au point relais. Le litige sera arbitré par le Super Admin.
              </p>

              {claimError && (
                <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                  {claimError}
                </div>
              )}
              {claimSuccess && (
                <div style={{ color: '#4ade80', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                  {claimSuccess}
                </div>
              )}

              <form onSubmit={handleOpenClaim}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Motif précis de la réclamation :
                </label>
                <textarea
                  value={claimReason}
                  onChange={e => setClaimReason(e.target.value)}
                  placeholder="Ex: Erreur de destinataire, marchandise non payée, colis endommagé..."
                  required
                  rows={3}
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.85rem', marginBottom: '1rem', resize: 'none'
                  }}
                />

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    style={{
                      flex: 1, height: '44px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent', color: '#94a3b8', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={claimSubmitting}
                    style={{
                      flex: 1, height: '44px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff',
                      fontWeight: '800', fontSize: '0.82rem', cursor: claimSubmitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {claimSubmitting ? 'Enregistrement...' : 'Bloquer le colis'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
