'use client';

import React, { useState } from 'react';
import {
  QrCode, Search, CheckCircle2, AlertTriangle, X, ShieldAlert,
  Package, User, MapPin, DollarSign, Check, AlertCircle, ArrowRight
} from 'lucide-react';

interface DropPointHandoverScannerProps {
  dropPointId: string;
  agentId: string;
  agentName: string;
  onSuccess: () => void;
  formatPrice?: (usd: number) => string;
}

interface PackageVerificationData {
  found: boolean;
  package: {
    id: string;
    trackingCode: string;
    status: string;
    clientName: string;
    clientPhone: string;
    clientCommune: string;
    vendeurName: string;
    vendeurPhone: string;
    weight: number;
    packagePrice: number;
    paidByClient: boolean;
    isPrepaid: boolean;
    deliveryMode: string;
    montantAEncaisser: number;
    devise: string;
  };
  checks: {
    isAssignedToThisRelay: boolean;
    hasAcceptedQuote: boolean;
    canAcceptHandover: boolean;
    alreadyDeposited: boolean;
  };
}

const REFUSAL_REASONS = [
  { value: 'DAMAGED_PARCEL', label: 'Colis détérioré ou emballage déchiré' },
  { value: 'NON_COMPLIANT_DIMENSIONS', label: 'Poids ou volume non conforme' },
  { value: 'UNSEALED_PACKAGE', label: 'Colis non scellé / emballage précaire' },
  { value: 'LEAKING_OR_SUSPICIOUS', label: 'Liquide fuyant ou contenu suspect' },
  { value: 'DESTINATION_MISMATCH', label: 'Erreur manifeste de destination' },
  { value: 'OTHER', label: 'Autre motif spécifique' },
];

export default function DropPointHandoverScanner({
  dropPointId,
  agentId,
  agentName,
  onSuccess,
  formatPrice = (val) => `$${val.toFixed(2)}`,
}: DropPointHandoverScannerProps) {
  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [data, setData] = useState<PackageVerificationData | null>(null);

  // Conformité & validation
  const [isConditionChecked, setIsConditionChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Modal de refus
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [refusalReason, setRefusalReason] = useState('DAMAGED_PARCEL');
  const [refusalNotes, setRefusalNotes] = useState('');

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setData(null);
    setSubmitSuccess(null);
    setSubmitError(null);
    setIsConditionChecked(false);

    try {
      const res = await fetch(
        `/api/drop-points/scan-handover?code=${encodeURIComponent(code.trim())}&dropPointId=${encodeURIComponent(dropPointId)}`
      );
      const json = await res.json();

      if (!res.ok || !json.found) {
        setSearchError(json.error || 'Aucun colis trouvé pour ce code.');
      } else {
        setData(json);
      }
    } catch {
      setSearchError('Erreur de connexion au serveur.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAcceptHandover = async () => {
    if (!data || !isConditionChecked) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/drop-points/scan-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: data.package.id,
          dropPointId,
          agentId,
          agentName,
          action: 'ACCEPT',
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setSubmitError(resData.error || 'Erreur lors de la validation.');
      } else {
        setSubmitSuccess(resData.message || 'Colis pris en charge avec succès au point relais.');
        setTimeout(() => {
          setData(null);
          setCode('');
          setSubmitSuccess(null);
          onSuccess();
        }, 2200);
      }
    } catch {
      setSubmitError('Erreur réseau lors de la validation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRefusal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const reasonLabel = REFUSAL_REASONS.find(r => r.value === refusalReason)?.label || refusalReason;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/drop-points/scan-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: data.package.id,
          dropPointId,
          agentId,
          agentName,
          action: 'REFUSE',
          refusalReason: reasonLabel,
          notes: refusalNotes.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setSubmitError(resData.error || 'Erreur lors du refus.');
      } else {
        setShowRefusalModal(false);
        setSubmitSuccess('Colis refusé. Le vendeur a été alerté immédiatement.');
        setTimeout(() => {
          setData(null);
          setCode('');
          setSubmitSuccess(null);
          onSuccess();
        }, 2200);
      }
    } catch {
      setSubmitError('Erreur réseau lors de l\'enregistrement du refus.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '1.25rem',
      color: '#fff',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <QrCode size={18} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>
              Réception Remise Vendeur (Premier Kilomètre)
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
              Scannez le QR code ou saisissez le code du colis
            </p>
          </div>
        </div>
      </div>

      {/* Saisie ou scan du code */}
      <form onSubmit={handleVerify} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ex: MC-8F2A19 ou coller le contenu du QR..."
          style={{
            flex: 1, minHeight: '44px', borderRadius: '10px',
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)',
            padding: '0 0.85rem', color: '#fff', fontSize: '0.9rem',
          }}
        />
        <button
          type="submit"
          disabled={isSearching || !code.trim()}
          style={{
            minHeight: '44px', padding: '0 1rem', borderRadius: '10px', border: 'none',
            background: '#10b981', color: '#000', fontWeight: '800', fontSize: '0.85rem',
            cursor: isSearching || !code.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}
        >
          {isSearching ? 'Vérification...' : <><Search size={16} /> Vérifier</>}
        </button>
      </form>

      {searchError && (
        <div style={{
          padding: '0.75rem', borderRadius: '10px',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#f87171', fontSize: '0.82rem', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <AlertCircle size={16} /> {searchError}
        </div>
      )}

      {submitSuccess && (
        <div style={{
          padding: '0.85rem', borderRadius: '10px',
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
          color: '#4ade80', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <CheckCircle2 size={18} /> {submitSuccess}
        </div>
      )}

      {/* Résultat de la vérification */}
      {data && data.package && (
        <div style={{
          background: '#0d1322',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: '1rem',
          marginTop: '0.75rem',
        }}>
          {/* Header colis */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code Suivi</span>
              <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#60a5fa' }}>{data.package.trackingCode}</div>
            </div>
            <span style={{
              padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
              background: 'rgba(255,255,255,0.08)', color: '#cbd5e1'
            }}>
              Statut: {data.package.status}
            </span>
          </div>

          {/* Alertes de conformité / devis */}
          {!data.checks.hasAcceptedQuote && (
            <div style={{
              padding: '0.75rem', borderRadius: '8px',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.75rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <AlertTriangle size={16} />
              Attention : Le vendeur n'a pas encore validé le devis pour ce colis. La prise en charge est déconseillée.
            </div>
          )}

          {!data.checks.isAssignedToThisRelay && (
            <div style={{
              padding: '0.75rem', borderRadius: '8px',
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#fcd34d', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.75rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <AlertCircle size={16} />
              Avertissement : Ce colis était initialement prévu pour un autre point relais. Sa validation réassignera l'origine à votre relais.
            </div>
          )}

          {/* BANDEAU FINANCIER CLAIR : COD vs PRÉPAYÉ */}
          <div style={{
            padding: '0.85rem', borderRadius: '10px', marginBottom: '1rem',
            background: data.package.isPrepaid ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${data.package.isPrepaid ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.35)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <DollarSign size={16} color={data.package.isPrepaid ? '#4ade80' : '#f59e0b'} />
              <strong style={{ fontSize: '0.85rem', color: data.package.isPrepaid ? '#4ade80' : '#f59e0b' }}>
                {data.package.isPrepaid ? 'MARCHANDISE DÉJÀ PRÉPAYÉE' : 'PAIEMENT À LA LIVRAISON (COD)'}
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
              {data.package.isPrepaid
                ? 'Le client a déjà payé la marchandise en ligne. Aucun encaissement n\'est requis au point relais.'
                : `Le montant de ${formatPrice(data.package.montantAEncaisser)} sera perçu auprès du DESTINATAIRE lors de la livraison. Ne réclamez AUCUN paiement au vendeur lors de cette remise.`}
            </p>
          </div>

          {/* Détails du colis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '8px' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Expéditeur (Vendeur)</div>
              <div style={{ fontWeight: '700', color: '#fff' }}>{data.package.vendeurName}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{data.package.vendeurPhone || '—'}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '8px' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Destinataire (Client)</div>
              <div style={{ fontWeight: '700', color: '#fff' }}>{data.package.clientName}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{data.package.clientCommune} &bull; {data.package.clientPhone}</div>
            </div>
          </div>

          {/* Checkbox de vérification de l'état */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
            padding: '0.7rem', borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', marginBottom: '1rem', fontSize: '0.8rem', color: '#e2e8f0',
          }}>
            <input
              type="checkbox"
              checked={isConditionChecked}
              onChange={(e) => setIsConditionChecked(e.target.checked)}
              style={{ marginTop: '2px' }}
            />
            <span>
              <strong>Contrôle physique effectué :</strong> Le colis est correctement emballé, étiqueté, scellé et ne présente aucune détérioration visible.
            </span>
          </label>

          {submitError && (
            <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {submitError}
            </div>
          )}

          {/* Boutons d'action */}
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={() => setShowRefusalModal(true)}
              disabled={isSubmitting}
              style={{
                flex: 1, minHeight: '44px', borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontWeight: '700', fontSize: '0.82rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Refuser le colis...
            </button>

            <button
              type="button"
              onClick={handleAcceptHandover}
              disabled={isSubmitting || !isConditionChecked}
              style={{
                flex: 2, minHeight: '44px', borderRadius: '10px', border: 'none',
                background: isConditionChecked
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'rgba(255,255,255,0.1)',
                color: isConditionChecked ? '#000' : '#64748b',
                fontWeight: '800', fontSize: '0.88rem',
                cursor: isSubmitting || !isConditionChecked ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              }}
            >
              <CheckCircle2 size={16} />
              {isSubmitting ? 'Enregistrement...' : 'Valider la remise physique'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de refus avec motif obligatoire */}
      {showRefusalModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '16px',
            padding: '1.5rem', width: '100%', maxWidth: '420px', color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldAlert size={18} /> Refus de remise au relais
              </h3>
              <button
                type="button"
                onClick={() => setShowRefusalModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem', lineHeight: 1.4 }}>
              Le refus sera consigné dans l'historique d'audit immuable et le vendeur recevra une notification immédiate pour récupérer son colis.
            </p>

            <form onSubmit={handleConfirmRefusal}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Motif obligatoire :
                </label>
                <select
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value)}
                  style={{
                    width: '100%', minHeight: '42px', borderRadius: '8px',
                    background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)',
                    padding: '0 0.75rem', color: '#fff', fontSize: '0.85rem',
                  }}
                >
                  {REFUSAL_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Observations complémentaires (optionnel) :
                </label>
                <textarea
                  rows={2}
                  value={refusalNotes}
                  onChange={(e) => setRefusalNotes(e.target.value)}
                  placeholder="Détails visibles (ex: carton écrasé sur le côté gauche...)"
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.82rem', resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRefusalModal(false)}
                  style={{
                    flex: 1, minHeight: '44px', borderRadius: '8px',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1, minHeight: '44px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff', fontWeight: '800', fontSize: '0.82rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? 'Envoi...' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
