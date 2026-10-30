'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, X, Camera, QrCode, ArrowDown,
  Building, Clock, ChevronRight, AlertCircle, Check
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
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<InboundBatch | null>(null);
  const [selectedSpaceForSub, setSelectedSpaceForSub] = useState<StorageSpace | null>(null);
  const [subSlotsCount, setSubSlotsCount] = useState<number>(1);
  const [subMonths, setSubMonths] = useState<number>(1);
  const [isSubmittingSub, setIsSubmittingSub] = useState<boolean>(false);

  // Formulaire Produit
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductSkuConflict, setNewProductSkuConflict] = useState<{ exists: boolean; existingId?: string } | null>(null);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [newProductAgencyId, setNewProductAgencyId] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Général');
  const [newProductPrice, setNewProductPrice] = useState('10');
  const [newProductQty, setNewProductQty] = useState('0');
  const [newProductThreshold, setNewProductThreshold] = useState('5');
  const [thresholdWarning, setThresholdWarning] = useState('');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Formulaire Bon de dépôt
  const [inboundAgencyId, setInboundAgencyId] = useState('');
  const [inboundItems, setInboundItems] = useState<Array<{ productName: string; sku: string; expectedQuantity: number; unitPrice: number }>>([
    { productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }
  ]);
  const [inboundNotes, setInboundNotes] = useState('');
  const [isSubmittingInbound, setIsSubmittingInbound] = useState(false);

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
        if (actives.length === 1 && !newProductAgencyId) {
          setNewProductAgencyId(actives[0].agencyId);
          setInboundAgencyId(actives[0].agencyId);
        }
      }
    } catch {
      showToast('Erreur de connexion', 'err');
    } finally {
      setLoading(false);
    }
  }, [vendorId, newProductAgencyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Seuil d'alerte cohérence
  useEffect(() => {
    const qty = parseInt(newProductQty, 10) || 0;
    const thr = parseInt(newProductThreshold, 10) || 0;
    if (thr > qty && qty > 0) {
      setThresholdWarning(`Le seuil (${thr}) dépasse le stock initial (${qty})`);
    } else {
      setThresholdWarning('');
    }
  }, [newProductQty, newProductThreshold]);

  // SKU automatique
  const handleGenerateSku = async () => {
    if (!newProductName.trim()) {
      showToast('Entrez d\'abord le nom du produit', 'err');
      return;
    }
    setIsGeneratingSku(true);
    try {
      const res = await fetch(
        `/api/vendor/warehouse/inventory?action=generate_sku&name=${encodeURIComponent(newProductName.trim())}${vendorId ? `&vendorId=${vendorId}` : ''}`
      );
      const data = await res.json();
      if (res.ok && data.sku) {
        setNewProductSku(data.sku);
        setNewProductSkuConflict(null);
      }
    } catch {
      showToast('Échec génération SKU', 'err');
    } finally {
      setIsGeneratingSku(false);
    }
  };

  // Vérification de collision SKU
  useEffect(() => {
    if (!newProductSku.trim()) { setNewProductSkuConflict(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/vendor/warehouse/inventory?action=check_sku&sku=${encodeURIComponent(newProductSku.trim())}${vendorId ? `&vendorId=${vendorId}` : ''}`
        );
        if (res.ok) {
          const data = await res.json();
          setNewProductSkuConflict(data.exists ? { exists: true, existingId: data.existingItemId } : { exists: false });
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [newProductSku, vendorId]);

  // Scanner caméra
  const startBarcodeScanner = async () => {
    setIsScanningBarcode(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      if ('BarcodeDetector' in window) {
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'] });
        const interval = setInterval(async () => {
          if (!videoRef.current) { clearInterval(interval); return; }
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              clearInterval(interval);
              setNewProductSku(codes[0].rawValue);
              stopBarcodeScanner();
              showToast('Code scanné');
            }
          } catch {}
        }, 300);
      }
    } catch {
      setIsScanningBarcode(false);
      showToast('Accès caméra non autorisé', 'err');
    }
  };

  const stopBarcodeScanner = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsScanningBarcode(false);
  };

  useEffect(() => {
    if (!showAddProductModal) stopBarcodeScanner();
  }, [showAddProductModal]);

  // Création produit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductAgencyId) {
      showToast('Renseignez le nom et l\'agence', 'err');
      return;
    }
    if (newProductSkuConflict?.exists) {
      showToast('Ce SKU est déjà utilisé', 'err');
      return;
    }
    setIsSubmittingProduct(true);
    try {
      const res = await fetch('/api/vendor/warehouse/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          agencyId: newProductAgencyId,
          productName: newProductName.trim(),
          sku: newProductSku.trim() || undefined,
          category: newProductCategory,
          unitPrice: parseFloat(newProductPrice) || 0,
          unitCurrency: 'USD',
          initialQuantity: parseInt(newProductQty, 10) || 0,
          lowStockThreshold: parseInt(newProductThreshold, 10) || 5
        })
      });
      if (res.ok) {
        showToast('Article ajouté');
        setShowAddProductModal(false);
        setNewProductName('');
        setNewProductSku('');
        setNewProductSkuConflict(null);
        setNewProductQty('0');
        await loadData();
      } else {
        const d = await res.json();
        showToast(d.error || 'Erreur d\'enregistrement', 'err');
      }
    } catch {
      showToast('Erreur réseau', 'err');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Création bon de dépôt
  const handleCreateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundAgencyId) {
      showToast('Sélectionnez une agence', 'err');
      return;
    }
    const valid = inboundItems.filter(it => it.productName.trim() && it.expectedQuantity > 0);
    if (valid.length === 0) {
      showToast('Ajoutez au moins un article valide', 'err');
      return;
    }
    setIsSubmittingInbound(true);
    try {
      const res = await fetch('/api/vendor/warehouse/inbound-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          agencyId: inboundAgencyId,
          items: valid,
          notes: inboundNotes
        })
      });
      const d = await res.json();
      if (res.ok && d.batch) {
        showToast('Bon de dépôt créé');
        setShowInboundModal(false);
        setSelectedBatchForQr(d.batch);
        setInboundItems([{ productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }]);
        setInboundNotes('');
        await loadData();
      } else {
        showToast(d.error || 'Échec création bon', 'err');
      }
    } catch {
      showToast('Erreur réseau', 'err');
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

      {/* En-tête simple : Titre + ligne compacte de stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Stock et entrepôt
        </h2>
        {/* Remplacement des 4 grandes cartes par une ligne compacte */}
        <p style={{ margin: 0, fontSize: '0.82rem', color: textSecondary }}>
          {stats.totalStock} unités en stock · {stats.totalItems} réf.
          {stats.lowStockCount > 0 && (
            <span style={{ color: isDark ? '#f87171' : '#dc2626', marginLeft: '6px' }}>
              · {stats.lowStockCount} alerte stock
            </span>
          )}
        </p>
      </div>

      {/* Navigation secondaire : 3 onglets textuels sobres */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${borderSubtle}`,
        gap: '20px'
      }}>
        {[
          { key: 'inventory', label: `Articles (${items.length})` },
          { key: 'inbound', label: `Bons de dépôt (${batches.length})` },
          { key: 'spaces', label: `Agences (${spaces.length})` }
        ].map(tab => {
          const isActive = subTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key as any)}
              style={{
                background: 'none',
                border: 'none',
                padding: '10px 0',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? accent : textSecondary,
                borderBottom: isActive ? `2px solid ${accent}` : '2px solid transparent',
                marginBottom: '-1px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center'
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
          {/* Action principale unique + barre de recherche */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search
                size={16}
                strokeWidth={1.8}
                color={textMuted}
                style={{ position: 'absolute', left: '12px' }}
              />
              <input
                type="text"
                placeholder="Rechercher par nom ou SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingLeft: '36px',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Unique bouton plein de l'écran */}
            <button
              onClick={() => {
                if (activeSubscriptions.length === 0) {
                  showToast('Louez d\'abord un emplacement en agence', 'err');
                } else {
                  setShowAddProductModal(true);
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
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={16} strokeWidth={1.8} />
              <span>Article</span>
            </button>
          </div>

          {/* Note discrète disponible/réservé */}
          <div style={{ fontSize: '0.78rem', color: textMuted }}>
            Stock disponible = Total physique − Réservé aux commandes
          </div>

          {/* Liste d'articles avec simples séparateurs fins 1px */}
          {filteredItems.length === 0 ? (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: textSecondary,
              fontSize: '0.85rem'
            }}>
              {items.length === 0
                ? 'Aucun article enregistré. Ajoutez votre premier produit.'
                : 'Aucun produit ne correspond à la recherche.'}
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

      {/* ─── MODALE BOTTOM SHEET : NOUVEL ARTICLE ────────────────────────────── */}
      {showAddProductModal && (
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
              <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Nouvel article</span>
              <button
                onClick={() => setShowAddProductModal(false)}
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

            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                  Nom de l'article *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Robe en pagne"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                  Agence de stockage *
                </label>
                <select
                  required
                  value={newProductAgencyId}
                  onChange={e => setNewProductAgencyId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Choisir une agence...</option>
                  {activeSubscriptions.map(s => (
                    <option key={s.id} value={s.agencyId}>{s.agencyName} ({s.spaceName})</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.78rem', color: textSecondary }}>SKU / Référence</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      disabled={isGeneratingSku}
                      style={{ background: 'none', border: 'none', color: accent, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {isGeneratingSku ? '...' : 'Générer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => isScanningBarcode ? stopBarcodeScanner() : startBarcodeScanner()}
                      style={{ background: 'none', border: 'none', color: textSecondary, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Camera size={13} strokeWidth={1.8} />
                      <span>Scanner</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="MC-PROD-0001"
                  value={newProductSku}
                  onChange={e => setNewProductSku(e.target.value)}
                  style={inputStyle}
                />
                {newProductSkuConflict?.exists && (
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#f87171' : '#dc2626', marginTop: '3px', display: 'block' }}>
                    Ce SKU existe déjà
                  </span>
                )}
                {isScanningBarcode && (
                  <div style={{ marginTop: '8px', borderRadius: '12px', overflow: 'hidden' }}>
                    <video ref={videoRef} style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }} playsInline muted />
                    <button type="button" onClick={stopBarcodeScanner} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', color: isDark ? '#f87171' : '#dc2626', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Arrêter la caméra
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>Prix ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>Stock initial</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductQty}
                    onChange={e => setNewProductQty(e.target.value.replace(/^0+(?=\d)/, ''))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                  Seuil d'alerte
                </label>
                <input
                  type="number"
                  min="0"
                  value={newProductThreshold}
                  onChange={e => setNewProductThreshold(e.target.value.replace(/^0+(?=\d)/, ''))}
                  style={inputStyle}
                />
                {thresholdWarning && (
                  <span style={{ fontSize: '0.74rem', color: isDark ? '#fbbf24' : '#d97706', marginTop: '3px', display: 'block' }}>
                    {thresholdWarning}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingProduct}
                style={{
                  minHeight: '44px',
                  marginTop: '10px',
                  background: accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isSubmittingProduct ? 'wait' : 'pointer'
                }}
              >
                {isSubmittingProduct ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
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
                  Agence destinataire *
                </label>
                <select
                  required
                  value={inboundAgencyId}
                  onChange={e => setInboundAgencyId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Sélectionner une agence...</option>
                  {activeSubscriptions.map(s => (
                    <option key={s.id} value={s.agencyId}>{s.agencyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: textSecondary }}>Articles à déposer</label>
                  <button
                    type="button"
                    onClick={() => setInboundItems([...inboundItems, { productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }])}
                    style={{ background: 'none', border: 'none', color: accent, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                  >
                    + Ligne
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {inboundItems.map((line, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Article"
                        required
                        value={line.productName}
                        onChange={e => {
                          const copy = [...inboundItems];
                          copy[idx].productName = e.target.value;
                          setInboundItems(copy);
                        }}
                        style={{ ...inputStyle, flex: 2 }}
                      />
                      <input
                        type="number"
                        placeholder="Qté"
                        required
                        min="1"
                        value={line.expectedQuantity}
                        onChange={e => {
                          const copy = [...inboundItems];
                          copy[idx].expectedQuantity = parseInt(e.target.value, 10) || 1;
                          setInboundItems(copy);
                        }}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {inboundItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setInboundItems(inboundItems.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer', padding: '0 4px' }}
                        >
                          <X size={16} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                  Notes ou instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex : 2 cartons scotchés"
                  value={inboundNotes}
                  onChange={e => setInboundNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: '60px', padding: '8px 10px', resize: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingInbound}
                style={{
                  minHeight: '44px',
                  marginTop: '10px',
                  background: accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isSubmittingInbound ? 'wait' : 'pointer'
                }}
              >
                {isSubmittingInbound ? 'Création...' : 'Générer le bon'}
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
