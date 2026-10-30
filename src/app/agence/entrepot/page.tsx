'use client';

import { useState, useEffect, useCallback } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  Boxes, QrCode, Search, CheckCircle2, AlertTriangle, Building2,
  Package, Plus, X, RefreshCw, MapPin, Tag, ArrowDownToLine,
  Check, User, Clock, ClipboardList, Truck, Printer,
  RotateCcw, DollarSign, ShieldCheck
} from 'lucide-react';
import { normalizeAgencyRole, hasAgencyPermission } from '@/lib/agencyPermissions';

// ─── Utilitaire dates (fuseau Africa/Kinshasa) ─────────────────────────────
function safeFormatDate(val: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Kinshasa', day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

// ─── Clé d'idempotence ─────────────────────────────────────────────────────
function makeIdempotencyKey(prefix: string, id: string): string {
  return `${prefix}-${id}-${Date.now()}`;
}

interface InboundBatch {
  id: string;
  batchNumber: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  status: 'PENDING' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
  items: Array<{
    productName: string;
    sku?: string;
    expectedQuantity: number;
    receivedQuantity?: number;
    shelfLocation?: string;
    unitPrice?: number;
  }>;
  totalItemsCount: number;
  receivedItemsCount?: number;
  qrToken?: string;
  notes?: string;
  createdAt: string;
}

interface InventoryRow {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  productName: string;
  sku: string;
  category: string;
  quantityInStock: number;
  quantityReserved: number;
  quantityAvailable: number;
  shelfLocation: string;
  isLowStock: boolean;
}

interface StorageSpaceRow {
  id: string;
  name: string;
  description: string;
  total_slots: number;
  available_slots: number;
  price_per_month: number;
  currency: string;
  dimensions: string;
  max_weight_per_slot?: number;
}

interface PickingOrder {
  id: string;
  packageId: string;
  trackingCode: string;
  clientName: string;
  clientAddress: string;
  clientCommune: string;
  clientPhone: string;
  packageStatus: string;
  pickingStatus: 'TO_PICK' | 'PICKED' | 'ASSIGNED' | 'DELIVERED';
  inventoryId: string;
  productName: string;
  sku: string;
  shelfLocation: string;
  quantity: number;
  currentStock: number;
  createdAt: string;
}

interface DriverOption {
  id: string;
  name: string;
  phone: string;
}

interface AgencySubscriptionRow {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  vendorEmail: string;
  spaceId: string;
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

interface WarehouseReturnRow {
  id: string;
  trackingCode: string;
  recipientName: string;
  recipientPhone: string;
  destination: string;
  status: string;
  amount: number;
  warehouseItemId: string;
  productName: string;
  createdAt: string;
}

export default function AgencyWarehousePage() {
  const { user } = useAuth('agence');
  const { formatPrice } = useCurrency();
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canScan = hasAgencyPermission(userRole, 'canScanPackages');

  // Navigation interne
  const [activeTab, setActiveTab] = useState<'reception' | 'picking' | 'inventory' | 'spaces' | 'returns'>('reception');

  // Picking & Préparation
  const [pickingOrders, setPickingOrders] = useState<PickingOrder[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [processingPickingId, setProcessingPickingId] = useState<string | null>(null);

  // Scan & Recherche de Bon
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundBatch, setFoundBatch] = useState<InboundBatch | null>(null);

  // Formulaire de validation de réception
  const [itemsToReceive, setItemsToReceive] = useState<Array<{
    productName: string;
    sku?: string;
    expectedQuantity: number;
    receivedQuantity: number;
    shelfLocation: string;
  }>>([]);
  const [globalShelf, setGlobalShelf] = useState('Rayon A - Étagère 1');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveSuccess, setReceiveSuccess] = useState<string | null>(null);

  // Historique & Listes
  const [recentBatches, setRecentBatches] = useState<InboundBatch[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [spaces, setSpaces] = useState<StorageSpaceRow[]>([]);
  const [agencySubscriptions, setAgencySubscriptions] = useState<AgencySubscriptionRow[]>([]);
  // Abonnements PENDING en attente de décision de l'agence
  const [pendingSubscriptions, setPendingSubscriptions] = useState<AgencySubscriptionRow[]>([]);
  const [isReviewingSub, setIsReviewingSub] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [totalSubscriptionRevenueUSD, setTotalSubscriptionRevenueUSD] = useState<number>(0);
  const [returnedPackages, setReturnedPackages] = useState<WarehouseReturnRow[]>([]);
  const [selectedReturnForRestock, setSelectedReturnForRestock] = useState<WarehouseReturnRow | null>(null);
  const [restockCondition, setRestockCondition] = useState<'OK' | 'DAMAGED'>('OK');
  const [restockLocation, setRestockLocation] = useState('Rayon A - Étagère 1');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // Modal Nouvel Espace
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceDesc, setSpaceDesc] = useState('');
  const [spaceSlots, setSpaceSlots] = useState('20');
  const [spacePrice, setSpacePrice] = useState('25');
  const [spaceCurrency, setSpaceCurrency] = useState('USD');
  const [spaceDims, setSpaceDims] = useState('120x60x50 cm');
  const [isSubmittingSpace, setIsSubmittingSpace] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Chargement des données de l'agence
  const loadAgencyWarehouseData = async () => {
    setLoadingData(true);
    try {
      // 1. Bons récents
      const bRes = await fetch('/api/agency/warehouse/inbound-batches');
      if (bRes.ok) {
        const bData = await bRes.json();
        setRecentBatches(bData.batches || []);
      }

      // 2. Inventaire
      const invRes = await fetch('/api/agency/warehouse/inventory');
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventory(invData.items || []);
      }

      // 3. Espaces
      const spcRes = await fetch('/api/agency/warehouse/spaces');
      if (spcRes.ok) {
        const spcData = await spcRes.json();
        setSpaces(spcData.spaces || []);
      }

      // 4. Ordres de Picking
      const pickRes = await fetch('/api/agency/warehouse/picking');
      if (pickRes.ok) {
        const pickData = await pickRes.json();
        setPickingOrders(pickData.orders || []);
        setDrivers(pickData.drivers || []);
      }

      // 5. Abonnements et Revenus de stockage
      const subRes = await fetch('/api/agency/warehouse/subscriptions');
      if (subRes.ok) {
        const subData = await subRes.json();
        const allSubs: AgencySubscriptionRow[] = subData.subscriptions || [];
        setAgencySubscriptions(allSubs.filter(s => s.status === 'ACTIVE'));
        setPendingSubscriptions(allSubs.filter(s => s.status === 'PENDING'));
        setTotalSubscriptionRevenueUSD(subData.totalRevenueUSD || 0);
      }

      // 6. Colis en retour pour réintégration en stock
      const retRes = await fetch('/api/agency/warehouse/returns');
      if (retRes.ok) {
        const retData = await retRes.json();
        setReturnedPackages(retData.returns || []);
      }
    } catch (e) {
      console.warn('Erreur chargement entrepôt:', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Action de réintégration d'un retour colis en stock rayon
  const handleReintegrateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnForRestock) return;

    setIsSubmittingRestock(true);
    try {
      const res = await fetch('/api/agency/warehouse/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colisId: selectedReturnForRestock.id,
          condition: restockCondition,
          shelfLocation: restockLocation
        })
      });

      const d = await res.json();
      if (res.ok && d.success) {
        showToast(`✅ ${d.message || 'Retour traité avec succès !'}`);
        setSelectedReturnForRestock(null);
        await loadAgencyWarehouseData();
      } else {
        showToast(`❌ Erreur: ${d.error || 'Échec de la réintégration.'}`);
      }
    } catch {
      showToast('❌ Erreur réseau lors de la réintégration.');
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // Action de Picking (Prélèvement en rayon)
  const handleExecutePick = async (orderId: string) => {
    setProcessingPickingId(orderId);
    try {
      const res = await fetch(`/api/agency/warehouse/picking/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pick' })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('✅ Article prélevé en rayon et prêt à l\'expédition !');
        await loadAgencyWarehouseData();
      } else {
        showToast(`❌ Erreur: ${data.error || 'Échec du prélèvement.'}`);
      }
    } catch {
      showToast('❌ Erreur de communication.');
    } finally {
      setProcessingPickingId(null);
    }
  };

  // Action de Remise directe au livreur
  const handleExecuteHandover = async (orderId: string) => {
    const driverId = selectedDrivers[orderId];
    if (!driverId) {
      showToast('⚠️ Veuillez sélectionner un livreur.');
      return;
    }

    setProcessingPickingId(orderId);
    try {
      const res = await fetch(`/api/agency/warehouse/picking/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Clé d'idempotence : un second clic avec la même clé sera ignoré côté serveur
        body: JSON.stringify({ action: 'handover', driverId, idempotencyKey: makeIdempotencyKey('handover', orderId) })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('🚀 Colis remis au livreur ! Course démarrée sans ramassage.');
        await loadAgencyWarehouseData();
      } else {
        showToast(`❌ Erreur: ${data.error || 'Échec de la remise au livreur.'}`);
      }
    } catch {
      showToast('❌ Erreur de communication.');
    } finally {
      setProcessingPickingId(null);
    }
  };

  useEffect(() => {
    loadAgencyWarehouseData();
  }, []);

  // Recherche de bon par numéro ou token QR
  const handleSearchBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setFoundBatch(null);
    setReceiveSuccess(null);

    try {
      // Si c'est du JSON scanné depuis le QR
      let cleanQuery = query;
      try {
        const parsed = JSON.parse(query);
        if (parsed.token) cleanQuery = parsed.token;
        else if (parsed.batchNumber) cleanQuery = parsed.batchNumber;
      } catch {}

      const res = await fetch(`/api/agency/warehouse/inbound-batches?code=${encodeURIComponent(cleanQuery)}`);
      const data = await res.json();

      if (res.ok && data.batches && data.batches.length > 0) {
        const batch: InboundBatch = data.batches[0];
        setFoundBatch(batch);

        // Initialiser les articles à recevoir
        setItemsToReceive(
          (batch.items || []).map(it => ({
            productName: it.productName,
            sku: it.sku || '',
            expectedQuantity: it.expectedQuantity,
            receivedQuantity: it.receivedQuantity && it.receivedQuantity > 0 ? it.receivedQuantity : it.expectedQuantity,
            shelfLocation: it.shelfLocation || globalShelf
          }))
        );
      } else {
        setSearchError('Aucun bon de dépôt trouvé avec cette référence ou ce QR Code.');
      }
    } catch {
      setSearchError('Erreur de connexion au serveur.');
    } finally {
      setIsSearching(false);
    }
  };

  // Validation de la réception physique
  const handleConfirmReceive = async () => {
    if (!foundBatch) return;

    setIsReceiving(true);
    try {
      const res = await fetch(`/api/agency/warehouse/inbound-batches/${foundBatch.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToReceive,
          shelfLocationGlobal: globalShelf,
          notes: receiveNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        setReceiveSuccess(data.message || 'Réception confirmée avec succès ! Les articles sont en stock.');
        showToast('✅ Entrée en stock validée !');
        setFoundBatch(null);
        setSearchInput('');
        await loadAgencyWarehouseData();
      } else {
        showToast(`❌ Erreur: ${data.error || 'Échec de la réception'}`);
      }
    } catch {
      showToast('❌ Erreur de communication.');
    } finally {
      setIsReceiving(false);
    }
  };

  // Création d'un espace de stockage
  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceName.trim()) return;

    setIsSubmittingSpace(true);
    try {
      const res = await fetch('/api/agency/warehouse/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: spaceName.trim(),
          description: spaceDesc.trim(),
          totalSlots: spaceSlots,
          pricePerMonth: spacePrice,
          currency: spaceCurrency,
          dimensions: spaceDims.trim()
        })
      });

      if (res.ok) {
        showToast('✅ Espace de stockage créé avec succès !');
        setShowAddSpaceModal(false);
        setSpaceName('');
        setSpaceDesc('');
        await loadAgencyWarehouseData();
      } else {
        const d = await res.json();
        showToast(`❌ Erreur: ${d.error || 'Impossible de créer l’espace.'}`);
      }
    } catch {
      showToast('❌ Erreur réseau.');
    } finally {
      setIsSubmittingSpace(false);
    }
  };

  const filteredInventory = inventory.filter(it =>
    it.productName.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    it.sku.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    it.vendorName.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    it.shelfLocation.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
            background: '#10b981', color: '#fff', padding: '0.85rem 1.4rem',
            borderRadius: '12px', fontWeight: '800', fontSize: '0.9rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '0.6rem'
          }}>
            <CheckCircle2 size={18} />
            <span>{toast}</span>
          </div>
        )}

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#f97316', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
              Fulfillment & Logistique
            </div>
            <h1 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: '900', color: 'inherit' }}>
              📦 Entrepôt & Gestion des Stocks
            </h1>
          </div>

          <button
            onClick={loadAgencyWarehouseData}
            disabled={loadingData}
            style={{
              padding: '0.65rem 1rem', borderRadius: '10px', background: 'rgba(249, 115, 22, 0.1)',
              border: '1px solid rgba(249, 115, 22, 0.3)', color: '#f97316', fontWeight: '700',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={16} className={loadingData ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Onglets */}
        <div style={{
          display: 'flex', background: 'rgba(15, 23, 42, 0.05)', padding: '0.35rem',
          borderRadius: '14px', gap: '0.35rem', width: 'fit-content', flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('reception')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'reception' ? '#f97316' : 'transparent',
              color: activeTab === 'reception' ? '#fff' : 'inherit',
              fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <QrCode size={16} />
            <span>Scan & Réception Dépôt</span>
          </button>
          <button
            onClick={() => setActiveTab('picking')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'picking' ? '#f97316' : 'transparent',
              color: activeTab === 'picking' ? '#fff' : 'inherit',
              fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <ClipboardList size={16} />
            <span>📋 Picking & Expédition ({pickingOrders.filter(o => o.pickingStatus !== 'DELIVERED').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'inventory' ? '#f97316' : 'transparent',
              color: activeTab === 'inventory' ? '#fff' : 'inherit',
              fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <Boxes size={16} />
            <span>Inventaire Entrepôt ({inventory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('spaces')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'spaces' ? '#f97316' : 'transparent',
              color: activeTab === 'spaces' ? '#fff' : 'inherit',
              fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <Building2 size={16} />
            <span>Rayons & Espaces ({spaces.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'returns' ? '#f97316' : 'transparent',
              color: activeTab === 'returns' ? '#fff' : 'inherit',
              fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <RotateCcw size={16} />
            <span>↩️ Retours en Rayon ({returnedPackages.length})</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1 : SCAN & RÉCEPTION DE DÉPÔT INBOUND
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reception' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Formulaire de Scan / Recherche */}
            <div style={{
              background: 'var(--agency-card-bg, #fff)', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
              borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                🔍 Scanner ou Saisir le Bon de Dépôt Vendeur
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
                Scannez le QR Code présenté par le vendeur ou saisissez le code du bon (ex: <strong>INB-2026-0042</strong> ou jeton QR).
              </div>

              <form onSubmit={handleSearchBatch} style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    required
                    placeholder="Numéro INB-2026-... ou coller le contenu du QR Code"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    style={{
                      width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', borderRadius: '12px',
                      border: '1px solid var(--agency-input-border, #cbd5e1)', outline: 'none',
                      fontSize: '0.95rem', fontWeight: '600'
                    }}
                  />
                  <QrCode size={20} color="#f97316" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  style={{
                    padding: '0.85rem 1.75rem', background: '#f97316', color: '#fff',
                    border: 'none', borderRadius: '12px', fontWeight: '800',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'
                  }}
                >
                  <Search size={18} />
                  <span>{isSearching ? 'Recherche...' : 'Rechercher le Bon'}</span>
                </button>
              </form>

              {searchError && (
                <div style={{ marginTop: '1rem', padding: '0.8rem 1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} />
                  <span>{searchError}</span>
                </div>
              )}

              {receiveSuccess && (
                <div style={{ marginTop: '1rem', padding: '0.85rem 1.25rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CheckCircle2 size={20} />
                  <span>{receiveSuccess}</span>
                </div>
              )}
            </div>

            {/* Bon Trouvé : Formulaire de vérification et attribution d'emplacement */}
            {foundBatch && (
              <div style={{
                background: 'var(--agency-card-bg, #fff)', border: '2px solid #f97316',
                borderRadius: '20px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#f97316', fontWeight: '800', textTransform: 'uppercase' }}>
                      Bon de Dépôt Identifié
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '900' }}>
                      {foundBatch.batchNumber}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Vendeur : <strong>{foundBatch.vendorName}</strong> {foundBatch.vendorPhone && `(${foundBatch.vendorPhone})`}
                    </div>
                  </div>

                  <div style={{
                    padding: '0.4rem 0.9rem', borderRadius: '8px',
                    background: foundBatch.status === 'RECEIVED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: foundBatch.status === 'RECEIVED' ? '#10b981' : '#f59e0b',
                    fontWeight: '800', fontSize: '0.85rem'
                  }}>
                    {foundBatch.status === 'RECEIVED' ? 'Déjà Réceptionné' : 'En Attente de Contrôle'}
                  </div>
                </div>

                {/* Emplacement par défaut */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(249, 115, 22, 0.06)', padding: '0.9rem 1.2rem', borderRadius: '12px' }}>
                  <MapPin size={20} color="#f97316" />
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '800', display: 'block', marginBottom: '0.2rem' }}>
                      Emplacement physique par défaut dans l'entrepôt :
                    </label>
                    <input
                      type="text"
                      value={globalShelf}
                      onChange={e => setGlobalShelf(e.target.value)}
                      placeholder="Ex: Rayon B - Étagère 3 - Box 4"
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                        border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600'
                      }}
                    />
                  </div>
                </div>

                {/* Tableau de contrôle des articles */}
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                    Articles déclarés dans le bon ({itemsToReceive.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {itemsToReceive.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '0.75rem',
                          alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '0.85rem', borderRadius: '12px',
                          border: '1px solid rgba(0,0,0,0.06)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{it.productName}</div>
                          {it.sku && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Réf / SKU: {it.sku}</div>}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>
                            Prévu : <strong>{it.expectedQuantity}</strong> | Reçu :
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={it.receivedQuantity}
                            onChange={e => {
                              const copy = [...itemsToReceive];
                              copy[idx].receivedQuantity = parseInt(e.target.value, 10) || 0;
                              setItemsToReceive(copy);
                            }}
                            style={{
                              width: '100%', padding: '0.45rem', borderRadius: '8px',
                              border: '1px solid #cbd5e1', fontWeight: '800', textAlign: 'center', fontSize: '0.95rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>
                            Emplacement spécifique :
                          </label>
                          <input
                            type="text"
                            value={it.shelfLocation}
                            onChange={e => {
                              const copy = [...itemsToReceive];
                              copy[idx].shelfLocation = e.target.value;
                              setItemsToReceive(copy);
                            }}
                            style={{
                              width: '100%', padding: '0.45rem', borderRadius: '8px',
                              border: '1px solid #cbd5e1', fontSize: '0.82rem'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setFoundBatch(null)}
                    style={{
                      padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1',
                      background: 'transparent', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReceive}
                    disabled={isReceiving || foundBatch.status === 'RECEIVED'}
                    style={{
                      padding: '0.75rem 1.75rem', borderRadius: '12px', border: 'none',
                      background: '#10b981', color: '#fff', fontWeight: '800', fontSize: '0.95rem',
                      cursor: foundBatch.status === 'RECEIVED' ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                  >
                    <CheckCircle2 size={18} />
                    <span>{isReceiving ? 'Validation en cours...' : 'Confirmer la Réception & Entrée en Stock'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bons récents de l'agence */}
            <div style={{
              background: 'var(--agency-card-bg, #fff)', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
              borderRadius: '20px', padding: '1.5rem'
            }}>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', marginBottom: '1rem' }}>
                📑 Derniers Bons de Dépôt Présentés
              </div>
              {recentBatches.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                  Aucun bon de dépôt enregistré pour cette agence pour le moment.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {recentBatches.slice(0, 10).map(b => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.02)',
                        border: '1px solid rgba(0,0,0,0.05)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{b.batchNumber}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Vendeur: <strong>{b.vendorName}</strong> • {b.totalItemsCount} articles déclarés
                        </div>
                      </div>
                      <div style={{
                        padding: '0.25rem 0.6rem', borderRadius: '8px',
                        background: b.status === 'RECEIVED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: b.status === 'RECEIVED' ? '#10b981' : '#f59e0b',
                        fontWeight: '800', fontSize: '0.75rem'
                      }}>
                        {b.status === 'RECEIVED' ? '✅ Réceptionné' : '⏳ En attente'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2 : PRÉPARATION DE COMMANDES (PICKING EN ENTREPÔT)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'picking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.03))',
              border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '16px', padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ClipboardList size={26} color="#f97316" />
                <div>
                  <div style={{ fontWeight: '900', fontSize: '1rem', color: '#f97316' }}>
                    Commandes Fulfillment Prêtes au Picking
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Ces colis proviennent des stocks déjà présents dans votre entrepôt. Aucun déplacement de ramassage nécessaire !
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>
                {pickingOrders.filter(o => o.pickingStatus !== 'DELIVERED').length} colis à expédier
              </div>
            </div>

            {pickingOrders.length === 0 ? (
              <div style={{
                background: 'var(--agency-card-bg, #fff)', border: '1px dashed var(--agency-card-border, rgba(0,0,0,0.15))',
                borderRadius: '20px', padding: '3rem 1.5rem', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
              }}>
                <Boxes size={44} color="#94a3b8" />
                <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>Aucune commande en attente de préparation</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '350px' }}>
                  Dès qu'un vendeur déclenche une expédition depuis son stock dans votre entrepôt, sa fiche de picking apparaîtra ici.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {pickingOrders.map(order => (
                  <div
                    key={order.id}
                    style={{
                      background: 'var(--agency-card-bg, #fff)',
                      border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
                      borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '900', fontSize: '1.05rem', color: '#f97316' }}>{order.trackingCode}</span>
                          <span style={{
                            padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800',
                            background: order.pickingStatus === 'ASSIGNED' ? 'rgba(16,185,129,0.15)' : order.pickingStatus === 'PICKED' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color: order.pickingStatus === 'ASSIGNED' ? '#10b981' : order.pickingStatus === 'PICKED' ? '#3b82f6' : '#f59e0b'
                          }}>
                            {order.pickingStatus === 'ASSIGNED' ? '🚀 Remis au livreur' : order.pickingStatus === 'PICKED' ? '📦 Prélevé (Prêt)' : '⏳ À prélever en rayon'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Client : <strong>{order.clientName}</strong> ({order.clientCommune}) • {order.clientAddress}
                        </div>
                      </div>

                      <button
                        onClick={() => window.print()}
                        style={{
                          padding: '0.45rem 0.85rem', borderRadius: '8px', background: 'rgba(0,0,0,0.04)',
                          border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: '700'
                        }}
                      >
                        <Printer size={14} />
                        <span>Imprimer Fiche</span>
                      </button>
                    </div>

                    {/* Fiche de prélèvement (Rayon / Produit) */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem',
                      background: 'rgba(0,0,0,0.02)', padding: '0.9rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Article à prélever</div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{order.productName}</div>
                        {order.sku && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>SKU : {order.sku}</div>}
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Quantité</div>
                        <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#f97316' }}>{order.quantity} unité(s)</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Emplacement Rayon</div>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          background: 'rgba(59,130,246,0.12)', color: '#3b82f6', padding: '0.3rem 0.6rem',
                          borderRadius: '8px', fontWeight: '900', fontSize: '0.88rem', marginTop: '0.15rem'
                        }}>
                          <MapPin size={14} />
                          <span>{order.shelfLocation}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions de Préparation & Expédition */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem' }}>
                      {order.pickingStatus === 'TO_PICK' && (
                        <button
                          onClick={() => handleExecutePick(order.id)}
                          disabled={processingPickingId === order.id}
                          style={{
                            padding: '0.65rem 1.25rem', background: '#3b82f6', color: '#fff',
                            border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.85rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                          }}
                        >
                          <Check size={16} />
                          <span>{processingPickingId === order.id ? 'Prélèvement...' : 'Valider le Prélèvement en Rayon'}</span>
                        </button>
                      )}

                      {/* Remise au livreur */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                        <select
                          value={selectedDrivers[order.id] || ''}
                          onChange={e => setSelectedDrivers({ ...selectedDrivers, [order.id]: e.target.value })}
                          style={{
                            padding: '0.55rem 0.75rem', borderRadius: '10px',
                            border: '1px solid var(--agency-input-border, #cbd5e1)',
                            fontSize: '0.82rem', fontWeight: '600'
                          }}
                        >
                          <option value="">-- Choisir un livreur --</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleExecuteHandover(order.id)}
                          disabled={processingPickingId === order.id}
                          style={{
                            padding: '0.65rem 1.25rem', background: '#10b981', color: '#fff',
                            border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.85rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                          }}
                        >
                          <Truck size={16} />
                          <span>Remettre au Livreur</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2 : INVENTAIRE EN ENTREPÔT
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Recherche */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: 'var(--agency-card-bg, #fff)', padding: '0.75rem 1rem',
              borderRadius: '14px', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))'
            }}>
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Filtrer par article, SKU, vendeur, ou étagère..."
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '0.9rem' }}
              />
            </div>

            {/* Tableau d'inventaire */}
            <div style={{
              background: 'var(--agency-card-bg, #fff)', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
              borderRadius: '20px', overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#64748b' }}>
                      <th style={{ padding: '0.9rem 1rem' }}>Article</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Vendeur</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Stock Total</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Réservé</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Disponible</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Emplacement Rayon</th>
                      <th style={{ padding: '0.9rem 1rem' }}>État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                          Aucun article stocké dans l’entrepôt pour le moment.
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map(it => (
                        <tr key={it.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                          <td style={{ padding: '0.9rem 1rem', fontWeight: '800' }}>
                            <div>{it.productName}</div>
                            {it.sku && <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '500' }}>SKU: {it.sku}</div>}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', color: '#334155', fontWeight: '600' }}>
                            {it.vendorName}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', fontWeight: '900' }}>
                            {it.quantityInStock}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', color: '#f59e0b', fontWeight: '800' }}>
                            {it.quantityReserved}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', color: '#10b981', fontWeight: '900' }}>
                            {it.quantityAvailable}
                          </td>
                          <td style={{ padding: '0.9rem 1rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: '700'
                            }}>
                              <MapPin size={12} />
                              {it.shelfLocation}
                            </span>
                          </td>
                          <td style={{ padding: '0.9rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800',
                              background: it.isLowStock ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                              color: it.isLowStock ? '#ef4444' : '#10b981'
                            }}>
                              {it.isLowStock ? '⚠️ Faible' : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 4 : RAYONS, ESPACES & ABONNEMENTS DE STOCKAGE
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'spaces' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPI Revenus de Stockage */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '18px', padding: '1.25rem',
                display: 'flex', flexDirection: 'column', gap: '0.4rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>Revenus Stockage / Mois</span>
                  <DollarSign size={20} color="#10b981" />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981' }}>
                  ${totalSubscriptionRevenueUSD.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Frais de garde encaissés auprès des vendeurs</div>
              </div>

              <div style={{
                background: 'var(--agency-card-bg, #fff)', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
                borderRadius: '18px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#f97316' }}>Abonnements Actifs</span>
                  <ShieldCheck size={20} color="#f97316" />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'inherit' }}>
                  {agencySubscriptions.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Vendeurs partenaires stockant dans vos locaux</div>
              </div>
            </div>

            {/* ── Demandes en attente d'acceptation ──────────────────────────────── */}
            {pendingSubscriptions.length > 0 && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem'
              }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⏳ Demandes en attente ({pendingSubscriptions.length})
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                  Ces vendeurs attendent votre réponse. Acceptez ou refusez chaque demande — sans réponse sous 48h, elle expire automatiquement.
                </div>
                {pendingSubscriptions.map(sub => (
                  <div key={sub.id} style={{
                    background: 'var(--agency-card-bg, #fff)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{sub.vendorName || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{sub.vendorPhone || ''}</div>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                        Espace : <strong>{sub.spaceName}</strong> · {sub.slotsCount} slot(s) · {sub.pricePaid} {sub.currency}
                        {sub.expiresAt && (
                          <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.2rem' }}>
                            Expire le {safeFormatDate(sub.expiresAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Raison de refus (si l'agence veut en saisir une) */}
                    {isReviewingSub === sub.id && (
                      <input
                        type="text"
                        placeholder="Motif de refus (facultatif)"
                        value={rejectionReasonInput}
                        onChange={e => setRejectionReasonInput(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                      />
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/agency/warehouse/subscriptions', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ subscriptionId: sub.id, action: 'accept' })
                            });
                            const d = await res.json();
                            if (res.ok) { showToast('✅ Demande acceptée ! Le vendeur peut maintenant déposer du stock.'); await loadAgencyWarehouseData(); }
                            else showToast(`❌ ${d.error || 'Échec.'}`)
                          } catch { showToast('❌ Erreur réseau.'); }
                        }}
                        style={{ flex: 1, padding: '0.6rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        ✅ Accepter
                      </button>
                      {isReviewingSub === sub.id ? (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/agency/warehouse/subscriptions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ subscriptionId: sub.id, action: 'reject', reason: rejectionReasonInput.trim() || undefined })
                              });
                              const d = await res.json();
                              if (res.ok) { showToast('Demande refusée.'); setIsReviewingSub(null); setRejectionReasonInput(''); await loadAgencyWarehouseData(); }
                              else showToast(`❌ ${d.error || 'Échec.'}`)
                            } catch { showToast('❌ Erreur réseau.'); }
                          }}
                          style={{ flex: 1, padding: '0.6rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                        >
                          Confirmer le refus
                        </button>
                      ) : (
                        <button
                          onClick={() => { setIsReviewingSub(sub.id); setRejectionReasonInput(''); }}
                          style={{ flex: 1, padding: '0.6rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                        >
                          ❌ Refuser
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Abonnements Actifs des Vendeurs */}
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.75rem' }}>
                📋 Locataires & Abonnements Actifs ({agencySubscriptions.length})
              </h2>

              {agencySubscriptions.length === 0 ? (
                <div style={{
                  background: 'var(--agency-card-bg, #fff)', border: '1px dashed var(--agency-card-border, rgba(0,0,0,0.15))',
                  borderRadius: '14px', padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b'
                }}>
                  Aucun vendeur n'a encore souscrit d'abonnement à vos espaces.
                </div>
              ) : (
                <div style={{
                  background: 'var(--agency-card-bg, #fff)', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
                  borderRadius: '16px', overflow: 'hidden'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                      <tr>
                        <th style={{ padding: '0.8rem 1rem' }}>Vendeur</th>
                        <th style={{ padding: '0.8rem 1rem' }}>Espace Loué</th>
                        <th style={{ padding: '0.8rem 1rem' }}>Emplacements</th>
                        <th style={{ padding: '0.8rem 1rem' }}>Montant</th>
                        <th style={{ padding: '0.8rem 1rem' }}>Échéance</th>
                        <th style={{ padding: '0.8rem 1rem' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agencySubscriptions.map(sub => (
                        <tr key={sub.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <div style={{ fontWeight: '800' }}>{sub.vendorName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{sub.vendorPhone}</div>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontWeight: '700' }}>{sub.spaceName}</td>
                          <td style={{ padding: '0.8rem 1rem' }}>{sub.slotsCount} slot(s)</td>
                          <td style={{ padding: '0.8rem 1rem', fontWeight: '800', color: '#10b981' }}>${sub.pricePaid}</td>
                          <td style={{ padding: '0.8rem 1rem', fontSize: '0.78rem' }}>
                            {safeFormatDate(sub.endDate)}
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800',
                              background: sub.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: sub.status === 'ACTIVE' ? '#10b981' : '#ef4444'
                            }}>
                              {sub.status === 'ACTIVE' ? 'Actif' : sub.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Espaces Disponibles & Configuration */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>
                    🏢 Vos Espaces de Stockage Mis en Location ({spaces.length})
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Configurez vos étagères, box et tarifs mensuels pour vos vendeurs.
                  </div>
                </div>
                <button
                  onClick={() => setShowAddSpaceModal(true)}
                  style={{
                    padding: '0.65rem 1.2rem', background: '#f97316', color: '#fff',
                    border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem'
                  }}
                >
                  <Plus size={16} />
                  <span>Ajouter un Espace</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {spaces.map(sp => (
                  <div
                    key={sp.id}
                    style={{
                      background: 'var(--agency-card-bg, #fff)', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
                      borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '1.05rem' }}>{sp.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>{sp.description}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '900', fontSize: '1.2rem', color: '#10b981' }}>
                          ${sp.price_per_month}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>/ mois</div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem',
                      borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.6rem', color: '#64748b'
                    }}>
                      <span>Places : <strong>{sp.available_slots} / {sp.total_slots}</strong></span>
                      {sp.dimensions && <span>Dim : <strong>{sp.dimensions}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 5 : RETOURS COLIS & RÉINTÉGRATION EN RAYON
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'returns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>
                ↩️ Colis Fulfillment Retournés à l'Agence ({returnedPackages.length})
              </h2>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Lorsqu'un colis expédié depuis votre stock entrepôt n'a pas pu être livré ou a été refusé par le client, réintégrez l'article directement en rayon sans avoir à le renvoyer chez le vendeur.
              </div>
            </div>

            {returnedPackages.length === 0 ? (
              <div style={{
                background: 'var(--agency-card-bg, #fff)', border: '1px dashed var(--agency-card-border, rgba(0,0,0,0.15))',
                borderRadius: '20px', padding: '3rem 1.5rem', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem'
              }}>
                <RotateCcw size={48} color="#10b981" style={{ opacity: 0.6 }} />
                <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>
                  Aucun colis en attente de retour en stock
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '380px' }}>
                  Tous les colis expédiés depuis votre entrepôt ont été livrés avec succès ou sont en cours d'acheminement.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                {returnedPackages.map(pkg => (
                  <div
                    key={pkg.id}
                    style={{
                      background: 'var(--agency-card-bg, #fff)', border: '1px solid var(--agency-card-border, rgba(0,0,0,0.1))',
                      borderRadius: '16px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '900', fontSize: '1.05rem', color: '#f97316' }}>
                          {pkg.trackingCode}
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', marginTop: '0.2rem' }}>
                          📦 {pkg.productName}
                        </div>
                      </div>
                      <div style={{
                        padding: '0.2rem 0.6rem', borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444', fontWeight: '800', fontSize: '0.72rem'
                      }}>
                        {pkg.status}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div>Client : <strong>{pkg.recipientName}</strong> ({pkg.recipientPhone})</div>
                      <div>Destination : <strong>{pkg.destination}</strong></div>
                      <div>Montant : <strong>${pkg.amount}</strong></div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedReturnForRestock(pkg);
                        setRestockCondition('OK');
                        setRestockLocation('Rayon A - Étagère 1');
                      }}
                      style={{
                        marginTop: '0.25rem', width: '100%', padding: '0.7rem',
                        background: '#10b981', color: '#fff', border: 'none',
                        borderRadius: '10px', fontWeight: '800', fontSize: '0.82rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                      }}
                    >
                      <RotateCcw size={15} />
                      <span>Réintégrer l'article en stock</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Nouvel Espace */}
        {showAddSpaceModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '440px',
              padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '800', fontSize: '1.15rem' }}>Nouvel Espace de Stockage</div>
                <button onClick={() => setShowAddSpaceModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateSpace} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700' }}>Nom de l'Espace *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Étagère Standard A, Box 1m³"
                    value={spaceName}
                    onChange={e => setSpaceName(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginTop: '0.3rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700' }}>Description</label>
                  <input
                    type="text"
                    placeholder="Ex: Sécurisé, ventilé, idéal vêtements"
                    value={spaceDesc}
                    onChange={e => setSpaceDesc(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginTop: '0.3rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700' }}>Nombre d'Emplacements</label>
                    <input
                      type="number"
                      value={spaceSlots}
                      onChange={e => setSpaceSlots(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginTop: '0.3rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700' }}>Prix Mensuel ($)</label>
                    <input
                      type="number"
                      value={spacePrice}
                      onChange={e => setSpacePrice(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginTop: '0.3rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700' }}>Dimensions</label>
                  <input
                    type="text"
                    placeholder="Ex: 120x60x50 cm"
                    value={spaceDims}
                    onChange={e => setSpaceDims(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginTop: '0.3rem' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSpace}
                  style={{
                    marginTop: '0.5rem', width: '100%', padding: '0.85rem', background: '#f97316',
                    color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  {isSubmittingSpace ? 'Création...' : 'Créer l’Espace'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Réintégration Retour en Stock */}
        {selectedReturnForRestock && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '440px',
              padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Remise en Rayon</div>
                  <div style={{ fontWeight: '800', fontSize: '1.15rem' }}>{selectedReturnForRestock.trackingCode}</div>
                </div>
                <button onClick={() => setSelectedReturnForRestock(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.03)', borderRadius: '12px', padding: '0.8rem',
                fontSize: '0.8rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.25rem'
              }}>
                <div>📦 Article : <strong>{selectedReturnForRestock.productName}</strong></div>
                <div>👤 Destinataire : {selectedReturnForRestock.recipientName}</div>
                <div>📍 Destination : {selectedReturnForRestock.destination}</div>
              </div>

              <form onSubmit={handleReintegrateReturn} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700' }}>État physique de l'article *</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                    <button
                      type="button"
                      onClick={() => setRestockCondition('OK')}
                      style={{
                        flex: 1, padding: '0.6rem', borderRadius: '10px',
                        border: restockCondition === 'OK' ? '2px solid #10b981' : '1px solid #cbd5e1',
                        background: restockCondition === 'OK' ? 'rgba(16, 185, 129, 0.15)' : '#fff',
                        color: restockCondition === 'OK' ? '#10b981' : '#334155',
                        fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      ✅ Intact (Revendable)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestockCondition('DAMAGED')}
                      style={{
                        flex: 1, padding: '0.6rem', borderRadius: '10px',
                        border: restockCondition === 'DAMAGED' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                        background: restockCondition === 'DAMAGED' ? 'rgba(239, 68, 68, 0.15)' : '#fff',
                        color: restockCondition === 'DAMAGED' ? '#ef4444' : '#334155',
                        fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      ⚠️ Endommagé
                    </button>
                  </div>
                </div>

                {restockCondition === 'OK' && (
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700' }}>Emplacement physique (Rayon / Étagère)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Rayon A - Étagère 2"
                      value={restockLocation}
                      onChange={e => setRestockLocation(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginTop: '0.3rem' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                      La quantité disponible dans l’inventaire entrepôt du vendeur sera automatiquement augmentée de +1.
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingRestock}
                  style={{
                    marginTop: '0.5rem', width: '100%', padding: '0.85rem',
                    background: restockCondition === 'OK' ? '#10b981' : '#f59e0b',
                    color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  {isSubmittingRestock ? 'Traitement...' : 'Confirmer la réintégration'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AgencyShell>
  );
}
