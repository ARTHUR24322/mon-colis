'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes, Plus, AlertTriangle, QrCode, Search, Building2,
  CheckCircle2, Clock, X, ChevronRight, RefreshCw, Eye,
  ArrowDownToLine, Tag, MapPin, DollarSign, PackageCheck,
  Calendar, ShieldCheck
} from 'lucide-react';
import { useCurrency } from '@/components/CurrencyContext';

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
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
}

interface VendorWarehouseTabProps {
  vendorId?: string;
  isDark?: boolean;
}

export default function VendorWarehouseTab({ vendorId, isDark = true }: VendorWarehouseTabProps) {
  const { formatPrice } = useCurrency();

  // Navigation interne
  const [subTab, setSubTab] = useState<'inventory' | 'inbound' | 'spaces'>('inventory');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Données
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalStock: 0,
    lowStockCount: 0,
    totalValuationUSD: 0
  });
  const [batches, setBatches] = useState<InboundBatch[]>([]);
  const [spaces, setSpaces] = useState<StorageSpace[]>([]);
  const [subscriptions, setSubscriptions] = useState<VendorSubscription[]>([]);

  // Modales
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<InboundBatch | null>(null);
  const [selectedSpaceForSub, setSelectedSpaceForSub] = useState<StorageSpace | null>(null);
  const [subSlotsCount, setSubSlotsCount] = useState<number>(1);
  const [subMonths, setSubMonths] = useState<number>(1);
  const [isSubmittingSub, setIsSubmittingSub] = useState<boolean>(false);

  // Formulaire Nouvel Article
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductAgencyId, setNewProductAgencyId] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Général');
  const [newProductPrice, setNewProductPrice] = useState('10');
  const [newProductQty, setNewProductQty] = useState('0');
  const [newProductThreshold, setNewProductThreshold] = useState('5');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Formulaire Nouveau Bon de Dépôt (Inbound)
  const [inboundAgencyId, setInboundAgencyId] = useState('');
  const [inboundItems, setInboundItems] = useState<Array<{ productName: string; sku: string; expectedQuantity: number; unitPrice: number }>>([
    { productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }
  ]);
  const [inboundNotes, setInboundNotes] = useState('');
  const [isSubmittingInbound, setIsSubmittingInbound] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Chargement des données
  const loadData = async () => {
    setLoading(true);
    try {
      const vParam = vendorId ? `?vendorId=${vendorId}` : '';
      
      // 1. Inventaire
      const invRes = await fetch(`/api/vendor/warehouse/inventory${vParam}`);
      if (invRes.ok) {
        const invData = await invRes.json();
        setItems(invData.items || []);
        if (invData.stats) setStats(invData.stats);
      }

      // 2. Bons d'entrée Inbound
      const inbRes = await fetch(`/api/vendor/warehouse/inbound-batches${vParam}`);
      if (inbRes.ok) {
        const inbData = await inbRes.json();
        setBatches(inbData.batches || []);
      }

      // 3. Espaces de stockage
      const spcRes = await fetch(`/api/vendor/warehouse/spaces${vParam}`);
      if (spcRes.ok) {
        const spcData = await spcRes.json();
        setSpaces(spcData.spaces || []);
        if (spcData.spaces?.length > 0 && !newProductAgencyId) {
          setNewProductAgencyId(spcData.spaces[0].agencyId);
          setInboundAgencyId(spcData.spaces[0].agencyId);
        }
      }

      // 4. Abonnements Vendeur
      const subRes = await fetch(`/api/vendor/warehouse/subscriptions${vParam}`);
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscriptions(subData.subscriptions || []);
      }
    } catch (e) {
      console.warn('Erreur chargement fulfillment:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vendorId]);

  // Création d'un nouvel article
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductAgencyId) {
      showToast('⚠️ Veuillez renseigner le nom et choisir une agence.');
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
        showToast('✅ Article ajouté avec succès à l’inventaire !');
        setShowAddProductModal(false);
        setNewProductName('');
        setNewProductSku('');
        setNewProductQty('0');
        await loadData();
      } else {
        const d = await res.json();
        showToast(`❌ Erreur: ${d.error || 'Impossible d’ajouter le produit.'}`);
      }
    } catch {
      showToast('❌ Erreur de connexion.');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Création d'un bon de dépôt (Inbound Batch)
  const handleCreateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundAgencyId) {
      showToast('⚠️ Veuillez choisir l’agence de dépôt.');
      return;
    }

    const validItems = inboundItems.filter(it => it.productName.trim() && it.expectedQuantity > 0);
    if (validItems.length === 0) {
      showToast('⚠️ Veuillez ajouter au moins un produit avec une quantité valide.');
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
          items: validItems,
          notes: inboundNotes
        })
      });

      const d = await res.json();
      if (res.ok && d.batch) {
        showToast('✅ Bon de dépôt généré ! Présentez le QR Code à l’agence.');
        setShowInboundModal(false);
        setSelectedBatchForQr(d.batch);
        setInboundItems([{ productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }]);
        setInboundNotes('');
        await loadData();
      } else {
        showToast(`❌ Erreur: ${d.error || 'Échec de la création du bon.'}`);
      }
    } catch {
      showToast('❌ Erreur réseau.');
    } finally {
      setIsSubmittingInbound(false);
    }
  };

  // Souscription à un espace de stockage en agence
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
        showToast(`✅ ${d.message || 'Souscription validée avec succès !'}`);
        setSelectedSpaceForSub(null);
        setSubSlotsCount(1);
        setSubMonths(1);
        await loadData();
      } else {
        showToast(`❌ Erreur: ${d.error || 'Échec de la souscription.'}`);
      }
    } catch {
      showToast('❌ Erreur réseau lors de la souscription.');
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const filteredItems = items.filter(it =>
    it.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    it.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    it.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.2rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: '#10b981', color: '#fff', padding: '0.75rem 1.25rem',
          borderRadius: '12px', fontWeight: '700', fontSize: '0.85rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}

      {/* Titre & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fulfillment & Stockage
          </div>
          <h2 style={{ margin: '0.1rem 0 0', fontSize: '1.3rem', fontWeight: '900', color: isDark ? '#fff' : '#0f172a' }}>
            📦 Entrepôt & Stock
          </h2>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            padding: '0.5rem 0.8rem', borderRadius: '10px',
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            color: isDark ? '#cbd5e1' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* 4 KPIs Clés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        {/* KPI 1 : Total unités */}
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          borderRadius: '16px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Stock Total</span>
            <Boxes size={18} color="#f97316" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: isDark ? '#fff' : '#0f172a' }}>
            {stats.totalStock} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' }}>unités</span>
          </div>
        </div>

        {/* KPI 2 : Alertes Stock Faible */}
        <div style={{
          background: stats.lowStockCount > 0
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
            : (isDark ? 'rgba(15, 23, 42, 0.7)' : '#fff'),
          border: `1px solid ${stats.lowStockCount > 0 ? 'rgba(239, 68, 68, 0.4)' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}`,
          borderRadius: '16px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: stats.lowStockCount > 0 ? '#ef4444' : (isDark ? '#94a3b8' : '#64748b'), fontWeight: '700' }}>Stock Faible</span>
            <AlertTriangle size={18} color={stats.lowStockCount > 0 ? '#ef4444' : '#94a3b8'} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: stats.lowStockCount > 0 ? '#ef4444' : (isDark ? '#fff' : '#0f172a') }}>
            {stats.lowStockCount} <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>réf.</span>
          </div>
        </div>

        {/* KPI 3 : Nombre de références */}
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          borderRadius: '16px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Articles Uniques</span>
            <Tag size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: isDark ? '#fff' : '#0f172a' }}>
            {stats.totalItems}
          </div>
        </div>

        {/* KPI 4 : Valeur stock */}
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          borderRadius: '16px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Valeur Estimée</span>
            <DollarSign size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#10b981' }}>
            ${stats.totalValuationUSD.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Navigation Sous-onglets */}
      <div style={{
        display: 'flex', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        padding: '0.3rem', borderRadius: '14px', gap: '0.3rem'
      }}>
        <button
          onClick={() => setSubTab('inventory')}
          style={{
            flex: 1, padding: '0.65rem 0.5rem', borderRadius: '10px', border: 'none',
            background: subTab === 'inventory' ? '#f97316' : 'transparent',
            color: subTab === 'inventory' ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
            fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          📦 Mon Stock ({items.length})
        </button>
        <button
          onClick={() => setSubTab('inbound')}
          style={{
            flex: 1, padding: '0.65rem 0.5rem', borderRadius: '10px', border: 'none',
            background: subTab === 'inbound' ? '#f97316' : 'transparent',
            color: subTab === 'inbound' ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
            fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          📑 Bons de Dépôt ({batches.length})
        </button>
        <button
          onClick={() => setSubTab('spaces')}
          style={{
            flex: 1, padding: '0.65rem 0.5rem', borderRadius: '10px', border: 'none',
            background: subTab === 'spaces' ? '#f97316' : 'transparent',
            color: subTab === 'spaces' ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
            fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          🏢 Agences ({spaces.length})
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 : INVENTAIRE PRODUITS
      ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Actions & Recherche */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{
              flex: 1, position: 'relative', display: 'flex', alignItems: 'center',
              background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: '12px', padding: '0 0.75rem'
            }}>
              <Search size={16} color={isDark ? '#94a3b8' : '#64748b'} />
              <input
                type="text"
                placeholder="Rechercher par nom, SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '0.65rem 0.5rem', background: 'transparent',
                  border: 'none', color: isDark ? '#fff' : '#0f172a', outline: 'none', fontSize: '0.82rem'
                }}
              />
            </div>
            <button
              onClick={() => setShowAddProductModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.65rem 1rem', background: '#f97316', color: '#fff',
                border: 'none', borderRadius: '12px', fontWeight: '700',
                fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              <Plus size={16} />
              <span>Article</span>
            </button>
          </div>

          {/* Liste des articles */}
          {filteredItems.length === 0 ? (
            <div style={{
              background: isDark ? 'rgba(15,23,42,0.6)' : '#fff',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
              borderRadius: '16px', padding: '2.5rem 1.5rem', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem'
            }}>
              <Boxes size={44} color="#f97316" style={{ opacity: 0.6 }} />
              <div style={{ fontWeight: '800', fontSize: '1rem', color: isDark ? '#fff' : '#0f172a' }}>
                Aucun produit dans l’entrepôt
              </div>
              <div style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b', maxWidth: '300px' }}>
                Enregistrez vos produits pour suivre vos stocks et permettre à l'agence d'expédier directement pour vous.
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                style={{
                  padding: '0.65rem 1.25rem', background: '#f97316', color: '#fff',
                  border: 'none', borderRadius: '10px', fontWeight: '700',
                  fontSize: '0.82rem', cursor: 'pointer'
                }}
              >
                + Ajouter mon premier article
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    background: isDark ? 'rgba(15,23,42,0.7)' : '#fff',
                    border: `1px solid ${item.isLowStock ? 'rgba(239, 68, 68, 0.4)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                    borderRadius: '14px', padding: '0.9rem',
                    display: 'flex', flexDirection: 'column', gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem', color: isDark ? '#fff' : '#0f172a' }}>
                        {item.productName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                        {item.sku && <span>SKU: <strong>{item.sku}</strong></span>}
                        <span>•</span>
                        <span>{item.category}</span>
                      </div>
                    </div>

                    {/* Badge Stock */}
                    <div style={{
                      padding: '0.25rem 0.6rem', borderRadius: '8px',
                      background: item.isLowStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      border: `1px solid ${item.isLowStock ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      color: item.isLowStock ? '#ef4444' : '#10b981',
                      fontWeight: '800', fontSize: '0.78rem'
                    }}>
                      {item.isLowStock ? '⚠️ Stock Faible' : 'En Stock'}
                    </div>
                  </div>

                  {/* Détails Quantités */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    padding: '0.6rem', borderRadius: '10px', textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: isDark ? '#94a3b8' : '#64748b' }}>Total</div>
                      <div style={{ fontWeight: '800', fontSize: '1rem', color: isDark ? '#fff' : '#0f172a' }}>{item.quantityInStock}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: isDark ? '#94a3b8' : '#64748b' }}>Réservé</div>
                      <div style={{ fontWeight: '800', fontSize: '1rem', color: '#f59e0b' }}>{item.quantityReserved}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: isDark ? '#94a3b8' : '#64748b' }}>Disponible</div>
                      <div style={{ fontWeight: '800', fontSize: '1rem', color: '#10b981' }}>{item.quantityAvailable}</div>
                    </div>
                  </div>

                  {/* Agence & Emplacement */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Building2 size={13} color="#f97316" />
                      <span>{item.agencyName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} color="#3b82f6" />
                      <span>{item.shelfLocation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 : BONS DE DÉPÔT INBOUND (AVEC QR CODE)
      ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'inbound' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Bouton Créer un Dépôt */}
          <button
            onClick={() => setShowInboundModal(true)}
            style={{
              width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800',
              fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)'
            }}
          >
            <ArrowDownToLine size={18} />
            <span>Nouveau Dépôt de Stock (Inbound)</span>
          </button>

          {/* Liste des bons */}
          {batches.length === 0 ? (
            <div style={{
              background: isDark ? 'rgba(15,23,42,0.6)' : '#fff',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
              borderRadius: '16px', padding: '2.5rem 1.5rem', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem'
            }}>
              <QrCode size={44} color="#f97316" style={{ opacity: 0.6 }} />
              <div style={{ fontWeight: '800', fontSize: '1rem', color: isDark ? '#fff' : '#0f172a' }}>
                Aucun bon de dépôt en cours
              </div>
              <div style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b', maxWidth: '300px' }}>
                Générez un bon de dépôt avec QR Code avant d’amener votre marchandise à l’agence pour une réception instantanée.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {batches.map(batch => (
                <div
                  key={batch.id}
                  style={{
                    background: isDark ? 'rgba(15,23,42,0.7)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: '14px', padding: '0.9rem',
                    display: 'flex', flexDirection: 'column', gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem', color: isDark ? '#fff' : '#0f172a' }}>
                        {batch.batchNumber}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                        {new Date(batch.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div style={{
                      padding: '0.25rem 0.6rem', borderRadius: '8px',
                      background: batch.status === 'RECEIVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      border: `1px solid ${batch.status === 'RECEIVED' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      color: batch.status === 'RECEIVED' ? '#10b981' : '#f59e0b',
                      fontWeight: '800', fontSize: '0.75rem'
                    }}>
                      {batch.status === 'RECEIVED' ? '✅ Réceptionné' : '⏳ En attente dépôt'}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: isDark ? '#cbd5e1' : '#334155', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Agence : <strong>{batch.agencyName}</strong></span>
                    <span>Total : <strong>{batch.totalItemsCount} unités</strong></span>
                  </div>

                  {/* Bouton QR Code */}
                  <button
                    onClick={() => setSelectedBatchForQr(batch)}
                    style={{
                      width: '100%', padding: '0.6rem', background: isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.1)',
                      border: '1px solid rgba(249, 115, 22, 0.4)', borderRadius: '10px',
                      color: '#f97316', fontWeight: '800', fontSize: '0.8rem',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                    }}
                  >
                    <QrCode size={16} />
                    <span>Afficher le QR Code de dépôt</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 : AGENCES PARTENAIRES & ESPACES DE STOCKAGE
      ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'spaces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 1. Mes Abonnements de Stockage */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <ShieldCheck size={18} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: isDark ? '#fff' : '#0f172a' }}>
                Mes Abonnements Actifs ({subscriptions.length})
              </h3>
            </div>

            {subscriptions.length === 0 ? (
              <div style={{
                background: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc',
                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: '14px', padding: '1rem', textAlign: 'center',
                fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#64748b'
              }}>
                Vous n’avez aucun abonnement de stockage en cours. Choisissez un espace ci-dessous pour réserver vos rayons.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {subscriptions.map(sub => (
                  <div
                    key={sub.id}
                    style={{
                      background: isDark ? 'rgba(15,23,42,0.7)' : '#fff',
                      border: `1px solid ${sub.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.3)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                      borderRadius: '14px', padding: '0.9rem',
                      display: 'flex', flexDirection: 'column', gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: isDark ? '#fff' : '#0f172a' }}>
                          {sub.spaceName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#f97316', fontWeight: '700' }}>
                          🏢 {sub.agencyName} {sub.agencyPhone ? `• ${sub.agencyPhone}` : ''}
                        </div>
                      </div>
                      <div style={{
                        padding: '0.2rem 0.6rem', borderRadius: '8px',
                        background: sub.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${sub.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: sub.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                        fontWeight: '800', fontSize: '0.72rem'
                      }}>
                        {sub.status === 'ACTIVE' ? '✅ Actif' : sub.status}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: isDark ? '#cbd5e1' : '#334155' }}>
                      <span>Emplacements : <strong>{sub.slotsCount} slot(s)</strong></span>
                      <span style={{ fontWeight: '700', color: '#10b981' }}>${sub.pricePaid} réglé</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, paddingTop: '0.4rem' }}>
                      <span>Du {new Date(sub.startDate).toLocaleDateString('fr-FR')} au {new Date(sub.endDate).toLocaleDateString('fr-FR')}</span>
                      <span>{sub.autoRenew ? '🔄 Renouvellement auto' : 'Paiement unique'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Offres d'Espaces Disponibles */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <Building2 size={18} color="#f97316" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: isDark ? '#fff' : '#0f172a' }}>
                Offres de Stockage des Agences ({spaces.length})
              </h3>
            </div>

            {spaces.length === 0 ? (
              <div style={{
                background: isDark ? 'rgba(15,23,42,0.6)' : '#fff',
                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                borderRadius: '16px', padding: '2.5rem 1.5rem', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem'
              }}>
                <Building2 size={44} color="#f97316" style={{ opacity: 0.6 }} />
                <div style={{ fontWeight: '800', fontSize: '1rem', color: isDark ? '#fff' : '#0f172a' }}>
                  Aucun espace configuré
                </div>
                <div style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b', maxWidth: '300px' }}>
                  Les agences partenaires publieront bientôt leurs offres de stockage (étagères, box, m³).
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {spaces.map(space => (
                  <div
                    key={space.id}
                    style={{
                      background: isDark ? 'rgba(15,23,42,0.7)' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: '14px', padding: '0.9rem',
                      display: 'flex', flexDirection: 'column', gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: isDark ? '#fff' : '#0f172a' }}>
                          {space.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#f97316', fontWeight: '700', marginTop: '0.1rem' }}>
                          🏢 {space.agencyName}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#10b981' }}>
                          ${space.pricePerMonth}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isDark ? '#94a3b8' : '#64748b' }}>/ mois / place</div>
                      </div>
                    </div>

                    {space.description && (
                      <div style={{ fontSize: '0.78rem', color: isDark ? '#cbd5e1' : '#475569' }}>
                        {space.description}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: isDark ? '#94a3b8' : '#64748b', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, paddingTop: '0.5rem' }}>
                      <span>Disponibilité : <strong>{space.availableSlots} places restantes</strong></span>
                      {space.dimensions && <span>Dimensions : <strong>{space.dimensions}</strong></span>}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedSpaceForSub(space);
                        setSubSlotsCount(1);
                        setSubMonths(1);
                      }}
                      disabled={space.availableSlots <= 0}
                      style={{
                        width: '100%', padding: '0.6rem',
                        background: space.availableSlots > 0 ? '#f97316' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                        color: '#fff', border: 'none', borderRadius: '10px',
                        fontWeight: '800', fontSize: '0.8rem',
                        cursor: space.availableSlots > 0 ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                      }}
                    >
                      <DollarSign size={15} />
                      <span>{space.availableSlots > 0 ? 'Louer cet emplacement' : 'Complet'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 1 : AJOUTER UN NOUVEL ARTICLE AU STOCK
      ═══════════════════════════════════════════════════════════════════ */}
      {showAddProductModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
            borderRadius: '20px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', color: isDark ? '#fff' : '#0f172a' }}>
                📦 Nouvel Article en Stock
              </div>
              <button onClick={() => setShowAddProductModal(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Nom du Produit *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: T-Shirt Noir Taille L"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '10px',
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Agence Partenaire de Stockage *</label>
                <select
                  required
                  value={newProductAgencyId}
                  onChange={e => setNewProductAgencyId(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '10px',
                    background: isDark ? '#1e293b' : '#f8fafc',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem'
                  }}
                >
                  <option value="">Sélectionner une agence...</option>
                  {spaces.map(s => (
                    <option key={s.id} value={s.agencyId}>{s.agencyName} ({s.name})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>SKU / Réf Vendeur</label>
                  <input
                    type="text"
                    placeholder="Ex: TSH-BLK-L"
                    value={newProductSku}
                    onChange={e => setNewProductSku(e.target.value)}
                    style={{
                      width: '100%', padding: '0.65rem', borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                      color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Prix unitaire ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value)}
                    style={{
                      width: '100%', padding: '0.65rem', borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                      color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Stock Initial (unités)</label>
                  <input
                    type="number"
                    value={newProductQty}
                    onChange={e => setNewProductQty(e.target.value)}
                    style={{
                      width: '100%', padding: '0.65rem', borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                      color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Seuil d’alerte</label>
                  <input
                    type="number"
                    value={newProductThreshold}
                    onChange={e => setNewProductThreshold(e.target.value)}
                    style={{
                      width: '100%', padding: '0.65rem', borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                      color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingProduct}
                style={{
                  marginTop: '0.5rem', width: '100%', padding: '0.85rem',
                  background: '#f97316', color: '#fff', border: 'none',
                  borderRadius: '12px', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                {isSubmittingProduct ? 'Enregistrement...' : 'Enregistrer l’Article'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 2 : NOUVEAU BON DE DÉPÔT INBOUND
      ═══════════════════════════════════════════════════════════════════ */}
      {showInboundModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
            borderRadius: '20px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', color: isDark ? '#fff' : '#0f172a' }}>
                📑 Nouveau Dépôt de Marchandise
              </div>
              <button onClick={() => setShowInboundModal(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateInbound} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Agence de destination du dépôt *</label>
                <select
                  required
                  value={inboundAgencyId}
                  onChange={e => setInboundAgencyId(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '10px',
                    background: isDark ? '#1e293b' : '#f8fafc',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem'
                  }}
                >
                  <option value="">Sélectionner une agence...</option>
                  {spaces.map(s => (
                    <option key={s.id} value={s.agencyId}>{s.agencyName} ({s.name})</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Articles à déposer</label>
                  <button
                    type="button"
                    onClick={() => setInboundItems([...inboundItems, { productName: '', sku: '', expectedQuantity: 10, unitPrice: 0 }])}
                    style={{ background: 'transparent', border: 'none', color: '#f97316', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    + Ajouter une ligne
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {inboundItems.map((line, idx) => (
                    <div key={idx} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.4rem', alignItems: 'center',
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '10px'
                    }}>
                      <input
                        type="text"
                        placeholder="Produit"
                        required
                        value={line.productName}
                        onChange={e => {
                          const copy = [...inboundItems];
                          copy[idx].productName = e.target.value;
                          setInboundItems(copy);
                        }}
                        style={{
                          padding: '0.5rem', borderRadius: '8px',
                          background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          color: isDark ? '#fff' : '#0f172a', outline: 'none', fontSize: '0.8rem'
                        }}
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
                        style={{
                          padding: '0.5rem', borderRadius: '8px',
                          background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          color: isDark ? '#fff' : '#0f172a', outline: 'none', fontSize: '0.8rem'
                        }}
                      />
                      {inboundItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setInboundItems(inboundItems.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Remarques ou instructions</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Colis fragiles, 2 cartons scotchés..."
                  value={inboundNotes}
                  onChange={e => setInboundNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '10px',
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    color: isDark ? '#fff' : '#0f172a', outline: 'none', marginTop: '0.3rem', fontSize: '0.8rem'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingInbound}
                style={{
                  marginTop: '0.5rem', width: '100%', padding: '0.85rem',
                  background: '#f97316', color: '#fff', border: 'none',
                  borderRadius: '12px', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                {isSubmittingInbound ? 'Génération...' : 'Valider & Obtenir le QR Code'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 3 : AFFICHAGE DU QR CODE DE DÉPÔT
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedBatchForQr && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
            borderRadius: '24px', width: '100%', maxWidth: '380px', padding: '1.5rem', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Bon de Dépôt</div>
                <div style={{ fontWeight: '900', fontSize: '1.05rem', color: isDark ? '#fff' : '#0f172a' }}>{selectedBatchForQr.batchNumber}</div>
              </div>
              <button onClick={() => setSelectedBatchForQr(null)} style={{ background: 'transparent', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Image QR Code */}
            <div style={{
              background: '#fff', padding: '1rem', borderRadius: '18px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)', border: '1px solid rgba(0,0,0,0.1)'
            }}>
              <img
                src={selectedBatchForQr.qrImageUrl}
                alt={`QR Bon ${selectedBatchForQr.batchNumber}`}
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1.4 }}>
              Présentez ce QR Code à l'agent d'entrepôt de l'agence <strong>{selectedBatchForQr.agencyName}</strong> pour valider la réception physique de vos <strong>{selectedBatchForQr.totalItemsCount} articles</strong>.
            </div>

            <button
              onClick={() => setSelectedBatchForQr(null)}
              style={{
                width: '100%', padding: '0.75rem', background: '#f97316', color: '#fff',
                border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 4 : SOUSCRIPTION À UN EMPLACEMENT DE STOCKAGE
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedSpaceForSub && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
            borderRadius: '24px', width: '100%', maxWidth: '420px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Location Stockage</div>
                <div style={{ fontWeight: '900', fontSize: '1.15rem', color: isDark ? '#fff' : '#0f172a' }}>{selectedSpaceForSub.name}</div>
              </div>
              <button onClick={() => setSelectedSpaceForSub(null)} style={{ background: 'transparent', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: '14px', padding: '0.85rem', fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#334155',
              display: 'flex', flexDirection: 'column', gap: '0.35rem'
            }}>
              <div>🏢 Agence : <strong>{selectedSpaceForSub.agencyName}</strong></div>
              <div>📍 Adresse : {selectedSpaceForSub.agencyAddress || 'Non spécifiée'}</div>
              <div>📦 Tarif : <strong>${selectedSpaceForSub.pricePerMonth} / mois / slot</strong></div>
              <div>⚡ Places disponibles : <strong>{selectedSpaceForSub.availableSlots} slot(s)</strong></div>
            </div>

            <form onSubmit={handleCreateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Nombre de slots */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: isDark ? '#cbd5e1' : '#475569' }}>
                  Nombre d’emplacements / slots souhaités :
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {[1, 2, 3, 5].map(n => (
                    <button
                      type="button"
                      key={n}
                      disabled={n > selectedSpaceForSub.availableSlots}
                      onClick={() => setSubSlotsCount(n)}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: '10px',
                        border: subSlotsCount === n ? '2px solid #f97316' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        background: subSlotsCount === n ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                        color: subSlotsCount === n ? '#f97316' : (isDark ? '#fff' : '#0f172a'),
                        fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: isDark ? '#cbd5e1' : '#475569' }}>
                  Durée de l’abonnement :
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {[
                    { m: 1, label: '1 mois' },
                    { m: 3, label: '3 mois' },
                    { m: 6, label: '6 mois' },
                    { m: 12, label: '1 an' }
                  ].map(item => (
                    <button
                      type="button"
                      key={item.m}
                      onClick={() => setSubMonths(item.m)}
                      style={{
                        flex: 1, padding: '0.5rem 0.2rem', borderRadius: '10px',
                        border: subMonths === item.m ? '2px solid #10b981' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        background: subMonths === item.m ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        color: subMonths === item.m ? '#10b981' : (isDark ? '#fff' : '#0f172a'),
                        fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Récapitulatif Prix */}
              <div style={{
                background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '14px',
                padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b' }}>Total à régler</div>
                  <div style={{ fontSize: '0.78rem', color: isDark ? '#cbd5e1' : '#334155' }}>
                    {subSlotsCount} slot(s) × {subMonths} mois
                  </div>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#10b981' }}>
                  ${(selectedSpaceForSub.pricePerMonth * subSlotsCount * subMonths).toFixed(2)}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSub}
                style={{
                  marginTop: '0.25rem', width: '100%', padding: '0.85rem',
                  background: '#10b981', color: '#fff', border: 'none',
                  borderRadius: '12px', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                {isSubmittingSub ? 'Validation...' : 'Confirmer la souscription'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
