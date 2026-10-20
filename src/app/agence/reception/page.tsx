'use client';

import { useState } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  QrCode, KeyRound, CheckCircle2, AlertTriangle, Printer,
  Search, Package, ArrowRight, UserCheck, Phone, Check, RefreshCw,
  Wallet, ShieldCheck, FileText, Clock
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

export default function AgencyReceptionPage() {
  const { user } = useAuth('agence');
  const { formatPrice } = useCurrency();
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canScan = hasAgencyPermission(userRole, 'canScanPackages');

  // Mode actif : 'cash_deposit' (Dépôt cash livreur via QR/OTP) ou 'parcel_intake' (Réception colis physique)
  const [activeTab, setActiveTab] = useState<'cash_deposit' | 'parcel_intake'>('cash_deposit');

  // ─── État Dépôt Cash Livreur (QR / OTP) ──────────────────────────────────
  const [driverPhone, setDriverPhone] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [cashLoading, setCashLoading] = useState(false);
  const [cashPreview, setCashPreview] = useState<{
    requestId: string;
    amount: number;
    driverName: string;
    driverPhone: string;
    isExpired: boolean;
    expiresAt?: string;
  } | null>(null);
  const [confirmedCash, setConfirmedCash] = useState<{
    requestId: string;
    amount: number;
    driverName: string;
    driverPhone: string;
    confirmedAt: string;
  } | null>(null);
  const [cashError, setCashError] = useState('');

  // ─── État Réception Colis Guichet ─────────────────────────────────────────
  const [trackingInput, setTrackingInput] = useState('');
  const [parcelLoading, setParcelLoading] = useState(false);
  const [parcelError, setParcelError] = useState('');
  const [foundParcel, setFoundParcel] = useState<any | null>(null);
  const [intakeSuccess, setIntakeSuccess] = useState<any | null>(null);

  // Vérifier le QR ou Code OTP du livreur
  const handleCheckCashCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setCashLoading(true);
    setCashError('');
    setCashPreview(null);
    setConfirmedCash(null);

    try {
      const isOtp = /^\d{6}$/.test(inputCode.trim());
      const params = new URLSearchParams();
      if (isOtp) {
        params.set('otp', inputCode.trim());
      } else {
        params.set('token', inputCode.trim());
      }
      if (driverPhone.trim()) {
        params.set('phone', driverPhone.trim());
      }

      const res = await fetch(`/api/agency/confirm-deposit-qr?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setCashError(data.error || 'Code OTP ou QR invalide ou introuvable.');
      } else {
        setCashPreview(data);
      }
    } catch {
      setCashError('Erreur de connexion avec le serveur.');
    } finally {
      setCashLoading(false);
    }
  };

  // Confirmer l'encaissement du cash
  const handleConfirmCash = async () => {
    if (!cashPreview) return;
    setCashLoading(true);
    setCashError('');

    try {
      const isOtp = /^\d{6}$/.test(inputCode.trim());
      const body: Record<string, string> = isOtp
        ? { otpCode: inputCode.trim() }
        : { qrToken: inputCode.trim() };
      if (driverPhone.trim()) body.phone = driverPhone.trim();

      const res = await fetch('/api/agency/confirm-deposit-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmedCash(data);
        setCashPreview(null);
        setInputCode('');
        setDriverPhone('');
      } else {
        setCashError(data.error || 'Erreur lors de la validation du dépôt.');
      }
    } catch {
      setCashError('Erreur réseau.');
    } finally {
      setCashLoading(false);
    }
  };

  // Rechercher un colis par code tracking
  const handleSearchParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingInput.trim()) return;
    setParcelLoading(true);
    setParcelError('');
    setFoundParcel(null);
    setIntakeSuccess(null);

    try {
      const res = await fetch(`/api/agence/colis?limit=50`);
      if (res.ok) {
        const data = await res.json();
        const clean = trackingInput.toLowerCase().trim();
        const match = (data.colis || []).find((c: any) =>
          c.trackingCode.toLowerCase() === clean || c.id.toLowerCase() === clean
        );
        if (match) {
          setFoundParcel(match);
        } else {
          setParcelError('Aucun colis correspondant trouvé pour ce code.');
        }
      } else {
        setParcelError('Erreur lors de la recherche du colis.');
      }
    } catch {
      setParcelError('Erreur réseau.');
    } finally {
      setParcelLoading(false);
    }
  };

  // Valider la prise en charge au guichet
  const handleConfirmIntake = async () => {
    if (!foundParcel) return;
    setParcelLoading(true);
    setParcelError('');

    try {
      const res = await fetch(`/api/agence/colis/${foundParcel.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      const data = await res.json();
      if (res.ok) {
        setIntakeSuccess(foundParcel);
        setFoundParcel(null);
        setTrackingInput('');
      } else {
        setParcelError(data.error || 'Erreur lors de l’enregistrement.');
      }
    } catch {
      setParcelError('Erreur réseau.');
    } finally {
      setParcelLoading(false);
    }
  };

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Titre */}
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
            Réception Guichet & Validation Rapide
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
            Guichet express d'agence : validation des versements livreurs (QR ou code OTP à 6 chiffres) et réception physique des colis.
          </p>
        </div>

        {/* Sélecteur d'Onglets */}
        <div style={{
          display: 'flex', gap: '10px',
          borderBottom: '1px solid var(--ag-border)', paddingBottom: '10px'
        }}>
          <button
            onClick={() => setActiveTab('cash_deposit')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '10px',
              border: activeTab === 'cash_deposit' ? '1px solid var(--ag-brand)' : '1px solid var(--ag-border)',
              backgroundColor: activeTab === 'cash_deposit' ? 'var(--ag-brand-subtle)' : 'var(--ag-surface)',
              color: activeTab === 'cash_deposit' ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
              fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            <KeyRound size={17} />
            <span>Versement Livreur (QR / Code OTP)</span>
          </button>

          <button
            onClick={() => setActiveTab('parcel_intake')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '10px',
              border: activeTab === 'parcel_intake' ? '1px solid var(--ag-brand)' : '1px solid var(--ag-border)',
              backgroundColor: activeTab === 'parcel_intake' ? 'var(--ag-brand-subtle)' : 'var(--ag-surface)',
              color: activeTab === 'parcel_intake' ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
              fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            <Package size={17} />
            <span>Réception Colis Guichet (Tracking)</span>
          </button>
        </div>

        {/* ─── ONGLET 1 : VERSEMENT CASH LIVREUR (QR / OTP) ────────────────── */}
        {activeTab === 'cash_deposit' && (
          <div style={{
            backgroundColor: 'var(--ag-surface)',
            border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '28px',
            boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                backgroundColor: 'var(--ag-brand-subtle)', color: 'var(--ag-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <QrCode size={30} />
              </div>

              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
                Validation de Versement Livreur
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--ag-text-secondary)', margin: '0 0 24px' }}>
                Entrez le numéro du livreur et son <strong>code OTP à 6 chiffres</strong> (ou scannez son QR code) pour identifier et valider son versement sans ambiguïté.
              </p>

              {cashError && (
                <div style={{
                  backgroundColor: 'var(--ag-danger-bg)', color: 'var(--ag-danger)',
                  border: '1px solid var(--ag-danger)', borderRadius: '10px',
                  padding: '10px 16px', fontSize: '0.85rem', marginBottom: '20px',
                  display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left'
                }}>
                  <AlertTriangle size={18} />
                  <span>{cashError}</span>
                </div>
              )}

              {/* Formulaire saisie Téléphone + Code OTP */}
              <form onSubmit={handleCheckCashCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', textAlign: 'left' }}>
                  {/* Champ 1 : Téléphone du livreur */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: 'var(--ag-text-secondary)' }}>
                      <Phone size={14} style={{ color: 'var(--ag-brand)' }} />
                      <span>Téléphone du livreur</span>
                    </label>
                    <input
                      type="tel"
                      autoFocus
                      placeholder="Ex: 0812345678"
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      style={{
                        width: '100%', height: '48px', borderRadius: '10px',
                        border: '2px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                        color: 'var(--ag-text-primary)', padding: '0 14px',
                        fontSize: '0.95rem', fontWeight: '600', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Champ 2 : Code OTP */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: 'var(--ag-text-secondary)' }}>
                      <KeyRound size={14} style={{ color: 'var(--ag-brand)' }} />
                      <span>Code OTP (6 chiffres) ou QR</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 482910"
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value)}
                      style={{
                        width: '100%', height: '48px', borderRadius: '10px',
                        border: '2px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                        color: 'var(--ag-text-primary)', padding: '0 14px',
                        fontSize: '1.05rem', fontWeight: '800', textAlign: 'center', letterSpacing: '0.1em',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={cashLoading || !inputCode.trim()}
                  style={{
                    height: '48px', borderRadius: '10px', border: 'none',
                    backgroundColor: 'var(--ag-brand)', color: '#fff',
                    fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                    boxShadow: '0 2px 8px var(--ag-brand-glow)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {cashLoading ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  <span>{cashLoading ? 'Vérification en cours...' : 'Vérifier le versement'}</span>
                </button>
              </form>

              {/* Aperçu avant confirmation */}
              {cashPreview && (
                <div style={{
                  backgroundColor: 'var(--ag-surface-hover)',
                  border: '1px solid var(--ag-brand)',
                  borderRadius: '14px', padding: '20px', textAlign: 'left',
                  animation: 'agFadeIn 0.2s ease', marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--ag-brand)' }}>
                      Demande de versement détectée
                    </span>
                    <span className="agency-badge" style={{ backgroundColor: 'var(--ag-warning-bg)', color: 'var(--ag-warning)' }}>
                      En attente d'encaissement
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>Livreur :</div>
                      <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--ag-text-primary)' }}>
                        {cashPreview.driverName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)' }}>
                        {cashPreview.driverPhone}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>Montant espèces remis :</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--ag-brand)' }}>
                        {formatPrice(cashPreview.amount)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmCash}
                    disabled={cashLoading}
                    style={{
                      width: '100%', height: '46px', borderRadius: '10px', border: 'none',
                      backgroundColor: 'var(--ag-success)', color: '#000',
                      fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <CheckCircle2 size={18} />
                    Confirmer l'encaissement de {formatPrice(cashPreview.amount)}
                  </button>
                </div>
              )}

              {/* Succès avec Reçu imprimable */}
              {confirmedCash && (
                <div style={{
                  backgroundColor: 'var(--ag-success-bg)',
                  border: '1px solid var(--ag-success)',
                  borderRadius: '14px', padding: '24px', textAlign: 'center',
                  animation: 'agFadeIn 0.2s ease'
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    backgroundColor: 'var(--ag-success)', color: '#000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px'
                  }}>
                    <Check size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--ag-success)', margin: '0 0 6px' }}>
                    Versement Encaissé avec Succès !
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ag-text-primary)', margin: '0 0 16px' }}>
                    Montant de <strong>{formatPrice(confirmedCash.amount)}</strong> crédité à votre agence par <strong>{confirmedCash.driverName}</strong>.
                  </p>

                  <button
                    onClick={() => window.print()}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--ag-success)',
                      backgroundColor: 'var(--ag-surface)', color: 'var(--ag-text-primary)',
                      fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Printer size={16} />
                    Imprimer le reçu de caisse
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ONGLET 2 : RÉCEPTION PHYSIQUE DE COLIS ─────────────────────── */}
        {activeTab === 'parcel_intake' && (
          <div style={{
            backgroundColor: 'var(--ag-surface)',
            border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '28px',
            boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Package size={30} />
              </div>

              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
                Réception Colis au Guichet
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--ag-text-secondary)', margin: '0 0 24px' }}>
                Scannez le code-barre du colis ou entrez le code tracking (ex: MC-...) apporté par un vendeur ou livreur.
              </p>

              {parcelError && (
                <div style={{
                  backgroundColor: 'var(--ag-danger-bg)', color: 'var(--ag-danger)',
                  border: '1px solid var(--ag-danger)', borderRadius: '10px',
                  padding: '10px 16px', fontSize: '0.85rem', marginBottom: '20px',
                  display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left'
                }}>
                  <AlertTriangle size={18} />
                  <span>{parcelError}</span>
                </div>
              )}

              {/* Formulaire recherche colis */}
              <form onSubmit={handleSearchParcel} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Code de suivi (ex: MC-KNS-892)..."
                  value={trackingInput}
                  onChange={e => setTrackingInput(e.target.value)}
                  style={{
                    flex: 1, height: '48px', borderRadius: '10px',
                    border: '2px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 16px',
                    fontSize: '1rem', fontWeight: '700', textAlign: 'center'
                  }}
                />
                <button
                  type="submit"
                  disabled={parcelLoading || !trackingInput.trim()}
                  style={{
                    padding: '0 24px', borderRadius: '10px', border: 'none',
                    backgroundColor: '#2563eb', color: '#fff',
                    fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer'
                  }}
                >
                  {parcelLoading ? 'Recherche...' : 'Vérifier'}
                </button>
              </form>

              {/* Colis trouvé */}
              {foundParcel && (
                <div style={{
                  backgroundColor: 'var(--ag-surface-hover)',
                  border: '1px solid var(--ag-border)',
                  borderRadius: '14px', padding: '20px', textAlign: 'left',
                  animation: 'agFadeIn 0.2s ease', marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '1.1rem', color: 'var(--ag-brand)' }}>
                      {foundParcel.trackingCode}
                    </span>
                    <span className="agency-badge" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb' }}>
                      {foundParcel.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem', marginBottom: '16px' }}>
                    <div>
                      <span style={{ color: 'var(--ag-text-muted)' }}>Destinataire :</span>
                      <div style={{ fontWeight: '700' }}>{foundParcel.clientName}</div>
                      <div style={{ color: 'var(--ag-text-secondary)' }}>{foundParcel.clientCommune}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--ag-text-muted)' }}>Vendeur expéditeur :</span>
                      <div style={{ fontWeight: '700' }}>{foundParcel.vendeurName}</div>
                      <div style={{ color: 'var(--ag-brand)', fontWeight: '800' }}>{formatPrice(foundParcel.prixColis)}</div>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmIntake}
                    disabled={parcelLoading}
                    style={{
                      width: '100%', height: '44px', borderRadius: '10px', border: 'none',
                      backgroundColor: 'var(--ag-brand)', color: '#fff',
                      fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <CheckCircle2 size={18} />
                    Valider la réception physique au comptoir
                  </button>
                </div>
              )}

              {/* Confirmation réception réussie */}
              {intakeSuccess && (
                <div style={{
                  backgroundColor: 'var(--ag-success-bg)',
                  border: '1px solid var(--ag-success)',
                  borderRadius: '14px', padding: '20px', textAlign: 'center',
                  animation: 'agFadeIn 0.2s ease'
                }}>
                  <CheckCircle2 size={32} color="var(--ag-success)" style={{ margin: '0 auto 8px' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--ag-success)', margin: '0 0 6px' }}>
                    Colis Réceptionné & Enregistré !
                  </h3>
                  <p style={{ fontSize: '0.85rem', margin: '0 0 14px', color: 'var(--ag-text-primary)' }}>
                    Le colis <strong>{intakeSuccess.trackingCode}</strong> est prêt pour assignation ou stockage agence.
                  </p>
                  <button
                    onClick={() => window.print()}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                      backgroundColor: 'var(--ag-surface)', color: 'var(--ag-text-primary)',
                      fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Printer size={15} /> Imprimer étiquette
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AgencyShell>
  );
}
