'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, X, Boxes, QrCode, ArrowDown,
  Building, Clock, ChevronRight, AlertCircle, Check, RotateCw
} from 'lucide-react';
import { useCurrency } from '@/components/CurrencyContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface InventoryItem {
  id: string;
  vendorId: string;
  agencyId: string;
  agencyName: string;
  productName: string;
  sku: string;
  barcode?: string;
  category: string;
  unitPrice: number;
  unitCurrency: string;
  quantityInStock: number;
  quantityReserved: number;
  quantityAvailable: number;
  shelfLocation: string;
  lowStockThreshold: number;
  isLowStock: boolean;
  weightKg?: number;
}

interface InboundBatch {
  id: string;
  batchNumber: string;
  agencyId: string;
  agencyName: string;
  status: 'DRAFT' | 'PENDING' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
  items: Array<{
    productName: string;
    sku?: string;
    expectedQuantity: number;
    receivedQuantity?: number;
    unitPrice?: number;
  }>;
  totalItemsCount: number;
  receivedItemsCount?: number;
  qrPayload: string;
  qrImageUrl: string;
  createdAt: string;
}

interface StorageSpace {
  id: string;
  agencyId: string;
  agencyName: string;
  agencyPhone: string;
  agencyAddress: string;
  agencyCommune?: string;
  surfaceM2?: number;
  formattedAgencyLabel?: string;
  name: string;
  description: string;
  availableSlots: number;
  pricePerMonth: number;
  currency: string;
  dimensions: string;
}

interface VendorSubscription {
  id: string;
  agencyId: string;
  agencyName: string;
  agencyPhone: string;
  agencyAddress: string;
  storageSpaceId: string;
  spaceName: string;
  slotsCount: number;
  pricePaid: number;
  currency: string;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  rejectionReason?: string;
  expiresAt?: string;
}

interface VendorWarehouseTabProps {
  vendorId?: string;
  isDark?: boolean;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    timeZone: 'Africa/Kinshasa',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function timeRemaining(val: string | null | undefined): string {
  if (!val) return '';
  const ms = new Date(val).getTime() - Date.now();
  if (ms <= 0) return 'Expiré';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m restantes` : `${m}m restantes`;
}

export default function VendorWarehouseTab({ vendorId, isDark = true }: VendorWarehouseTabProps) {
  const { formatPrice } = useCurrency();

  // Navigation interne épurée
  const [subTab, setSubTab] = useState<'inventory' | 'inbound' | 'spaces'>('inventory');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Données
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState({ totalItems: 0, totalStock: 0, lowStockCount: 0, totalValuationUSD: 0 });
  const [batches, setBatches] = useState<InboundBatch[]>([]);
  const [spaces, setSpaces] = useState<StorageSpace[]>([]);
  const [subscriptions, setSubscriptions] = useState<VendorSubscription[]>([]);

  const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');

  // Modales
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<InboundBatch | null>(null);
  const [selectedSpaceForSub, setSelectedSpaceForSub] = useState<StorageSpace | null>(null);
  const [subSlotsCount, setSubSlotsCount] = useState<number>(1);
  const [subMonths, setSubMonths] = useState<number>(1);
  const [isSubmittingSub, setIsSubmittingSub] = useState<boolean>(false);

  // Formulaire Bon de dépôt (Nouveau dépôt)
  const [inboundSubscriptionId, setInboundSubscriptionId] = useState('');
  const [inboundAgencyId, setInboundAgencyId] = useState('');
  const [inboundItems, setInboundItems] = useState<Array<{ productName: string; sku: string; expectedQuantity: number; unitPrice: number }>>([
    { productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }
  ]);
  const [inboundNotes, setInboundNotes] = useState('');
  const [isSubmittingInbound, setIsSubmittingInbound] = useState(false);

  const selectedInboundSub = activeSubscriptions.find(s => s.id === inboundSubscriptionId) || activeSubscriptions[0] || null;
  const maxAllowedMerchandises = selectedInboundSub ? (selectedInboundSub.slotsCount || 1) : 1;

  // Message toast discret
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Chargement des données
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const vParam = vendorId ? `?vendorId=${vendorId}` : '';
      const [invRes, inbRes, spcRes, subRes] = await Promise.all([
        fetch(`/api/vendor/warehouse/inventory${vParam}`),
        fetch(`/api/vendor/warehouse/inbound-batches${vParam}`),
        fetch(`/api/vendor/warehouse/spaces${vParam}`),
        fetch(`/api/vendor/warehouse/subscriptions${vParam}`)
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setItems(invData.items || []);
        if (invData.stats) setStats(invData.stats);
      }
      if (inbRes.ok) {
        const inbData = await inbRes.json();
        setBatches(inbData.batches || []);
      }
      if (spcRes.ok) {
        const spcData = await spcRes.json();
        setSpaces(spcData.spaces || []);
      }
      if (subRes.ok) {
        const subData = await subRes.json();
        const subs: VendorSubscription[] = subData.subscriptions || [];
        setSubscriptions(subs);
        const actives = subs.filter(s => s.status === 'ACTIVE');
        if (actives.length > 0 && !inboundSubscriptionId) {
          setInboundSubscriptionId(actives[0].id);
          setInboundAgencyId(actives[0].agencyId);
        }
      }
    } catch {
      showToast('Erreur de connexion', 'err');
    } finally {
      setLoading(false);
    }
  }, [vendorId, inboundSubscriptionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Création bon de dépôt (Nouveau dépôt)
  const handleCreateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundAgencyId && selectedInboundSub) {
      setInboundAgencyId(selectedInboundSub.agencyId);
    }
    const currentAgencyId = inboundAgencyId || selectedInboundSub?.agencyId;
    if (!currentAgencyId) {
      showToast('Sélectionnez une agence et un emplacement', 'err');
      return;
    }
    const valid = inboundItems.filter(it => it.productName.trim() && it.expectedQuantity > 0);
    if (valid.length === 0) {
      showToast('Ajoutez au moins une marchandise valide', 'err');
      return;
    }
    const missingPrice = valid.some(it => !it.unitPrice || it.unitPrice <= 0);
    if (missingPrice) {
      showToast('Veuillez renseigner un prix unitaire supérieur à 0 pour chaque marchandise', 'err');
      return;
    }
    if (valid.length > maxAllowedMerchandises) {
      showToast(`Cette location autorise au maximum ${maxAllowedMerchandises} marchandise(s) (${maxAllowedMerchandises} place(s) louée(s))`, 'err');
      return;
    }
    setIsSubmittingInbound(true);
    try {
      const res = await fetch('/api/vendor/warehouse/inbound-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          agencyId: currentAgencyId,
          subscriptionId: inboundSubscriptionId || selectedInboundSub?.id,
          storageSpaceId: selectedInboundSub?.storageSpaceId,
          items: valid,
          notes: inboundNotes
        })
      });
      const d = await res.json();
      if (res.ok && d.batch) {
        showToast('Bon de dépôt créé avec succès');
        setShowInboundModal(false);
        setSelectedBatchForQr(d.batch);
        setInboundItems([{ productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }]);
        setInboundNotes('');
        await loadData();
      } else {
        showToast(d.error || 'Échec création bon de dépôt', 'err');
      }
    } catch {
      showToast('Erreur réseau. Veuillez réessayer.', 'err');
    } finally {
      setIsSubmittingInbound(false);
    }
  };

  // Demande de location
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceForSub) return;
    setIsSubmittingSub(true);
    try {
      const res = await fetch('/api/vendor/warehouse/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          storageSpaceId: selectedSpaceForSub.id,
          slotsCount: subSlotsCount,
          months: subMonths,
          autoRenew: true
        })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        showToast('Demande envoyée à l\'agence');
        setSelectedSpaceForSub(null);
        setSubSlotsCount(1);
        setSubMonths(1);
        await loadData();
      } else {
        showToast(d.error || 'Échec de la demande', 'err');
      }
    } catch {
      showToast('Erreur réseau', 'err');
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const filteredItems = items.filter(it =>
    it.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (it.sku || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Thème & Styles Neutres
  // Accent unique : #22c55e (vert sombre) / #16a34a (vert clair)
  // ─────────────────────────────────────────────────────────────────────────────
  const accent = isDark ? '#22c55e' : '#16a34a';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const borderSubtle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const surface = isDark ? '#111827' : '#ffffff';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '44px',
    padding: '0 0.85rem',
    borderRadius: '12px',
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    border: `1px solid ${borderSubtle}`,
    color: textPrimary,
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div style={{
      maxWidth: '440px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: textPrimary
    }}>
      {/* Toast discret */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: isDark ? '#1e293b' : '#0f172a',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* En-tête conforme à l'image : Titre + Bouton Actualiser */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Entrepôt & Stock
        </h1>
        <button
          type="button"
          onClick={() => loadData()}
          title="Actualiser"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <RotateCw size={17} />
        </button>
      </div>

      {/* Carte des statistiques à 4 colonnes compacte */}
      <div style={{
        background: '#0d1117',
        borderRadius: '14px',
        padding: '1.1rem 0.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.04)'
      }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff' }}>{stats.totalStock}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>Unités</div>
        </div>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff' }}>{stats.lowStockCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>Stock faible</div>
        </div>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff' }}>{stats.totalItems}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>Articles</div>
        </div>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff' }}>{formatPrice(stats.totalValuationUSD || 0)}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>Valeur</div>
        </div>
      </div>

      {/* Navigation secondaire : 3 onglets textuels soulignés de vert */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        gap: '1.5rem'
      }}>
        {[
          { key: 'inventory', label: 'Stock' },
          { key: 'inbound', label: 'Bons de dépôt' },
          { key: 'spaces', label: 'Agences' }
        ].map(tab => {
          const isActive = subTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key as any)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.6rem 0',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#ffffff' : '#64748b',
                borderBottom: isActive ? '2px solid #22c55e' : '2px solid transparent',
                marginBottom: '-1px'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── ONGLET 1 : ARTICLES ────────────────────────────────────────────── */}
      {subTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Barre de recherche + bouton carré + */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <div style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search
                size={16}
                strokeWidth={1.8}
                color="#64748b"
                style={{ position: 'absolute', left: '14px' }}
              />
              <input
                type="text"
                placeholder="Rechercher un article"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingLeft: '38px',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Bouton carré '+' conforme à l'image */}
            <button
              type="button"
              onClick={() => {
                if (activeSubscriptions.length === 0) {
                  showToast('Louez d\'abord un emplacement en agence', 'err');
                } else {
                  setShowInboundModal(true);
                }
              }}
              title="Nouveau dépôt"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <Plus size={20} strokeWidth={2} />
            </button>
          </div>

          {/* Liste d'articles ou état vide conforme à l'image */}
          {filteredItems.length === 0 ? (
            <div style={{
              padding: '3.5rem 1rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>
                Aucun article en stock
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '300px', lineHeight: '1.4' }}>
                Ajoutez vos produits pour suivre vos stocks et laisser l&apos;agence expédier à votre place.
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeSubscriptions.length === 0) {
                    showToast('Louez d\'abord un emplacement en agence', 'err');
                  } else {
                    setShowInboundModal(true);
                  }
                }}
                style={{
                  marginTop: '0.8rem',
                  padding: '0.85rem 1.75rem',
                  borderRadius: '12px',
                  background: '#22c55e',
                  color: '#000000',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Nouveau dépôt
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: idx < filteredItems.length - 1 ? `1px solid ${borderSubtle}` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>{item.productName}</span>
                      <span style={{ fontSize: '0.78rem', color: textSecondary }}>
                        {item.sku || 'Sans SKU'} · {item.agencyName}
                      </span>
                    </div>

                    {/* Statut en simple texte coloré (jamais de badge encadré) */}
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: item.isLowStock
                        ? (isDark ? '#f87171' : '#dc2626')
                        : (isDark ? '#4ade80' : '#16a34a')
                    }}>
                      {item.isLowStock ? 'Stock faible' : 'En stock'}
                    </span>
                  </div>

                  {/* Ligne compacte quantités */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '0.8rem',
                    color: textSecondary,
                    marginTop: '2px'
                  }}>
                    <span>Total : <strong style={{ color: textPrimary }}>{item.quantityInStock}</strong></span>
                    <span>Réservé : <strong style={{ color: textPrimary }}>{item.quantityReserved}</strong></span>
                    <span>Disponible : <strong style={{ color: accent }}>{item.quantityAvailable}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ONGLET 2 : BONS DE DÉPÔT ───────────────────────────────────────── */}
      {subTab === 'inbound' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: textSecondary }}>
              Dépôts prévus en agence
            </span>
            <button
              onClick={() => {
                if (activeSubscriptions.length === 0) {
                  showToast('Louez d\'abord un emplacement en agence', 'err');
                } else {
                  setShowInboundModal(true);
                }
              }}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                background: accent,
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} strokeWidth={1.8} />
              <span>Nouveau dépôt</span>
            </button>
          </div>

          {batches.length === 0 ? (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: textSecondary,
              fontSize: '0.85rem'
            }}>
              Aucun bon de dépôt en cours.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {batches.map((batch, idx) => (
                <div
                  key={batch.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: idx < batches.length - 1 ? `1px solid ${borderSubtle}` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{batch.batchNumber}</div>
                      <div style={{ fontSize: '0.78rem', color: textSecondary }}>
                        {batch.agencyName} · {formatDate(batch.createdAt)}
                      </div>
                    </div>

                    {/* Statut en simple texte coloré */}
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: batch.status === 'RECEIVED'
                        ? (isDark ? '#4ade80' : '#16a34a')
                        : (isDark ? '#fbbf24' : '#d97706')
                    }}>
                      {batch.status === 'RECEIVED' ? 'Réceptionné' : 'En attente'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: textSecondary }}>
                      {batch.totalItemsCount} article(s)
                    </span>
                    <button
                      onClick={() => setSelectedBatchForQr(batch)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: accent,
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '6px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <QrCode size={15} strokeWidth={1.8} />
                      <span>Voir le QR</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ONGLET 3 : AGENCES & LOCATIONS ─────────────────────────────────── */}
      {subTab === 'spaces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Sous-section 1 : Mes locations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Mes locations de stockage ({subscriptions.length})
            </span>

            {subscriptions.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: textSecondary }}>
                Vous n'avez aucune location active. Choisissez une offre ci-dessous.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {subscriptions.map((sub, idx) => {
                  const isPending = sub.status === 'PENDING';
                  const isActive = sub.status === 'ACTIVE';
                  const isRejected = sub.status === 'REJECTED';

                  return (
                    <div
                      key={sub.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: idx < subscriptions.length - 1 ? `1px solid ${borderSubtle}` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{sub.spaceName}</div>
                          <div style={{ fontSize: '0.78rem', color: textSecondary }}>
                            {sub.agencyName} · {sub.slotsCount} emplacement(s)
                          </div>
                        </div>

                        {/* Statut en simple texte coloré */}
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          color: isActive
                            ? (isDark ? '#4ade80' : '#16a34a')
                            : isPending
                              ? (isDark ? '#fbbf24' : '#d97706')
                              : (isDark ? '#f87171' : '#dc2626')
                        }}>
                          {isActive ? 'Actif' : isPending ? 'En attente' : isRejected ? 'Refusé' : sub.status}
                        </span>
                      </div>

                      {isPending && sub.expiresAt && (
                        <div style={{ fontSize: '0.75rem', color: textMuted }}>
                          {timeRemaining(sub.expiresAt)}
                        </div>
                      )}

                      {isRejected && sub.rejectionReason && (
                        <div style={{ fontSize: '0.75rem', color: isDark ? '#f87171' : '#dc2626' }}>
                          Motif : {sub.rejectionReason}
                        </div>
                      )}

                      <div style={{ fontSize: '0.78rem', color: textMuted }}>
                        {sub.pricePaid} {sub.currency} réglé
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sous-section 2 : Offres disponibles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Offres des agences
            </span>

            {spaces.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: textSecondary }}>
                Aucun espace disponible pour le moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {spaces.map((sp, idx) => (
                  <div
                    key={sp.id}
                    style={{
                      padding: '14px 0',
                      borderBottom: idx < spaces.length - 1 ? `1px solid ${borderSubtle}` : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{sp.name}</div>
                        <div style={{ fontSize: '0.78rem', color: textSecondary }}>
                          {sp.formattedAgencyLabel || sp.agencyName}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                          ${sp.pricePerMonth}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: textMuted }}>/ mois</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.78rem', color: textMuted }}>
                        {sp.availableSlots > 0 ? `${sp.availableSlots} place(s)` : 'Complet'}
                      </span>
                      <button
                        onClick={() => { setSelectedSpaceForSub(sp); setSubSlotsCount(1); setSubMonths(1); }}
                        disabled={sp.availableSlots <= 0}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: sp.availableSlots > 0 ? accent : textMuted,
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: sp.availableSlots > 0 ? 'pointer' : 'default',
                          padding: '6px 0'
                        }}
                      >
                        {sp.availableSlots > 0 ? 'Louer' : 'Indisponible'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODALE BOTTOM SHEET : NOUVEAU BON DE DÉPÔT ──────────────────────── */}
      {showInboundModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: surface,
            borderTop: `1px solid ${borderSubtle}`,
            borderRadius: '16px 16px 0 0',
            width: '100%',
            maxWidth: '440px',
            maxHeight: '90dvh',
            overflowY: 'auto',
            padding: '20px 20px 32px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Nouveau bon de dépôt</span>
              <button
                onClick={() => setShowInboundModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: textSecondary,
                  cursor: 'pointer',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            <form onSubmit={handleCreateInbound} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                  Emplacement réservé *
                </label>
                <select
                  required
                  value={inboundSubscriptionId}
                  onChange={e => {
                    const subId = e.target.value;
                    setInboundSubscriptionId(subId);
                    const sub = activeSubscriptions.find(s => s.id === subId);
                    if (sub) {
                      setInboundAgencyId(sub.agencyId);
                      if (inboundItems.length > (sub.slotsCount || 1)) {
                        setInboundItems(inboundItems.slice(0, sub.slotsCount || 1));
                      }
                    }
                  }}
                  style={inputStyle}
                >
                  <option value="">Sélectionner une location d'espace...</option>
                  {activeSubscriptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.agencyName} — {s.spaceName} ({s.slotsCount} place{s.slotsCount > 1 ? 's' : ''} = {s.slotsCount} marchandise{s.slotsCount > 1 ? 's' : ''} max)
                    </option>
                  ))}
                </select>
              </div>

              {selectedInboundSub && (
                <div style={{
                  fontSize: '0.78rem',
                  color: isDark ? '#4ade80' : '#16a34a',
                  background: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Boxes size={16} />
                  <span>
                    Capacité : <strong>{selectedInboundSub.slotsCount}</strong> marchandise(s) max ({selectedInboundSub.slotsCount === 1 ? '1 marchandise pour 1 emplacement loué' : '1 marchandise par emplacement loué'})
                  </span>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: textPrimary }}>
                    Marchandise{inboundItems.length > 1 ? 's' : ''} à déposer ({inboundItems.length}/{maxAllowedMerchandises})
                  </label>
                  {inboundItems.length < maxAllowedMerchandises && (
                    <button
                      type="button"
                      onClick={() => setInboundItems([...inboundItems, { productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }])}
                      style={{ background: 'none', border: 'none', color: accent, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={14} />
                      <span>+ Marchandise</span>
                    </button>
                  )}
                </div>

                {inboundItems.length >= maxAllowedMerchandises && (
                  <div style={{ fontSize: '0.72rem', color: textMuted, marginBottom: '8px' }}>
                    Limite atteinte ({maxAllowedMerchandises} marchandise{maxAllowedMerchandises > 1 ? 's' : ''} max pour cette location de {maxAllowedMerchandises} place{maxAllowedMerchandises > 1 ? 's' : ''}).
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {inboundItems.map((line, idx) => (
                    <div key={idx} style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                      border: `1px solid ${borderSubtle}`,
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: textSecondary }}>
                          Marchandise #{idx + 1}
                        </span>
                        {inboundItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setInboundItems(inboundItems.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: textMuted, cursor: 'pointer', padding: '2px' }}
                            title="Supprimer cette marchandise"
                          >
                            <X size={15} strokeWidth={2} />
                          </button>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', color: textSecondary, display: 'block', marginBottom: '3px' }}>
                          Nom de la marchandise *
                        </label>
                        <input
                          type="text"
                          placeholder="Ex : Chaussures basket, Robe pagne..."
                          required
                          value={line.productName}
                          onChange={e => {
                            const copy = [...inboundItems];
                            copy[idx].productName = e.target.value;
                            setInboundItems(copy);
                          }}
                          style={inputStyle}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: textSecondary, display: 'block', marginBottom: '3px' }}>
                            Prix de vente ($ USD) *
                          </label>
                          <input
                            type="number"
                            placeholder="0.00"
                            required
                            min="0.01"
                            step="0.01"
                            value={line.unitPrice || ''}
                            onChange={e => {
                              const copy = [...inboundItems];
                              copy[idx].unitPrice = parseFloat(e.target.value) || 0;
                              setInboundItems(copy);
                            }}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: textSecondary, display: 'block', marginBottom: '3px' }}>
                            Quantité totale *
                          </label>
                          <input
                            type="number"
                            placeholder="Qté"
                            required
                            min="1"
                            value={line.expectedQuantity || ''}
                            onChange={e => {
                              const copy = [...inboundItems];
                              copy[idx].expectedQuantity = parseInt(e.target.value, 10) || 1;
                              setInboundItems(copy);
                            }}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                  Notes ou instructions (optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex : Colis fragile, carton rouge..."
                  value={inboundNotes}
                  onChange={e => setInboundNotes(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingInbound}
                style={{
                  minHeight: '48px',
                  borderRadius: '12px',
                  background: accent,
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: isSubmittingInbound ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingInbound ? 0.6 : 1,
                  fontFamily: 'inherit'
                }}
              >
                {isSubmittingInbound ? 'Création du bon...' : 'Générer le bon de dépôt & QR'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODALE BOTTOM SHEET : VOIR QR ───────────────────────────────────── */}
      {selectedBatchForQr && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: surface,
            border: `1px solid ${borderSubtle}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '360px',
            padding: '24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedBatchForQr.batchNumber}</span>
              <button
                onClick={() => setSelectedBatchForQr(null)}
                style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer' }}
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            <div style={{ background: '#fff', padding: '12px', borderRadius: '12px' }}>
              <img
                src={selectedBatchForQr.qrImageUrl}
                alt={selectedBatchForQr.batchNumber}
                style={{ width: '200px', height: '200px', display: 'block' }}
              />
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: textSecondary, textAlign: 'center', lineHeight: 1.4 }}>
              Présentez ce QR code à l'agent de <strong>{selectedBatchForQr.agencyName}</strong> lors du dépôt physique.
            </p>

            <button
              onClick={() => setSelectedBatchForQr(null)}
              style={{
                width: '100%',
                minHeight: '44px',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                color: textPrimary,
                border: 'none',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ─── MODALE BOTTOM SHEET : LOUER UN EMPLACEMENT ──────────────────────── */}
      {selectedSpaceForSub && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: surface,
            borderTop: `1px solid ${borderSubtle}`,
            borderRadius: '16px 16px 0 0',
            width: '100%',
            maxWidth: '440px',
            padding: '20px 20px 32px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedSpaceForSub.name}</div>
                <div style={{ fontSize: '0.78rem', color: textSecondary }}>{selectedSpaceForSub.agencyName}</div>
              </div>
              <button
                onClick={() => setSelectedSpaceForSub(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: textSecondary,
                  cursor: 'pointer',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '6px' }}>
                  Nombre d'emplacements
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 5].map(n => (
                    <button
                      type="button"
                      key={n}
                      disabled={n > selectedSpaceForSub.availableSlots}
                      onClick={() => setSubSlotsCount(n)}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: subSlotsCount === n ? `2px solid ${accent}` : `1px solid ${borderSubtle}`,
                        background: 'none',
                        color: subSlotsCount === n ? accent : textPrimary,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: n > selectedSpaceForSub.availableSlots ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '6px' }}>
                  Durée
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ m: 1, l: '1 mois' }, { m: 3, l: '3 mois' }, { m: 6, l: '6 mois' }].map(item => (
                    <button
                      type="button"
                      key={item.m}
                      onClick={() => setSubMonths(item.m)}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: subMonths === item.m ? `2px solid ${accent}` : `1px solid ${borderSubtle}`,
                        background: 'none',
                        color: subMonths === item.m ? accent : textPrimary,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {item.l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${borderSubtle}` }}>
                <span style={{ fontSize: '0.85rem', color: textSecondary }}>Total estimé</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  ${(selectedSpaceForSub.pricePerMonth * subSlotsCount * subMonths).toFixed(2)}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSub}
                style={{
                  minHeight: '44px',
                  background: accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isSubmittingSub ? 'wait' : 'pointer'
                }}
              >
                {isSubmittingSub ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
