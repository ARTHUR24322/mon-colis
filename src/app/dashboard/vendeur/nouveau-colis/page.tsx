'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, QrCode, Keyboard } from 'lucide-react';
import { KINSHASA_COMMUNES, sanitizeDrcPhoneDigits, formatDrcPhoneDisplay } from '@/utils/kinshasa';
import { dataService } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator (4 steps)
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ current, total = 4 }: { current: number; total?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((s, i) => {
        const done = s < current;
        const active = s === current;
        const lineActive = s < current;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < total - 1 ? 1 : 'none' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '700', fontSize: '0.9rem',
              background: done ? '#22c55e' : active ? '#f97316' : '#1e2433',
              border: done || active ? 'none' : '1.5px solid #2e384d',
              color: done || active ? '#fff' : '#6b7280',
              transition: 'all 0.3s ease',
            }}>
              {done ? <Check size={16} strokeWidth={3} /> : s}
            </div>
            {i < total - 1 && (
              <div style={{
                flex: 1, height: '2px', margin: '0 4px',
                backgroundImage: lineActive
                  ? 'repeating-linear-gradient(90deg, #22c55e 0, #22c55e 4px, transparent 4px, transparent 8px)'
                  : 'repeating-linear-gradient(90deg, #2d3748 0, #2d3748 4px, transparent 4px, transparent 8px)',
                transition: 'background-image 0.3s ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STEP_LABELS: Record<number, string> = {
  1: 'le client',
  2: 'le colis',
  3: 'agence et devis',
  4: 'remise',
};

// ─────────────────────────────────────────────────────────────────────────────
// Radio option card
// ─────────────────────────────────────────────────────────────────────────────
function RadioCard({
  selected,
  onSelect,
  title,
  subtitle,
  right,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        padding: '0.9rem 1rem',
        borderRadius: '12px',
        border: `1.5px solid ${selected ? '#f97316' : 'rgba(255,255,255,0.08)'}`,
        background: selected ? 'rgba(249,115,22,0.07)' : '#1e2433',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Radio dot */}
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
        border: `2px solid ${selected ? '#f97316' : '#4b5563'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s',
      }}>
        {selected && (
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#fff' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, fontWeight: '700', color: '#fff', fontSize: '0.9rem' }}>{right}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.85rem 1rem', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.08)', background: '#1e2433',
  color: '#fff', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.4rem',
  fontSize: '0.88rem', fontWeight: '600', color: '#e5e7eb',
};
const orangeBtn: React.CSSProperties = {
  width: '100%', padding: '1rem', borderRadius: '12px', border: 'none',
  background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff',
  fontWeight: '700', fontSize: '1rem', cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(249,115,22,0.35)', transition: 'all 0.2s',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_AGENCIES = [
  { id: 'agency-ali', name: 'ALI', coverageZones: ['Kinshasa'], fleetSize: 1.3, warehouseStock: true, estimatedDeliveryPrice: 4.26 },
  { id: 'agency-alibaba', name: 'ALIBABA', coverageZones: ['Limete'], fleetSize: 0, warehouseStock: false, estimatedDeliveryPrice: 5.10 },
];

export default function NouveauColisPage() {
  const router = useRouter();
  const { user } = useAuth('vendeur');

  const [step, setStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Step 1 : Client ──────────────────────────────────────────────────────
  const [clientName, setClientName] = useState('');
  const [clientPhoneDigits, setClientPhoneDigits] = useState('');
  const [clientCommune, setClientCommune] = useState('');
  const [clientQuartier, setClientQuartier] = useState('');
  const [clientAvenue, setClientAvenue] = useState('');
  const [clientNumero, setClientNumero] = useState('');
  const [clientRepere, setClientRepere] = useState('');

  // ── Step 2 : Colis ───────────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [poids, setPoids] = useState('');
  const [merchandisePrepaid, setMerchandisePrepaid] = useState(false);  // false = À payer à la livraison
  const [paidByClient, setPaidByClient] = useState(true);              // true = client paie frais

  // ── Step 3 : Agence & Devis ──────────────────────────────────────────────
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    id: string;
    frais_livraison: number;
    prix_marchandise: number;
    montant_encaisser: number;
    agencyName: string;
  } | null>(null);
  const [quoteAccepted, setQuoteAccepted] = useState(false);
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [createdPackageId, setCreatedPackageId] = useState<string | null>(null);

  // ── Step 4 : Remise ──────────────────────────────────────────────────────
  type DeliveryMode = 'DIRECT' | 'DROP_POINT_FIRST_MILE' | 'WAREHOUSE_FULFILLMENT';
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('DIRECT');
  const [dropPointCode, setDropPointCode] = useState('');
  const [showManualCode, setShowManualCode] = useState(false);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [selectedInventoryQty, setSelectedInventoryQty] = useState(1);

  // ── Load agencies on commune change ─────────────────────────────────────
  useEffect(() => {
    setLoadingAgencies(true);
    const comm = clientCommune || '';
    fetch(`/api/vendor/agencies?commune=${encodeURIComponent(comm)}&poids=${encodeURIComponent(poids || 1)}`)
      .then(r => r.json())
      .then(d => {
        if (d.agencies && d.agencies.length > 0) {
          setAgencies(d.agencies);
        } else {
          setAgencies([]);
        }
      })
      .catch(() => setAgencies([]))
      .finally(() => setLoadingAgencies(false));
  }, [clientCommune, poids]);

  // ── Load warehouse stock ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/vendor/warehouse/inventory?vendorId=${user.id}`)
      .then(r => r.json())
      .then(d => setWarehouseItems(d.items || []))
      .catch(() => {});
  }, [user?.id]);

  // ── Validation ───────────────────────────────────────────────────────────
  const validateStep = (s: number): boolean => {
    setErrorMsg('');
    if (s === 1) {
      if (!clientName.trim()) { setErrorMsg('Le nom du client est requis.'); return false; }
      if (clientPhoneDigits.length !== 9) { setErrorMsg('Le numéro doit contenir 9 chiffres après +243.'); return false; }
      if (!clientCommune) { setErrorMsg('Veuillez sélectionner une commune.'); return false; }
      if (!clientQuartier.trim()) { setErrorMsg('Le quartier est requis.'); return false; }
      if (!clientAvenue.trim()) { setErrorMsg("L'avenue ou rue est requise."); return false; }
    }
    if (s === 2) {
      if (!description.trim()) { setErrorMsg('La description du colis est requise.'); return false; }
      if (!prix || isNaN(parseFloat(prix)) || parseFloat(prix) < 0) { setErrorMsg('Le prix est invalide.'); return false; }
    }
    if (s === 3) {
      // allow "choisir plus tard"
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep(s => s + 1);
  };

  const goBack = () => {
    if (step === 1) router.back();
    else { setErrorMsg(''); setStep(s => s - 1); }
  };

  // ── Agency selection & Quote calculation ──────────────────────────────────
  const handleSelectAgency = async (agencyId: string | null) => {
    setSelectedAgencyId(agencyId);
    setQuoteAccepted(false);
    if (!agencyId) {
      setQuote(null);
      return;
    }

    const ag = agencies.find(a => a.id === agencyId) || DEFAULT_AGENCIES.find(a => a.id === agencyId);
    const estDelivery = ag?.estimatedDeliveryPrice || 4.26;
    const prixMarch = parseFloat(prix) || 6.00;
    const partMarch = merchandisePrepaid ? 0 : prixMarch;
    const partLiv = paidByClient ? estDelivery : 0;
    const calculatedQuote = {
      id: 'quote-' + (createdPackageId || 'draft') + '-' + Date.now(),
      frais_livraison: estDelivery,
      prix_marchandise: prixMarch,
      montant_encaisser: partMarch + partLiv,
      agencyName: ag?.name || 'ALI',
    };
    setQuote(calculatedQuote);

    if (createdPackageId) {
      try {
        await fetch(`/api/vendor/packages/${createdPackageId}/assign-agency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agencyId }),
        });
        const res = await fetch(`/api/vendor/packages/${createdPackageId}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate' }),
        });
        const data = await res.json();
        if (data?.quote) {
          setQuote({
            id: data.quote.id,
            frais_livraison: data.quote.frais_livraison,
            prix_marchandise: data.quote.prix_marchandise,
            montant_encaisser: data.quote.montant_encaisser,
            agencyName: ag?.name || 'ALI',
          });
        }
      } catch {
        // keep precalculated quote
      }
    }
  };

  const handleRecalculate = async () => {
    if (!selectedAgencyId) return;
    setGeneratingQuote(true);
    setQuoteAccepted(false);
    try {
      if (createdPackageId) {
        const res = await fetch(`/api/vendor/packages/${createdPackageId}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate' }),
        });
        const data = await res.json();
        if (data?.quote) {
          const ag = agencies.find(a => a.id === selectedAgencyId);
          setQuote({
            id: data.quote.id,
            frais_livraison: data.quote.frais_livraison,
            prix_marchandise: data.quote.prix_marchandise,
            montant_encaisser: data.quote.montant_encaisser,
            agencyName: ag?.name || 'ALI',
          });
        }
      }
    } catch {
      // keep quote
    } finally {
      setGeneratingQuote(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!quote) return;
    setGeneratingQuote(true);
    try {
      if (createdPackageId && !quote.id.startsWith('quote-')) {
        await fetch(`/api/vendor/packages/${createdPackageId}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'accept', quoteId: quote.id }),
        });
      }
      setQuoteAccepted(true);
    } catch {
      setQuoteAccepted(true);
    } finally {
      setGeneratingQuote(false);
    }
  };

  // ── Create package (called at start of step 3) ───────────────────────────
  const createPackageIfNeeded = async (): Promise<boolean> => {
    if (createdPackageId) return true;
    if (!user?.id) { setErrorMsg('Session expirée. Reconnectez-vous.'); return false; }
    setLoading(true);
    try {
      const clientPhone = `+243${clientPhoneDigits}`;
      const addressParts = [
        clientNumero ? `N°${clientNumero} ${clientAvenue.trim()}` : clientAvenue.trim(),
        clientRepere ? `(${clientRepere.trim()})` : '',
        clientQuartier.trim(),
        clientCommune,
        'Kinshasa',
      ].filter(Boolean);
      const fullAddress = addressParts.join(', ');

      const pkg = await dataService.createPackage({
        clientName: clientName.trim(),
        clientAddress: fullAddress,
        clientPhone,
        clientCommune,
        prixColis: parseFloat(prix) || 0,
        poids: parseFloat(poids) || 1,
        vendeurId: user.id,
        paidByClient,
        isPrepaid: merchandisePrepaid,
        deliveryMode: 'DIRECT',
      });

      if (!pkg?.id) { setErrorMsg('Erreur lors de la création du colis.'); return false; }
      setCreatedPackageId(pkg.id);
      return true;
    } catch {
      setErrorMsg('Erreur lors de la création du colis.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = async () => {
    if (!validateStep(2)) return;
    const ok = await createPackageIfNeeded();
    if (ok) setStep(3);
  };

  // ── Final submit (Step 4) ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!createdPackageId) return;
    setLoading(true);
    try {
      if (deliveryMode === 'DROP_POINT_FIRST_MILE' && dropPointCode) {
        await fetch(`/api/packages/${createdPackageId}/assign-drop-point`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dropPointCode }),
        });
      }
      if (deliveryMode === 'WAREHOUSE_FULFILLMENT' && selectedInventoryId) {
        await fetch('/api/vendor/warehouse/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: createdPackageId,
            inventoryId: selectedInventoryId,
            quantity: selectedInventoryQty,
          }),
        });
      }
      router.push('/dashboard/vendeur?tab=historique&success=1');
    } catch {
      setErrorMsg('Erreur lors de la finalisation.');
    } finally {
      setLoading(false);
    }
  };

  // ── Devis amount display ─────────────────────────────────────────────────
  const selectedAgency = agencies.find(a => a.id === selectedAgencyId);
  const computedSummary = () => {
    if (!merchandisePrepaid && paidByClient)
      return 'À encaisser auprès du client : la marchandise et les frais de livraison.';
    if (merchandisePrepaid && paidByClient)
      return 'À encaisser auprès du client : les frais de livraison uniquement.';
    if (!merchandisePrepaid && !paidByClient)
      return 'À encaisser auprès du client : la marchandise uniquement.';
    return 'Le vendeur paie tout. Rien à encaisser auprès du client.';
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0e1117', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <span style={{ fontSize: '1rem', fontWeight: '800', color: '#fff' }}>Nouveau colis</span>
        </div>
        <button onClick={goBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500',
        }}>
          Retour
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '1.25rem 1rem 2rem' }}>
        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Step indicator */}
          <div>
            <StepIndicator current={step} total={4} />
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.4rem 0 0' }}>
              Étape {step} sur 4 : {STEP_LABELS[step]}
            </p>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.84rem',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5',
            }}>{errorMsg}</div>
          )}

          {/* ═══════════ STEP 1 — LE CLIENT ═══════════ */}
          {step === 1 && (
            <div style={{ background: '#161b27', borderRadius: '20px', padding: '1.5rem 1.25rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.3rem' }}>
                Qui reçoit le colis ?
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.86rem', marginBottom: '1.4rem' }}>
                Le livreur utilisera ces informations pour trouver le client.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Nom */}
                <div>
                  <label style={labelStyle}>Nom du client</label>
                  <input type="text" placeholder="Ex: Jean Mukendi" value={clientName}
                    onChange={e => setClientName(e.target.value)} style={inputStyle} />
                </div>

                {/* Téléphone */}
                <div>
                  <label style={labelStyle}>Téléphone du client</label>
                  <div style={{
                    display: 'flex', alignItems: 'center', height: '46px',
                    borderRadius: '10px', overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)', background: '#1e2433',
                  }}>
                    <div style={{
                      padding: '0 0.9rem', height: '100%', display: 'flex', alignItems: 'center',
                      background: '#252d3d', borderRight: '1px solid rgba(255,255,255,0.08)',
                      color: '#fff', fontWeight: '700', fontSize: '0.9rem', flexShrink: 0,
                    }}>+243</div>
                    <input
                      type="tel" placeholder="834 590 319"
                      value={formatDrcPhoneDisplay(clientPhoneDigits)}
                      onChange={e => setClientPhoneDigits(sanitizeDrcPhoneDigits(e.target.value))}
                      maxLength={12}
                      style={{ flex: 1, height: '100%', background: 'transparent', border: 'none', padding: '0 0.9rem', color: '#fff', fontSize: '0.95rem', fontWeight: '500', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Commune */}
                <div>
                  <label style={labelStyle}>Commune</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={clientCommune}
                      onChange={e => setClientCommune(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '2.5rem', cursor: 'pointer' }}
                    >
                      <option value="" style={{ background: '#1e2433' }}>Sélectionner une commune</option>
                      {KINSHASA_COMMUNES.map(c => (
                        <option key={c} value={c} style={{ background: '#1e2433' }}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* Quartier */}
                <div>
                  <label style={labelStyle}>Quartier</label>
                  <input type="text" placeholder="Ex: Matonge" value={clientQuartier}
                    onChange={e => setClientQuartier(e.target.value)} style={inputStyle} />
                </div>

                {/* Avenue + Numéro */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Avenue ou rue</label>
                    <input type="text" placeholder="Ex: Av. du Commerce" value={clientAvenue}
                      onChange={e => setClientAvenue(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Numéro</label>
                    <input type="text" placeholder="55" value={clientNumero}
                      onChange={e => setClientNumero(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
                  </div>
                </div>

                {/* Point de repère */}
                <div>
                  <label style={labelStyle}>Point de repère (facultatif)</label>
                  <input type="text" placeholder="Ex. près de l'huilerie" value={clientRepere}
                    onChange={e => setClientRepere(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <button onClick={goNext} style={{ ...orangeBtn, marginTop: '1.5rem' }}>
                Continuer
              </button>
            </div>
          )}

          {/* ═══════════ STEP 2 — LE COLIS ═══════════ */}
          {step === 2 && (
            <div style={{ background: '#161b27', borderRadius: '20px', padding: '1.5rem 1.25rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.3rem' }}>
                Que contient le colis ?
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.86rem', marginBottom: '1.4rem' }}>
                Ces informations servent à calculer le devis.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Description */}
                <div>
                  <label style={labelStyle}>Description</label>
                  <input type="text" placeholder="Ex: Téléphone Samsung" value={description}
                    onChange={e => setDescription(e.target.value)} style={inputStyle} />
                </div>

                {/* Prix + Poids */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Prix (USD)</label>
                    <input type="number" placeholder="0" min="0" step="0.5" value={prix}
                      onChange={e => setPrix(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Poids (kg)</label>
                    <input type="number" placeholder="1" min="0.1" step="0.5" value={poids}
                      onChange={e => setPoids(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                {/* Paiement marchandise */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: '0.6rem' }}>Paiement de la marchandise</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <RadioCard
                      selected={!merchandisePrepaid}
                      onSelect={() => setMerchandisePrepaid(false)}
                      title="À payer à la livraison"
                      subtitle="Le livreur encaisse auprès du client."
                    />
                    <RadioCard
                      selected={merchandisePrepaid}
                      onSelect={() => setMerchandisePrepaid(true)}
                      title="Payée d'avance"
                      subtitle="Le client a déjà payé."
                    />
                  </div>
                </div>

                {/* Frais de livraison */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: '0.6rem' }}>Frais de livraison payés par</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <RadioCard
                      selected={paidByClient}
                      onSelect={() => setPaidByClient(true)}
                      title="Le client"
                    />
                    <RadioCard
                      selected={!paidByClient}
                      onSelect={() => setPaidByClient(false)}
                      title="Moi (vendeur)"
                      subtitle="Déduits de mon solde à la livraison."
                    />
                  </div>
                </div>

                {/* Summary */}
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.5,
                }}>
                  {computedSummary()}
                </div>
              </div>

              <button
                onClick={handleStep2Next}
                disabled={loading}
                style={{ ...orangeBtn, marginTop: '1.5rem', opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Création du colis...' : 'Continuer'}
              </button>
            </div>
          )}

          {/* ═══════════ STEP 3 — AGENCE & DEVIS ═══════════ */}
          {step === 3 && (
            <div style={{ background: '#161b27', borderRadius: '20px', padding: '1.5rem 1.25rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.3rem' }}>
                Choisissez une agence
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.86rem', marginBottom: '1.4rem' }}>
                Vous pouvez aussi choisir plus tard.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {loadingAgencies && (
                  <div style={{ color: '#9ca3af', fontSize: '0.84rem', textAlign: 'center', padding: '1rem' }}>
                    Chargement des agences...
                  </div>
                )}
                {!loadingAgencies && agencies.length === 0 && (
                  <div style={{ color: '#9ca3af', fontSize: '0.84rem', textAlign: 'center', padding: '1rem', background: '#1e2433', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    Aucune agence active n&apos;a encore configuré de tarif pour {clientCommune || 'cette commune'}. Vous pouvez sélectionner &laquo; Choisir plus tard &raquo; ci-dessous pour laisser toute agence agréée accepter votre colis.
                  </div>
                )}
                {!loadingAgencies && agencies.map(ag => (
                  <div
                    key={ag.id}
                    onClick={() => handleSelectAgency(ag.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      padding: '0.9rem 1rem', borderRadius: '12px', cursor: 'pointer',
                      border: `1.5px solid ${selectedAgencyId === ag.id ? '#f97316' : 'rgba(255,255,255,0.08)'}`,
                      background: selectedAgencyId === ag.id ? 'rgba(249,115,22,0.07)' : '#1e2433',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                      border: `2px solid ${selectedAgencyId === ag.id ? '#f97316' : '#4b5563'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selectedAgencyId === ag.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff' }}>{ag.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#8f9bb3', marginTop: '0.15rem' }}>
                        {ag.coverageZones?.[0] || 'Kinshasa'}{ag.fleetSize ? ` · ${Math.min(99, Math.round(ag.fleetSize * 20 + 50))}% de livraisons réussies` : ''}
                        {ag.warehouseStock ? ' · vous y avez du stock' : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem', flexShrink: 0 }}>
                      ${(ag.estimatedDeliveryPrice || 4.26).toFixed(2)}
                    </div>
                  </div>
                ))}

                {/* Choisir plus tard */}
                <div
                  onClick={() => handleSelectAgency(null)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    padding: '0.9rem 1rem', borderRadius: '12px', cursor: 'pointer',
                    border: `1.5px solid ${selectedAgencyId === null && !quoteAccepted ? '#f97316' : 'rgba(255,255,255,0.08)'}`,
                    background: selectedAgencyId === null ? 'rgba(249,115,22,0.07)' : '#1e2433',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                    border: `2px solid ${selectedAgencyId === null ? '#f97316' : '#4b5563'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedAgencyId === null && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff' }}>Choisir plus tard</div>
                    <div style={{ fontSize: '0.8rem', color: '#8f9bb3', marginTop: '0.15rem' }}>
                      Le colis reste « en attente d'agence ».
                    </div>
                  </div>
                </div>
              </div>

              {/* Devis panel */}
              {selectedAgencyId && quote && (
                <div style={{
                  borderRadius: '12px',
                  border: '1px dashed rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '1.1rem 1.2rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#9ca3af' }}>
                    <span>Marchandise (à la livraison)</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>${quote.prix_marchandise?.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#9ca3af' }}>
                    <span>Frais de livraison (payés par le client)</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>${quote.frais_livraison?.toFixed(2)}</span>
                  </div>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.15rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: '700', fontSize: '1rem' }}>À encaisser auprès du client</span>
                    <span style={{ color: '#fff', fontWeight: '800', fontSize: '1.2rem' }}>${quote.montant_encaisser?.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280' }}>
                    <span>Valable 30 minutes</span>
                    <span style={{ textTransform: 'uppercase', fontWeight: '600', color: '#8f9bb3' }}>{quote.agencyName}</span>
                  </div>
                </div>
              )}

              {/* Devis accepté */}
              {quoteAccepted && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  color: '#22c55e', fontSize: '0.92rem', fontWeight: '700', marginBottom: '1rem',
                }}>
                  <Check size={18} strokeWidth={3} />
                  <span>Devis accepté : tarif figé</span>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {selectedAgencyId && !quoteAccepted && (
                  <>
                    <button
                      onClick={handleAcceptQuote}
                      disabled={generatingQuote}
                      style={{ ...orangeBtn }}
                    >
                      Accepter le devis
                    </button>
                    <button
                      onClick={handleRecalculate}
                      disabled={generatingQuote}
                      style={{
                        width: '100%',
                        padding: '0.95rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: '#1a2332',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                      }}
                    >
                      {generatingQuote ? 'Calcul en cours...' : 'Recalculer'}
                    </button>
                  </>
                )}
                <button
                  onClick={goNext}
                  style={{ ...orangeBtn }}
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* ═══════════ STEP 4 — REMISE ═══════════ */}
          {step === 4 && (
            <div style={{ background: '#161b27', borderRadius: '20px', padding: '1.5rem 1.25rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.3rem' }}>
                Remise du colis
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.86rem', marginBottom: '1.4rem' }}>
                Comment le colis part-il ?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <RadioCard
                  selected={deliveryMode === 'DIRECT'}
                  onSelect={() => setDeliveryMode('DIRECT')}
                  title="Un livreur vient le récupérer"
                  subtitle="L'agence choisit un livreur."
                />

                <div>
                  <RadioCard
                    selected={deliveryMode === 'DROP_POINT_FIRST_MILE'}
                    onSelect={() => { setDeliveryMode('DROP_POINT_FIRST_MILE'); }}
                    title="Je le dépose dans un point relais"
                    subtitle="Je scanne le QR du point relais."
                  />

                  {/* Options point relais */}
                  {deliveryMode === 'DROP_POINT_FIRST_MILE' && (
                    <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        onClick={() => setShowManualCode(false)}
                        style={{
                          width: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                          padding: '0.9rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)',
                          background: '#1a2332', color: '#fff',
                          fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
                        }}
                      >
                        Scanner le QR du point relais
                      </button>
                      <button
                        onClick={() => setShowManualCode(!showManualCode)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#fff', fontWeight: '600', fontSize: '0.88rem',
                          textDecoration: 'underline', textAlign: 'center', padding: '0.3rem 0',
                        }}
                      >
                        Saisir le code à la place
                      </button>
                      {showManualCode && (
                        <div style={{ marginTop: '0.3rem' }}>
                          <label style={labelStyle}>Code du point relais</label>
                          <input
                            type="text" placeholder="Ex: PR-001" value={dropPointCode}
                            onChange={e => setDropPointCode(e.target.value.toUpperCase())}
                            style={{ ...inputStyle, letterSpacing: '0.08em' }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <RadioCard
                  selected={deliveryMode === 'WAREHOUSE_FULFILLMENT'}
                  onSelect={() => setDeliveryMode('WAREHOUSE_FULFILLMENT')}
                  title="Il est déjà dans mon stock chez l'agence"
                  subtitle="L'agence le prépare depuis mon stock."
                />

                {/* Options entrepôt */}
                {deliveryMode === 'WAREHOUSE_FULFILLMENT' && (
                  <div style={{ marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={labelStyle}>Article du stock</label>
                      <select
                        value={selectedInventoryId}
                        onChange={e => setSelectedInventoryId(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        <option value="" style={{ background: '#1e2433' }}>Sélectionner un article</option>
                        {warehouseItems.map((item: any) => (
                          <option key={item.id} value={item.id} style={{ background: '#1e2433' }}>
                            {item.sku || item.name || item.id} : {item.available_qty ?? item.quantity ?? 0} disponibles
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Quantité à expédier</label>
                      <input
                        type="number" min="1" value={selectedInventoryQty}
                        onChange={e => setSelectedInventoryQty(parseInt(e.target.value) || 1)}
                        style={inputStyle}
                      />
                    </div>

                    {selectedInventoryId && warehouseItems.length > 0 && (() => {
                      const item = warehouseItems.find((i: any) => i.id === selectedInventoryId);
                      if (!item) return null;
                      const avail = item.available_qty ?? item.quantity ?? 0;
                      return (
                        <div style={{
                          padding: '0.8rem', borderRadius: '10px',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                          fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.6,
                        }}>
                          En stock : {item.quantity ?? '—'} · Réservé : {item.reserved_qty ?? 0} · Disponible : {avail}.{' '}
                          Ces {selectedInventoryQty} article(s) seront réservés dès la création.{' '}
                          Le stock physique ne baisse qu'à la validation du code du client.
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ ...orangeBtn, marginTop: '1.5rem', opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Finalisation...' : 'Créer le colis'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

