'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2, ShieldCheck, Clock, DollarSign, CheckCircle2,
  AlertTriangle, RefreshCw, Lock, QrCode, ArrowRight, X, Star, MapPin
} from 'lucide-react';
import { ColisItem } from '@/lib/data-service';

interface AgencyOption {
  id: string;
  name: string;
  phone: string;
  rating: number;
  avgDeliveryHours: number;
  coverageZones: string[];
  estimatedDeliveryPrice: number;
  isEligible: boolean;
}

interface QuoteData {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  prix_marchandise: number;
  frais_livraison: number;
  montant_encaisser: number;
  paid_by_client: boolean;
  devise: string;
  taux_change: number;
  valid_until: string;
  accepted_at?: string;
  distance_km?: number;
  tarif_commune?: number;
  tarif_poids?: number;
}

interface VendorPackageQuoteAndHandoverProps {
  colis: ColisItem;
  formatPrice: (usd: number) => string;
  onRefresh?: () => void;
}

export default function VendorPackageQuoteAndHandover({
  colis,
  formatPrice,
  onRefresh,
}: VendorPackageQuoteAndHandoverProps) {
  // Quote state
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteActionLoading, setQuoteActionLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Distance state (OpenStreetMap)
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(colis.distance || null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  // Agency selection modal
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(colis.agencyId || null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  // QR Code zoom modal
  const [showQrModal, setShowQrModal] = useState(false);

  // Chargement du devis
  const loadQuote = async () => {
    if (!colis?.id) return;
    setLoadingQuote(true);
    setQuoteError(null);
    try {
      const res = await fetch(`/api/vendor/packages/${colis.id}/quote`);
      const data = await res.json();
      if (res.ok && data.quote) {
        setQuote(data.quote);
        if (data.quote.distance_km && data.quote.distance_km > 0) {
          setCalculatedDistance(data.quote.distance_km);
        }
      } else {
        setQuote(null);
      }
    } catch {
      setQuoteError('Impossible de charger le devis.');
    } finally {
      setLoadingQuote(false);
    }
  };

  // Chargement des agences éligibles
  const loadAgencies = async () => {
    setLoadingAgencies(true);
    try {
      const commune = encodeURIComponent(colis.clientCommune || '');
      const poids = encodeURIComponent(colis.poids || 1);
      const res = await fetch(`/api/vendor/agencies?commune=${commune}&poids=${poids}`);
      const data = await res.json();
      if (res.ok && data.agencies) {
        setAgencies(data.agencies);
      }
    } catch {
      console.error('Erreur chargement agences');
    } finally {
      setLoadingAgencies(false);
    }
  };

  useEffect(() => {
    loadQuote();
  }, [colis.id]);

  // Calcul OpenStreetMap du trajet et de la distance
  const handleCalculateDistance = async () => {
    setDistanceLoading(true);
    setDistanceError(null);
    try {
      const from = encodeURIComponent(colis.vendeurAddress || 'Gombe, Kinshasa');
      const to = encodeURIComponent(colis.clientAddress || colis.clientCommune || '');
      const communeTo = encodeURIComponent(colis.clientCommune || '');
      const res = await fetch(`/api/distance?from=${from}&to=${to}&communeTo=${communeTo}`);
      const data = await res.json();
      if (res.ok && data.distanceKm) {
        setCalculatedDistance(data.distanceKm);
        await handleGenerateQuote(data.distanceKm);
      } else {
        setDistanceError(data.error || 'Erreur lors du calcul OpenStreetMap.');
      }
    } catch {
      setDistanceError('Erreur réseau lors du calcul.');
    } finally {
      setDistanceLoading(false);
    }
  };

  const handleGenerateQuote = async (distOverride?: number) => {
    setQuoteActionLoading(true);
    setQuoteError(null);
    try {
      const distanceKm = typeof distOverride === 'number' ? distOverride : (calculatedDistance || 0);
      const res = await fetch(`/api/vendor/packages/${colis.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', distanceKm }),
      });
      const data = await res.json();
      if (res.ok && data.quote) {
        setQuote(data.quote);
        if (onRefresh) onRefresh();
      } else {
        setQuoteError(data.error || 'Erreur lors de la génération du devis.');
      }
    } catch {
      setQuoteError('Erreur réseau.');
    } finally {
      setQuoteActionLoading(false);
    }
  };

  const handleAcceptQuote = async () => {
    setQuoteActionLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch(`/api/vendor/packages/${colis.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      const data = await res.json();
      if (res.ok && data.quote) {
        setQuote(data.quote);
        if (onRefresh) onRefresh();
      } else {
        setQuoteError(data.error || 'Erreur lors de l\'acceptation.');
      }
    } catch {
      setQuoteError('Erreur réseau.');
    } finally {
      setQuoteActionLoading(false);
    }
  };

  const handleAssignAgency = async (agencyId: string | null) => {
    setAssignLoading(true);
    setAssignMessage(null);
    try {
      const res = await fetch(`/api/vendor/packages/${colis.id}/assign-agency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssignMessage('Attribution enregistrée avec succès.');
        setTimeout(() => {
          setShowAgencyModal(false);
          setAssignMessage(null);
          if (onRefresh) onRefresh();
          loadQuote();
        }, 1500);
      } else {
        setAssignMessage(data.error || 'Erreur lors de l\'attribution.');
      }
    } catch {
      setAssignMessage('Erreur réseau.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Le vendeur peut changer d'agence tant que le colis n'est pas pris en charge
  const canChangeAgency = ['Créé', "En attente d'agence", "Décliné par l'agence", 'CREATED', 'PENDING_AGENCY', 'REJECTED_BY_AGENCY', 'QUOTE_PENDING'].includes(colis.status as string);
  const isQuoteAccepted = quote && quote.status === 'ACCEPTED';
  const isRejectedByAgency = (colis.status as string) === "Décliné par l'agence" || (colis.status as string) === 'REJECTED_BY_AGENCY' || colis.rawStatus === 'REJECTED_BY_AGENCY';
  const handoverCode = colis.trackingCode || `MC-${colis.id.slice(0, 8).toUpperCase()}`;

  // QR Code Data payload
  const qrPayload = JSON.stringify({
    type: 'HANDOVER',
    packageId: colis.id,
    trackingCode: handoverCode,
    quoteId: quote?.id,
    vendeurId: colis.vendeurId,
  });

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrPayload)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>

      {/* ── 1. SECTION ATTRIBUTION AGENCE ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px', padding: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Agence de livraison
          </span>
          {canChangeAgency && (
            <button
              onClick={() => {
                loadAgencies();
                setShowAgencyModal(true);
              }}
              style={{
                fontSize: '0.75rem', fontWeight: '700', color: '#f59e0b',
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                padding: '0.25rem 0.6rem', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              {colis.agence ? 'Changer d\'agence' : 'Choisir une agence'}
            </button>
          )}
        </div>

        {isRejectedByAgency && (
          <div style={{
            padding: '0.65rem 0.75rem', borderRadius: '10px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: '0.8rem', marginBottom: '0.6rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>L'agence a décliné ce colis. Veuillez choisir une autre agence disponible.</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Building2 size={18} color="#f59e0b" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '800', fontSize: '0.92rem', color: '#fff' }}>
              {colis.agence || (colis.status === "En attente d'agence" ? 'Toutes agences (En attente de prise)' : 'Aucune agence assignée')}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              {colis.status === 'Accepté' && <span style={{ color: '#4ade80', fontWeight: '700' }}>Accepté par l'agence</span>}
              {colis.status === "En attente d'agence" && <span style={{ color: '#fcd34d' }}>En attente de confirmation agence</span>}
              {colis.status === "Décliné par l'agence" && <span style={{ color: '#f87171' }}>Décliné par l'agence</span>}
              {!['Accepté', "En attente d'agence", "Décliné par l'agence", 'Créé'].includes(colis.status) && (
                <span>Prise en charge active</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. SECTION DEVIS AVANT REMISE ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px', padding: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Devis & Conditions financières
          </span>
          {quote && (
            <span style={{
              fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px',
              background: isQuoteAccepted ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: isQuoteAccepted ? '#4ade80' : '#f59e0b',
            }}>
              {isQuoteAccepted ? 'Devis validé' : 'En attente d\'accord'}
            </span>
          )}
        </div>

        {quoteError && (
          <div style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{quoteError}</div>
        )}

        {/* ── Calcul d'itinéraire OpenStreetMap ── */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '12px',
          padding: '0.75rem',
          marginBottom: '0.85rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={13} color="#60a5fa" /> Itinéraire OpenStreetMap (Kinshasa)
            </span>
            {calculatedDistance && (
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#4ade80' }}>
                📍 {calculatedDistance} km
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Trajet : <strong>{colis.vendeurAddress || 'Départ Agence / Vendeur'}</strong> → <strong>{colis.clientCommune || colis.clientAddress || 'Client'}</strong>
          </div>

          {distanceError && (
            <div style={{ color: '#f87171', fontSize: '0.72rem', marginBottom: '0.4rem' }}>
              {distanceError}
            </div>
          )}

          <button
            type="button"
            onClick={handleCalculateDistance}
            disabled={distanceLoading || quoteActionLoading}
            style={{
              width: '100%',
              minHeight: '36px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: '#fff',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: distanceLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {distanceLoading ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Calcul du trajet via OpenStreetMap...
              </>
            ) : calculatedDistance ? (
              <>
                <RefreshCw size={13} /> Recalculer l'itinéraire OpenStreetMap ({calculatedDistance} km)
              </>
            ) : (
              <>
                <MapPin size={14} /> Cliquer pour calculer le trajet & tarif kilométrique (OpenStreetMap)
              </>
            )}
          </button>
        </div>

        {loadingQuote ? (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.5rem 0' }}>Chargement du devis...</div>
        ) : quote ? (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
              background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '0.75rem', marginBottom: '0.75rem',
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '700' }}>Marchandise</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#fff' }}>
                  {formatPrice(quote.prix_marchandise)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '700' }}>Livraison</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#60a5fa' }}>
                  {formatPrice(quote.frais_livraison)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '700' }}>À encaisser (COD)</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: quote.paid_by_client ? '#4ade80' : '#94a3b8' }}>
                  {quote.paid_by_client ? formatPrice(quote.montant_encaisser) : '$0 (Prépayé)'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: 1.4 }}>
              Taux appliqué : <strong>1 USD = {quote.taux_change} FC</strong> &bull; Validité du devis : 24 heures
              {quote.distance_km ? ` • Distance : ${quote.distance_km} km` : ''}
            </div>

            {!isQuoteAccepted && (
              <button
                type="button"
                onClick={handleAcceptQuote}
                disabled={quoteActionLoading}
                style={{
                  width: '100%', minHeight: '44px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#000', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                }}
              >
                <CheckCircle2 size={16} />
                {quoteActionLoading ? 'Validation en cours...' : 'Accepter ce devis et débloquer le QR code'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              Devis en attente. Calculez l&apos;itinéraire ci-dessus ou générez le devis directement.
            </p>
            <button
              type="button"
              onClick={() => handleGenerateQuote()}
              disabled={quoteActionLoading}
              style={{
                minHeight: '38px', padding: '0 1rem', borderRadius: '8px', border: 'none',
                background: '#3b82f6', color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              {quoteActionLoading ? 'Calcul...' : 'Calculer le devis du colis'}
            </button>
          </div>
        )}
      </div>

      {/* ── 3. SECTION QR CODE DE REMISE PHYSIQUE ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px', padding: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            QR Code de Remise (Relais / Livreur)
          </span>
          <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#94a3b8' }}>
            {handoverCode}
          </span>
        </div>

        {isQuoteAccepted ? (
          <div style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <div
              onClick={() => setShowQrModal(true)}
              style={{
                background: '#fff', padding: '8px', borderRadius: '12px', cursor: 'pointer',
                marginBottom: '0.6rem', boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src={qrImageUrl}
                alt="QR Code Remise"
                style={{ width: '130px', height: '130px', display: 'block' }}
              />
            </div>

            <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
              Présentez ce QR Code au Point Relais ou au livreur pour valider la prise en charge.
            </p>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              style={{
                fontSize: '0.75rem', fontWeight: '700', color: '#60a5fa',
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                padding: '0.35rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              Agrandir en plein écran
            </button>
          </div>
        ) : (
          <div style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1.25rem 1rem',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={20} color="#94a3b8" />
            </div>
            <strong style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>QR Code de remise verrouillé</strong>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', maxWidth: '300px', lineHeight: 1.4 }}>
              Vous devez impérativement valider le devis ci-dessus pour activer le QR code de remise.
            </p>
          </div>
        )}
      </div>

      {/* ── MODAL AGRANDISSEMENT QR CODE ── */}
      {showQrModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px',
            padding: '1.5rem', width: '100%', maxWidth: '340px', textAlign: 'center', color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#cbd5e1' }}>Code de remise</span>
              <button
                onClick={() => setShowQrModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: '#fff', padding: '12px', borderRadius: '16px', display: 'inline-block',
              marginBottom: '1rem', boxShadow: '0 0 30px rgba(74,222,128,0.2)',
            }}>
              <img
                src={qrImageUrl}
                alt="QR Code Remise"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: '900', letterSpacing: '2px', color: '#4ade80', marginBottom: '0.5rem' }}>
              {handoverCode}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
              Faites scanner ce code au guichet du point relais ou par le coursier.
            </p>
          </div>
        </div>
      )}

      {/* ── MODAL CHOIX D'AGENCE ── */}
      {showAgencyModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px',
            padding: '1.25rem', width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto', color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>
                  Choisir une agence
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>
                  Zone de destination : <strong>{colis.clientCommune || 'Kinshasa'}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowAgencyModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {assignMessage && (
              <div style={{
                padding: '0.65rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.8rem',
                background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)',
              }}>
                {assignMessage}
              </div>
            )}

            {/* Option "Laisser les agences se positionner" */}
            <div
              onClick={() => handleAssignAgency(null)}
              style={{
                padding: '0.85rem', borderRadius: '12px', marginBottom: '0.75rem',
                background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(245,158,11,0.4)',
                cursor: assignLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#fcd34d' }}>
                  Laisser les agences se positionner
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  Le colis reste ouvert aux agences agréées jusqu'à ce qu'une agence l'accepte.
                </div>
              </div>
              <ArrowRight size={16} color="#fcd34d" />
            </div>

            {/* Liste des agences éligibles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {loadingAgencies ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Recherche des agences disponibles...
                </div>
              ) : agencies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Aucune agence active ne couvre cette commune pour le moment.
                </div>
              ) : (
                agencies.map((agency) => (
                  <div
                    key={agency.id}
                    onClick={() => handleAssignAgency(agency.id)}
                    style={{
                      padding: '0.85rem', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      cursor: assignLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#fff' }}>
                          {agency.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#fbbf24' }}>
                            <Star size={12} fill="#fbbf24" /> {agency.rating}
                          </span>
                          <span>&bull;</span>
                          <span>Délai moyen: ~{agency.avgDeliveryHours}h</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#4ade80' }}>
                          {formatPrice(agency.estimatedDeliveryPrice)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Tarif estimé</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
