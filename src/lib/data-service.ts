/**
 * Moncolis Data & Database Service (Supabase Integrated)
 * Connects components to Supabase PostgreSQL.
 * Columns verified to exist in the live DB:
 *   packages: id, tracking_code, vendeur_id, agency_id, driver_id,
 *             client_name, client_address, client_phone, status,
 *             validation_code, created_at, updated_at
 */

import { supabase } from '@/utils/supabase/client';

export type AgencyStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface DropPointAgent {
  id: string;
  agentNumber: string;   // 9-digit unique identifier assigned by Superadmin
  name: string;
  dropPointId: string;   // references DEFAULT_DROP_POINTS id
  dropPointName: string;
  dropPointCommune: string;
  isActive: boolean;
  createdAt: string;
}

export interface DropPoint {
  id: string;
  code?: string;
  qrToken?: string;
  name: string;
  commune: string;
  address: string;
  phone: string;
  managerName: string;
  openingHours: string;
  isActive: boolean;
  credits: number; // Nombre de crédits disponibles (1 crédit = 1 colis traité)
}

export let DEFAULT_DROP_POINTS: DropPoint[] = [];

export interface ColisItem {
  id: string;
  trackingCode: string;
  vendeurId: string;       // the vendor's profile id
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientCommune?: string;
  prixColis: number;       // not in DB — kept for UI compatibility, defaults to 0
  prixLivraison: number | null;
  poids: number;           // not in DB — kept for UI compatibility, defaults to 1
  longueur: number;
  largeur: number;
  hauteur: number;
  distance: number;
  status: 'Créé' | "En attente d'agence" | 'Accepté' | "Décliné par l'agence" | 'En transit' | 'En attente de confirmation relais' | 'Déposé en point relais' | 'Disponible au point relais' | 'En attente de collecte' | 'Refusé par le point relais' | 'En réclamation' | 'Livré' | 'Annulé';
  rawStatus?: string;
  claimStatus?: 'NONE' | 'OPEN' | 'RESOLVED';
  claimReason?: string | null;
  refusalComment?: string | null;
  pickupCode?: string | null;    // Code retrait point relais (ex: ABC123)
  vendeurName?: string | null;   // Nom du vendeur ayant déposé
  vendeurPhone?: string | null;  // Téléphone du vendeur
  vendeurAddress?: string | null; // Adresse du vendeur (départ distance)
  agence: string | null;
  agencyId?: string | null;
  livreur: string | null;
  livreurPhone: string | null;
  driverId?: string | null;
  otp: string;
  date: string;
  confirmed: boolean;
  deliveredAt?: string | null;
  paidByClient: boolean;
  isPrepaid: boolean;
  deliveryPrice: number;
  vendorPaid: boolean;
  // Point Relais / Dépôt fields
  deliveryMode?: 'DIRECT' | 'DROP_POINT_FIRST_MILE' | 'DROP_POINT_LAST_MILE' | 'WAREHOUSE_FULFILLMENT';
  originDropPointId?: string | null;
  originDropPoint?: DropPoint | null;
  destDropPointId?: string | null;
  destDropPoint?: DropPoint | null;
  warehouseInventoryId?: string | null;
  warehouseQuantity?: number | null;
  inaccessibilityNote?: string | null;
  reroutedAt?: string | null;
}

export interface DriverAccount {
  id: string;
  name: string;
  phone: string;
  pinCode: string;
  agencyId: string;
  agencyName: string;
  vehicle: string;
  available: boolean;
  deliveries: number;
  rating: number;
  joinedDate: string;
}

export interface AgencyInfo {
  id: string;
  name: string;
  phone: string;
  address: string;
  score: number;
  recommended: boolean;
  price: string;
  status: AgencyStatus;
  coverageZones?: string[];
  fleetSize?: number;
  email?: string;
  createdAt?: string;
  managerName?: string;
  drivers: DriverAccount[];
  billingType?: 'Commission' | 'Mensuel' | 'Annuel';
  billingValue?: number;
  communePrices?: { commune: string; price: number }[];
  pricePerKm?: number;
  pricePerKg?: number;
  tauxConversionFC?: number;
}

// ─── Fulfillment & Entrepôt Types ──────────────────────────────────────────
export interface AgencyStorageSpace {
  id: string;
  agencyId: string;
  name: string;
  description?: string;
  totalSlots: number;
  availableSlots: number;
  pricePerMonth: number;
  currency: 'USD' | 'CDF';
  maxWeightPerSlot?: number;
  dimensions?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface VendorStorageSubscription {
  id: string;
  vendorId: string;
  agencyId: string;
  storageSpaceId: string;
  slotsCount: number;
  pricePaid: number;
  currency: 'USD' | 'CDF';
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
  autoRenew: boolean;
  notes?: string;
  createdAt: string;
}

export interface WarehouseInventoryItem {
  id: string;
  vendorId: string;
  agencyId: string;
  storageSpaceId?: string;
  subscriptionId?: string;
  productName: string;
  sku?: string;
  barcode?: string;
  photoUrl?: string;
  category?: string;
  unitPrice: number;
  unitCurrency: 'USD' | 'CDF';
  quantityInStock: number;
  quantityReserved: number;
  shelfLocation?: string;
  lowStockThreshold: number;
  weightKg?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface WarehouseStockMovement {
  id: string;
  inventoryId: string;
  agencyId: string;
  vendorId: string;
  type: 'DEPOSIT' | 'DISPATCH' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  previousStock: number;
  newStock: number;
  packageId?: string;
  inboundBatchId?: string;
  reference?: string;
  performedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface WarehouseInboundBatch {
  id: string;
  batchNumber: string;
  vendorId: string;
  agencyId: string;
  storageSpaceId?: string;
  status: 'DRAFT' | 'PENDING' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
  items: Array<{
    productName: string;
    sku?: string;
    expectedQuantity: number;
    receivedQuantity?: number;
    unitPrice?: number;
    shelfLocation?: string;
  }>;
  qrToken?: string;
  totalItemsCount: number;
  receivedItemsCount?: number;
  depositedAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
}

export const DEFAULT_AGENCIES: AgencyInfo[] = [];

// In-memory overlay cache for packages and agencies metadata (e.g. drop points, approval statuses)
const packageMetaCache = new Map<string, {
  deliveryMode?: 'DIRECT' | 'DROP_POINT_FIRST_MILE' | 'DROP_POINT_LAST_MILE' | 'WAREHOUSE_FULFILLMENT';
  originDropPointId?: string | null;
  destDropPointId?: string | null;
  inaccessibilityNote?: string | null;
  reroutedAt?: string | null;
  customStatus?: ColisItem['status'];
  pickupCode?: string | null;
  vendeurName?: string | null;
  vendeurPhone?: string | null;
}>();

const agencyMetaCache = new Map<string, {
  status: AgencyStatus;
  coverageZones?: string[];
  fleetSize?: number;
  email?: string;
  createdAt?: string;
  billingType?: 'Commission' | 'Mensuel' | 'Annuel';
  billingValue?: number;
  managerName?: string;
}>();

// Cache temporaire pour les agents de point relais (interrogé d'abord en base Supabase)
const dropPointAgentCache = new Map<string, {
  id: string;
  agentNumber: string;
  pinHash: string;
  name: string;
  dropPointId: string;
  isActive: boolean;
  createdAt: string;
}>();

// Map de verrouillage brute-force pour les agents
const agentLockoutMap = new Map<string, { attempts: number; lockedUntil: number }>();

// Tracks parcels deposited by drivers, awaiting agent confirmation
// key = colisId
const pendingConfirmations = new Map<string, { agentId: string; depositedAt: string }>();

export interface VendorDeposit {
  id: string;
  pickupCode: string;        // e.g. "MCL-ABC123"
  dropPointId: string;
  dropPointName: string;
  vendeurName: string;
  vendeurPhone: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  description: string;
  agencyId: string | null;   // agency chosen to collect
  agencyName: string | null;
  status: 'PENDING_AGENCY' | 'AGENCY_ASSIGNED' | 'COLLECTED' | 'CANCELLED';
  createdAt: string;
  collectedAt?: string | null;
}

// In-memory store for vendor deposits at drop points
// key = pickupCode
const vendorDepositCache = new Map<string, VendorDeposit>();

/** Génère un entier aléatoire cryptographiquement sécurisé dans l'intervalle [min, max[ */
function secureRandomInt(min: number, max: number): number {
  if (typeof crypto !== 'undefined') {
    if (typeof (crypto as any).randomInt === 'function') {
      return (crypto as any).randomInt(min, max);
    }
    if (typeof crypto.getRandomValues === 'function') {
      const range = max - min;
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
  }
  return Math.floor(min + Math.random() * (max - min));
}

/** Generate a pickup code: 3 uppercase letters + 3 digits */
function generatePickupCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  const digits  = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) code += letters[secureRandomInt(0, letters.length)];
  for (let i = 0; i < 3; i++) code += digits[secureRandomInt(0, digits.length)];
  // Ensure uniqueness
  if (vendorDepositCache.has(code)) return generatePickupCode();
  return code;
}

const mapStatusToApp = (dbStatus: string, packageId?: string): ColisItem['status'] => {
  if (packageId && packageMetaCache.has(packageId)) {
    const cached = packageMetaCache.get(packageId);
    if (cached?.customStatus) return cached.customStatus;
  }

  switch (dbStatus) {
    case 'CREATED': return 'Créé';
    case 'PENDING_AGENCY': return "En attente d'agence";
    case 'ACCEPTED_BY_AGENCY': return 'Accepté';
    case 'REJECTED_BY_AGENCY': return "Décliné par l'agence";
    case 'IN_TRANSIT':
    case 'ASSIGNED_TO_DRIVER':
      return 'En transit';
    case 'PENDING_DROP_POINT_CONFIRMATION':
      return 'En attente de confirmation relais';
    case 'DEPOSITED_AT_DROP_POINT':
      return 'Déposé en point relais';
    case 'AVAILABLE_AT_PICKUP_POINT':
      return 'Disponible au point relais';
    case 'WAITING_FOR_AGENCY_PICKUP':
      return 'En attente de collecte';
    case 'REFUSED_BY_DROP_POINT':
      return 'Refusé par le point relais';
    case 'IN_DISPUTE':
      return 'En réclamation';
    case 'DELIVERED': return 'Livré';
    case 'CANCELLED': return 'Annulé';
    default: return 'Créé';
  }
};

// Maps a raw Supabase packages row to a ColisItem
export function mapPackage(p: any): ColisItem {
  const meta = packageMetaCache.get(p.id) || {};
  const originDpId = p.origin_drop_point_id || meta.originDropPointId || null;
  const destDpId = p.dest_drop_point_id || meta.destDropPointId || null;

  const rawOriginDp = Array.isArray(p.origin_drop_point) ? p.origin_drop_point[0] : p.origin_drop_point;
  const originDropPoint: DropPoint | null = rawOriginDp ? {
    id: rawOriginDp.id,
    name: rawOriginDp.name,
    commune: rawOriginDp.commune || '',
    address: rawOriginDp.address || '',
    phone: rawOriginDp.phone || '',
    managerName: rawOriginDp.manager_name || '',
    openingHours: rawOriginDp.opening_hours || '8h - 18h',
    isActive: rawOriginDp.is_active !== false,
    credits: rawOriginDp.credits || 0,
  } : (originDpId ? (DEFAULT_DROP_POINTS.find(dp => dp.id === originDpId) || null) : null);

  const rawDestDp = Array.isArray(p.dest_drop_point) ? p.dest_drop_point[0] : p.dest_drop_point;
  const destDropPoint: DropPoint | null = rawDestDp ? {
    id: rawDestDp.id,
    name: rawDestDp.name,
    commune: rawDestDp.commune || '',
    address: rawDestDp.address || '',
    phone: rawDestDp.phone || '',
    managerName: rawDestDp.manager_name || '',
    openingHours: rawDestDp.opening_hours || '8h - 18h',
    isActive: rawDestDp.is_active !== false,
    credits: rawDestDp.credits || 0,
  } : (destDpId ? (DEFAULT_DROP_POINTS.find(dp => dp.id === destDpId) || null) : null);

  // Safe seller name resolution
  const rawVendeur = Array.isArray(p.vendeur) ? p.vendeur[0] : p.vendeur;
  const resolvedVendorName = rawVendeur?.name || p.vendeur_name || meta.vendeurName || null;
  const resolvedVendorPhone = rawVendeur?.phone || p.vendeur_phone || meta.vendeurPhone || null;

  return {
    id: p.id,
    trackingCode: p.tracking_code || ('MC-' + p.id.slice(0, 8).toUpperCase()),
    vendeurId: p.vendeur_id || '',
    clientName: p.client_name,
    clientPhone: p.client_phone || '',
    clientAddress: p.client_address,
    clientCommune: p.client_commune || '',
    prixColis: p.package_price || 0,
    prixLivraison: p.delivery_price ? (p.delivery_price > 50 ? parseFloat((p.delivery_price / 2400).toFixed(2)) : p.delivery_price) : null,
    poids: p.weight || 1,
    longueur: 0,
    largeur: 0,
    hauteur: 0,
    distance: p.distance || 0,
    status: meta.customStatus || mapStatusToApp(p.status, p.id),
    claimStatus: p.claim_status || (p.status === 'IN_DISPUTE' ? 'OPEN' : 'NONE'),
    claimReason: p.claim_reason || null,
    refusalComment: p.refusal_comment || null,
    agence: p.agency?.profile?.name || null,
    agencyId: p.agency_id,
    livreur: p.driver?.profile?.name || null,
    livreurPhone: p.driver?.phone || null,
    driverId: p.driver_id,
    otp: p.validation_code,
    date: p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—',
    confirmed: false,
    deliveredAt: null,
    paidByClient: p.paid_by_client !== undefined ? p.paid_by_client : true,
    isPrepaid: p.is_prepaid || false,
    deliveryPrice: p.delivery_price ? (p.delivery_price > 50 ? parseFloat((p.delivery_price / 2400).toFixed(2)) : p.delivery_price) : 0,
    vendorPaid: p.vendor_paid || false,
    deliveryMode: meta.deliveryMode || p.delivery_mode || (destDpId ? 'DROP_POINT_LAST_MILE' : originDpId ? 'DROP_POINT_FIRST_MILE' : 'DIRECT'),
    originDropPointId: originDpId,
    originDropPoint,
    destDropPointId: destDpId,
    destDropPoint,
    inaccessibilityNote: meta.inaccessibilityNote || p.inaccessibility_note || null,
    reroutedAt: meta.reroutedAt || p.rerouted_at || null,
    pickupCode: p.pickup_code || meta.pickupCode || null,
    vendeurName: resolvedVendorName,
    vendeurPhone: resolvedVendorPhone,
    rawStatus: p.status,
  };
}

class DataService {

  // -- 1. Packages List -----------------------------------------
  async getAllPackages(): Promise<ColisItem[]> {
    let data = null;
    let error = null;
    try {
      const res = await supabase
        .from('packages')
        .select(`
          id, tracking_code, vendeur_id, agency_id, driver_id,
          client_name, client_address, client_phone,
          status, validation_code, created_at, updated_at,
          paid_by_client, delivery_price, package_price, is_prepaid, vendor_paid,
          origin_drop_point_id, dest_drop_point_id, delivery_mode,
          inaccessibility_note, rerouted_at, pickup_code,
          agency:agencies(id, profile:profiles(name)),
          driver:drivers(id, phone, profile:profiles(name)),
          vendeur:profiles!packages_vendeur_id_fkey(id, name, phone),
          origin_drop_point:drop_points!origin_drop_point_id(id, name, commune, address, phone, manager_name, opening_hours),
          dest_drop_point:drop_points!dest_drop_point_id(id, name, commune, address, phone, manager_name, opening_hours)
        `)
        .order('created_at', { ascending: false });
      data = res.data;
      error = res.error;
    } catch (err) {
      console.error('Erreur réseau fetch packages:', err);
      return [];
    }

    if (error || !data) {
      console.error('Error fetching packages:', error);
      return [];
    }

    // Fallback : si la jointure FK vendeur n'a pas résolu certains noms,
    // récupérer les profils vendeurs manquants en une seule requête groupée.
    const missingVendeurIds = [...new Set(
      (data as any[])
        .filter(p => {
          const v = Array.isArray(p.vendeur) ? p.vendeur[0] : p.vendeur;
          return !v?.name && p.vendeur_id;
        })
        .map(p => p.vendeur_id as string)
    )];

    let vendeurFallbackMap: Record<string, { name: string; phone?: string }> = {};
    if (missingVendeurIds.length > 0) {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, phone')
          .in('id', missingVendeurIds);
        if (profiles) {
          profiles.forEach(prof => {
            vendeurFallbackMap[prof.id] = { name: prof.name, phone: prof.phone };
          });
        }
      } catch (fallbackErr) {
        console.warn('Fallback vendeur profiles fetch failed:', fallbackErr);
      }
    }

    return (data as any[]).map(p => {
      // Injecter le nom vendeur dans le cache mémoire si la FK a échoué
      const v = Array.isArray(p.vendeur) ? p.vendeur[0] : p.vendeur;
      if (!v?.name && p.vendeur_id && vendeurFallbackMap[p.vendeur_id]) {
        const fb = vendeurFallbackMap[p.vendeur_id];
        const existing = packageMetaCache.get(p.id) || {};
        packageMetaCache.set(p.id, {
          ...existing,
          vendeurName: fb.name,
          vendeurPhone: fb.phone,
        });
      }
      return mapPackage(p);
    });
  }

  async getPackagesForVendor(vendeurId: string): Promise<ColisItem[]> {
    let data = null;
    let error = null;
    try {
      const res = await supabase
        .from('packages')
        .select(`
          id, tracking_code, vendeur_id, agency_id, driver_id,
          client_name, client_address, client_commune, client_phone,
          status, validation_code, created_at, updated_at,
          paid_by_client, delivery_price, package_price, is_prepaid, vendor_paid, weight,
          origin_drop_point_id, dest_drop_point_id, delivery_mode,
          inaccessibility_note, rerouted_at, pickup_code,
          agency:agencies(id, profile:profiles(name)),
          driver:drivers(id, phone, profile:profiles(name))
        `)
        .eq('vendeur_id', vendeurId)
        .order('created_at', { ascending: false });
      data = res.data;
      error = res.error;
    } catch (err) {
      console.error('Erreur réseau fetch packages for vendor:', err);
      return [];
    }

    if (error || !data) {
      console.error('Error fetching packages for vendor:', error);
      return [];
    }

    return data.map(mapPackage);
  }


  // -- 2. Get Single Package -------------
  async getPackageByTracking(query: string): Promise<ColisItem | null> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    // Détection si la recherche est un UUID valide pour éviter l'erreur Postgres 22P02
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQuery);

    let queryBuilder = supabase
      .from('packages')
      .select(`
        id, tracking_code, vendeur_id, agency_id, driver_id,
        client_name, client_address, client_commune, client_phone,
        status, validation_code, created_at, updated_at,
        paid_by_client, delivery_price, package_price, is_prepaid, vendor_paid, weight,
        origin_drop_point_id, dest_drop_point_id, delivery_mode,
        inaccessibility_note, rerouted_at, pickup_code,
        agency:agencies(id, profile:profiles(name)),
        driver:drivers(id, phone, profile:profiles(name)),
        vendeur:profiles!packages_vendeur_id_fkey(id, name, phone)
      `);

    if (isUuid) {
      queryBuilder = queryBuilder.or(`id.eq.${cleanQuery},tracking_code.eq.${cleanQuery}`);
    } else {
      queryBuilder = queryBuilder.or(`tracking_code.eq.${cleanQuery},validation_code.eq.${cleanQuery}`);
    }

    const { data, error } = await queryBuilder.maybeSingle();

    if (error || !data) return null;
    return mapPackage(data);
  }

  // -- 3. Create New Package --------------------------
  async createPackage(p: {
    clientName: string;
    clientAddress: string;
    clientCommune: string;
    clientPhone: string;
    prixColis: number;
    poids: number;
    vendeurId: string;
    paidByClient: boolean;
    isPrepaid: boolean;
    deliveryMode?: 'DIRECT' | 'DROP_POINT_FIRST_MILE' | 'DROP_POINT_LAST_MILE' | 'WAREHOUSE_FULFILLMENT';
    originDropPointId?: string;
    agencyId?: string;
    warehouseInventoryId?: string;
    warehouseQuantity?: number;
  }): Promise<ColisItem> {
    const trackCode = 'MC-' + secureRandomInt(100000, 1000000).toString();
    const otp = secureRandomInt(100000, 1000000).toString();

    // Use the provided vendeurId, or fall back to the first vendeur found
    let vendeurId = p.vendeurId;
    if (!vendeurId) {
      const { data: vendeur } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'vendeur')
        .limit(1)
        .single();
      vendeurId = vendeur?.id || '11111111-1111-1111-1111-111111111111';
    }

    let initialStatus = 'CREATED';
    if (p.deliveryMode === 'WAREHOUSE_FULFILLMENT') {
      initialStatus = 'ACCEPTED_BY_AGENCY';
    } else if (p.agencyId) {
      initialStatus = 'PENDING_AGENCY';
    } else if (p.deliveryMode === 'DROP_POINT_FIRST_MILE') {
      initialStatus = 'DEPOSITED_AT_DROP_POINT';
    }

    const insertData: any = {
      tracking_code: trackCode,
      vendeur_id: vendeurId,
      client_name: p.clientName,
      client_phone: p.clientPhone,
      client_address: p.clientAddress,
      client_commune: p.clientCommune,
      status: initialStatus,
      agency_id: p.agencyId || null,
      origin_drop_point_id: p.originDropPointId || null,
      validation_code: otp,
      paid_by_client: p.paidByClient,
      is_prepaid: p.isPrepaid,
      delivery_price: 0,
      package_price: p.prixColis,
      weight: p.poids,
    };

    const { data, error } = await supabase.from('packages').insert(insertData).select().single();
    if (error) throw error;

    // Si expédié depuis le stock entrepôt, réserver l'inventaire
    if (p.deliveryMode === 'WAREHOUSE_FULFILLMENT' && p.warehouseInventoryId && data?.id) {
      try {
        await fetch('/api/vendor/warehouse/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inventoryId: p.warehouseInventoryId,
            quantity: p.warehouseQuantity || 1,
            packageId: data.id,
            action: 'reserve'
          })
        });
      } catch (dispErr) {
        console.warn('Warehouse dispatch reservation warning:', dispErr);
      }
    }

    // Cache drop point metadata
    if (p.deliveryMode || p.originDropPointId) {
      packageMetaCache.set(data.id, {
        deliveryMode: p.deliveryMode || 'DIRECT',
        originDropPointId: p.originDropPointId || null,
        customStatus: p.deliveryMode === 'DROP_POINT_FIRST_MILE'
          ? 'Déposé en point relais'
          : p.deliveryMode === 'WAREHOUSE_FULFILLMENT'
          ? 'Accepté'
          : undefined,
      });
    }

    return this.getPackageByTracking(data.id) as Promise<ColisItem>;
  }

  // -- 4. Assign Agency by ID (preferred) ----------------------
  async assignAgencyById(colisId: string, agencyId: string, deliveryPrice?: number): Promise<void> {
    const updateData: any = {
      agency_id: agencyId,
      status: 'PENDING_AGENCY',
    };
    if (deliveryPrice !== undefined) {
      updateData.delivery_price = deliveryPrice;
    }
    await supabase.from('packages').update(updateData).eq('id', colisId);
  }

  // -- 4b. Assign Agency by name (fallback) ---------------------
  async assignAgency(colisId: string, agencyName: string, deliveryPrice: number): Promise<void> {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('name', agencyName)
      .eq('role', 'agence')
      .single();

    if (profiles) {
      await supabase.from('packages').update({
        agency_id: profiles.id,
        status: 'PENDING_AGENCY',
      }).eq('id', colisId);
    }
  }

  // -- 4c. Agency Package Actions ---------------------------------
  async acceptPackage(colisId: string, deliveryPrice: number): Promise<void> {
    await supabase.from('packages').update({
      status: 'ACCEPTED_BY_AGENCY',
      delivery_price: deliveryPrice,
    }).eq('id', colisId);
  }

  async rejectPackage(colisId: string): Promise<void> {
    await supabase.from('packages').update({
      status: 'CANCELLED',
    }).eq('id', colisId);
  }

  // -- 5. Assign Driver -----------------------------------------
  async assignDriver(colisId: string, driverId: string): Promise<void> {
    await supabase.from('packages').update({
      driver_id: driverId,
      status: 'IN_TRANSIT',
    }).eq('id', colisId);
  }

  // -- 6. Validate Delivery -------------------------------------
  async validateDelivery(colisId: string): Promise<boolean> {
    // Vérification côté serveur : interdire qu'un colis passe à "Livré" avec 0$ ou sans agence
    const { data: pkg, error: checkErr } = await supabase
      .from('packages')
      .select('agency_id, delivery_price')
      .eq('id', colisId)
      .single();

    if (checkErr || !pkg) return false;
    if (!pkg.agency_id) {
      console.warn(`[validateDelivery] Refus: colis ${colisId} non rattaché à une agence.`);
      return false;
    }
    if (Number(pkg.delivery_price || 0) <= 0) {
      console.warn(`[validateDelivery] Refus: montant de livraison nul (0.00 USD) sur le colis ${colisId}.`);
      return false;
    }

    const { error } = await supabase.from('packages').update({
      status: 'DELIVERED',
    }).eq('id', colisId);

    return !error;
  }

  // -- 6b. Vendor Payments ----------------------------------------
  async payVendor(colisId: string): Promise<void> {
    await supabase.from('packages').update({
      vendor_paid: true,
    }).eq('id', colisId);
  }

  async markVendorDebtsAsPaid(agencyId: string, vendeurId: string): Promise<void> {
    await supabase.from('packages').update({
      vendor_paid: true,
    })
    .eq('agency_id', agencyId)
    .eq('vendeur_id', vendeurId)
    .eq('status', 'DELIVERED')
    .eq('is_prepaid', false)
    .eq('vendor_paid', false);
  }

  async validateDeliveryOtp(colisId: string, otp: string): Promise<{ success: boolean; message: string; package?: ColisItem }> {
    const { data: pkg, error } = await supabase
      .from('packages')
      .select('validation_code, agency_id, delivery_price, status, claim_status')
      .eq('id', colisId)
      .single();

    if (error || !pkg) return { success: false, message: 'Colis introuvable.' };

    if (pkg.status === 'IN_DISPUTE' || pkg.claim_status === 'OPEN') {
      return {
        success: false,
        message: 'Retrait strictement bloqué : ce colis fait l\'objet d\'une réclamation vendeur non résolue.',
      };
    }

    if (pkg.validation_code !== otp) return { success: false, message: 'Le code OTP est incorrect.' };

    // Validation financière stricte
    if (!pkg.agency_id) {
      return { success: false, message: 'Impossible de valider : ce colis n\'est rattaché à aucune agence.' };
    }
    if (Number(pkg.delivery_price || 0) <= 0) {
      return { success: false, message: 'Impossible de valider : le montant de livraison du colis est de 0.00 USD.' };
    }

    const success = await this.validateDelivery(colisId);
    if (!success) return { success: false, message: 'Erreur lors de la validation en base.' };

    const updatedPkg = await this.getPackageByTracking(colisId);
    return { success: true, message: 'Colis livré avec succès.', package: updatedPkg || undefined };
  }

  // -- 6c. Reroute Package to Drop Point (Zone inaccessible) --------
  async rerouteToDropPoint(
    colisId: string,
    dropPointId: string,
    inaccessibilityNote: string
  ): Promise<{ success: boolean; message: string; package?: ColisItem }> {
    const dp = this.getDropPointById(dropPointId);
    if (!dp) {
      return { success: false, message: 'Point Relais introuvable.' };
    }

    const now = new Date().toISOString();

    // Cache metadata in memory
    packageMetaCache.set(colisId, {
      deliveryMode: 'DROP_POINT_LAST_MILE',
      destDropPointId: dropPointId,
      inaccessibilityNote: inaccessibilityNote.trim(),
      reroutedAt: now,
      customStatus: 'Disponible au point relais',
    });

    try {
      // Attempt DB update
      await supabase.from('packages').update({
        status: 'AVAILABLE_AT_PICKUP_POINT',
      }).eq('id', colisId);
    } catch (e) {
      console.warn('Could not update package status in DB, cached in memory:', e);
    }

    const updatedPkg = await this.getPackageByTracking(colisId);
    return {
      success: true,
      message: `Colis réacheminé avec succès au ${dp.name} (${dp.commune}).`,
      package: updatedPkg || undefined,
    };
  }

  // -- 6d. Drop Points Management ----------------------------------
  async getDropPoints(): Promise<DropPoint[]> {
    let data = null;
    let error = null;
    try {
      const res = await supabase.from('drop_points').select('*').order('created_at', { ascending: false });
      data = res.data;
      error = res.error;
    } catch(e) {
      console.error("Erreur drop points", e);
      return [];
    }
    if (error || !data) return [];
    const points = data.map(dp => ({
      id: dp.id,
      code: dp.code || dp.id,
      qrToken: dp.qr_token || null,
      name: dp.name,
      commune: dp.commune,
      address: dp.address,
      phone: dp.phone,
      managerName: dp.manager_name,
      openingHours: dp.opening_hours,
      isActive: dp.is_active,
      credits: dp.credits ?? 0,
    }));
    DEFAULT_DROP_POINTS = points;
    return points;
  }

  getDropPointById(id: string): DropPoint | undefined {
    return DEFAULT_DROP_POINTS.find(dp => dp.id === id);
  }

  getDropPointsByCommune(commune: string): DropPoint[] {
    return DEFAULT_DROP_POINTS.filter(
      dp => dp.commune.toLowerCase().trim() === commune.toLowerCase().trim()
    );
  }

  async createDropPoint(data: { name: string; commune: string; quartier: string; avenue: string; numero: string; phone: string; managerName: string; }): Promise<DropPoint> {
    const id = `DP-${data.commune.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const address = `${data.numero} Av. ${data.avenue}, Q. ${data.quartier}, C. ${data.commune}`;
    
    const newDropPoint: DropPoint = {
      id,
      name: data.name,
      commune: data.commune,
      address,
      phone: data.phone,
      managerName: data.managerName,
      openingHours: '08h00 - 18h00',
      isActive: true,
      credits: 0, // Starts at 0; Admin must top up with credits
    };

    // Ajout en mémoire
    DEFAULT_DROP_POINTS.push(newDropPoint);

    // Ajout en BD (Supabase)
    try {
      await supabase.from('drop_points').insert({
        id: newDropPoint.id,
        name: newDropPoint.name,
        commune: newDropPoint.commune,
        address: newDropPoint.address,
        phone: newDropPoint.phone,
        manager_name: newDropPoint.managerName,
        opening_hours: newDropPoint.openingHours,
        is_active: newDropPoint.isActive,
      });
    } catch (e) {
      console.warn('Could not insert drop_point in DB, cached in memory only:', e);
    }

    return newDropPoint;
  }

  // Superadmin adds credits to a drop point
  async addDropPointCredits(dropPointId: string, amount: number): Promise<boolean> {
    const idx = DEFAULT_DROP_POINTS.findIndex(dp => dp.id === dropPointId);
    if (idx !== -1) {
      DEFAULT_DROP_POINTS[idx].credits = (DEFAULT_DROP_POINTS[idx].credits || 0) + amount;
    }
    try {
      const { data: dp } = await supabase.from('drop_points').select('credits').eq('id', dropPointId).maybeSingle();
      const newCredits = ((dp as any)?.credits || 0) + amount;
      await supabase.from('drop_points').update({ credits: newCredits }).eq('id', dropPointId);
      if (idx !== -1) DEFAULT_DROP_POINTS[idx].credits = newCredits;
    } catch (e) {
      console.warn('Could not update credits in DB, updated in memory only:', e);
    }
    return true;
  }

  // Deducts 1 credit from a drop point (called when a parcel is handled)
  async deductDropPointCredit(dropPointId: string): Promise<boolean> {
    const idx = DEFAULT_DROP_POINTS.findIndex(dp => dp.id === dropPointId);
    if (idx !== -1) {
      if ((DEFAULT_DROP_POINTS[idx].credits || 0) <= 0) {
        throw new Error('Crédits insuffisants. Le Point Relais est inactif. Veuillez recharger des crédits.');
      }
      DEFAULT_DROP_POINTS[idx].credits -= 1;
    }
    try {
      const { data: dp } = await supabase.from('drop_points').select('credits').eq('id', dropPointId).maybeSingle();
      const currentCredits = (dp as any)?.credits || 0;
      if (currentCredits <= 0) throw new Error('Crédits insuffisants.');
      await supabase.from('drop_points').update({ credits: currentCredits - 1 }).eq('id', dropPointId);
    } catch (e: any) {
      if (e.message?.includes('insuffisants')) throw e;
      console.warn('Could not update credits in DB:', e);
    }
    return true;
  }

  // -- 7. Get Deliveries for a Driver ---------------------------
  async getPackagesForDriver(driverQuery: string): Promise<ColisItem[]> {
    const pkgs = await this.getAllPackages();
    return pkgs.filter(p => p.driverId === driverQuery || p.livreur === driverQuery);
  }

  // -- 7.2 Get Packages for a specific Agency --------------------
  async getPackagesForAgency(agencyId: string): Promise<ColisItem[]> {
    const { data, error } = await supabase
      .from('packages')
      .select(`
        id, tracking_code, vendeur_id, agency_id, driver_id,
        client_name, client_address, client_commune, client_phone,
        status, validation_code, created_at, updated_at,
        paid_by_client, delivery_price, package_price, weight,
        is_prepaid, vendor_paid,
        origin_drop_point_id, dest_drop_point_id, delivery_mode,
        inaccessibility_note, rerouted_at,
        agency:agencies(id, profile:profiles(name)),
        driver:drivers(id, phone, profile:profiles(name)),
        vendeur:profiles!packages_vendeur_id_fkey(name)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error fetching agency packages:', error);
      return [];
    }

    return data.map(p => ({
      ...mapPackage(p),
      agence: (p as any).agency?.profile?.name || null,
      vendeurName: (p as any).vendeur_name || (p as any).vendeur?.name || null,
      vendeurAddress: null, // L'adresse vendeur n'est pas encore en DB - utilise l'adresse agence en fallback
    }));
  }

  // -- 7.5 Realtime Subscriptions -------------------------------
  subscribeToPackages(callback: () => void) {
    const channelName = `packages_realtime_${Date.now()}_${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => {
        callback();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // -- 8. Agencies Management & Validation ----------------------
  async getAgencies(statusFilter?: AgencyStatus): Promise<AgencyInfo[]> {
    let data = null;
    let error = null;
    try {
      const res = await supabase
        .from('agencies')
        .select(`
          id,
          status,
          billing_type,
          billing_value,
          address,
          phone,
          commune_prices,
          price_per_km,
          price_per_kg,
          taux_fc,
          fleet_size,
          coverage_zones,
          manager_name,
          created_at,
          profile:profiles(name, email)
        `);
      data = res.data;
      error = res.error;
    } catch (err) {
      console.error('Erreur réseau lors de la récupération des agences:', err);
      return [];
    }

    const agenciesList: AgencyInfo[] = [];

    if (!error && data) {
      for (const ag of data as any[]) {
        const cached = agencyMetaCache.get(ag.id);
        // Priorité : valeur BD → cache mémoire → défaut
        const status: AgencyStatus = ag.status || cached?.status || 'APPROVED';
        if (statusFilter && status !== statusFilter) continue;

        agenciesList.push({
          id: ag.id,
          name: ag.profile?.name || 'Agence Inconnue',
          email: ag.profile?.email || cached?.email || '',
          phone: ag.phone || '',
          address: ag.address || '',
          score: 92,
          recommended: true,
          price: '1.5 USD',
          status,
          coverageZones: ag.coverage_zones || cached?.coverageZones || ['Gombe', 'Limete', 'Bandalungwa'],
          fleetSize: ag.fleet_size || cached?.fleetSize || 4,
          managerName: ag.manager_name || cached?.managerName,
          createdAt: ag.created_at || cached?.createdAt || new Date().toISOString(),
          drivers: [],
          billingType: ag.billing_type || cached?.billingType || 'Commission',
          billingValue: ag.billing_value ?? cached?.billingValue ?? 15,
          communePrices: ag.commune_prices || [],
          pricePerKm: ag.price_per_km ?? 0,
          pricePerKg: ag.price_per_kg ?? 0,
          tauxConversionFC: ag.taux_fc ?? undefined,
        });
      }
    }

    // Include any in-memory pending agencies that haven't been written to Supabase
    for (const [id, meta] of agencyMetaCache.entries()) {
      if (!agenciesList.some(a => a.id === id)) {
        if (statusFilter && meta.status !== statusFilter) continue;
        agenciesList.push({
          id,
          name: (meta as any).name || 'Nouvelle Agence',
          email: meta.email || '',
          phone: (meta as any).phone || '',
          address: (meta as any).address || '',
          score: 90,
          recommended: false,
          price: '1.5 USD',
          status: meta.status,
          coverageZones: meta.coverageZones || ['Gombe'],
          fleetSize: meta.fleetSize || 2,
          createdAt: meta.createdAt || new Date().toISOString(),
          drivers: [],
          communePrices: [],
        });
      }
    }

    return agenciesList;
  }

  // Get agency commune prices
  async getAgencyCommunePrices(agencyId: string): Promise<{ commune: string; price: number }[]> {
    const { data, error } = await supabase
      .from('agencies')
      .select('commune_prices')
      .eq('id', agencyId)
      .single();
    
    if (error) {
      console.error('Error fetching agency commune prices:', error);
      return [];
    }
    
    return data?.commune_prices || [];
  }

  // Update agency commune prices and rate settings
  async updateAgencyCommunePrices(agencyId: string, prices: { commune: string; price: number }[]): Promise<boolean> {
    const { error } = await supabase
      .from('agencies')
      .update({ commune_prices: prices })
      .eq('id', agencyId);
      
    if (error) {
      console.error('Error updating agency commune prices:', error);
      return false;
    }
    
    return true;
  }

  async updateAgencySettings(agencyId: string, settings: {
    communePrices: { commune: string; price: number }[];
    pricePerKm: number;
    pricePerKg: number;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('agencies')
      .update({
        commune_prices: settings.communePrices,
        price_per_km: settings.pricePerKm,
        price_per_kg: settings.pricePerKg,
      })
      .eq('id', agencyId);
      
    if (error) {
      console.error('Error updating agency settings:', error);
      return false;
    }
    
    return true;
  }

  // Get all agencies pending Superadmin validation
  async getPendingAgencies(): Promise<AgencyInfo[]> {
    return this.getAgencies('PENDING');
  }

  // Superadmin approves an agency account
  async approveAgency(agencyId: string): Promise<boolean> {
    const cached = agencyMetaCache.get(agencyId) || { status: 'PENDING' };
    agencyMetaCache.set(agencyId, { ...cached, status: 'APPROVED' });

    try {
      await supabase.from('agencies').update({ status: 'APPROVED' }).eq('id', agencyId);
    } catch (e) {
      console.warn('Could not update agency status in DB, cached in memory:', e);
    }
    return true;
  }

  // Superadmin rejects an agency account
  async rejectAgency(agencyId: string, reason?: string): Promise<boolean> {
    const cached = agencyMetaCache.get(agencyId) || { status: 'PENDING' };
    agencyMetaCache.set(agencyId, { ...cached, status: 'REJECTED' });

    try {
      await supabase.from('agencies').update({ status: 'REJECTED' }).eq('id', agencyId);
    } catch (e) {
      console.warn('Could not update agency status in DB, cached in memory:', e);
    }
    return true;
  }

  // Superadmin updates agency billing model
  async updateAgencyBilling(agencyId: string, billingType: 'Commission' | 'Mensuel' | 'Annuel', billingValue: number) {
    const cached = agencyMetaCache.get(agencyId);
    if (cached) {
      agencyMetaCache.set(agencyId, { ...cached, billingType, billingValue });
    } else {
      agencyMetaCache.set(agencyId, { status: 'APPROVED', billingType, billingValue });
    }
    // Persister en base
    try {
      await supabase.from('agencies').update({
        billing_type: billingType,
        billing_value: billingValue,
      }).eq('id', agencyId);
    } catch (e) {
      console.warn('Could not update agency billing in DB, cached in memory only:', e);
    }
  }

  // Register agency application in cache & state
  recordAgencyApplication(agency: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    coverageZones: string[];
    fleetSize: number;
  }) {
    agencyMetaCache.set(agency.id, {
      ...agency,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    } as any);
  }

  async getDriversForAgency(agencyId: string): Promise<DriverAccount[]> {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        id,
        phone,
        available,
        agency_id,
        created_at,
        profile:profiles(name),
        agency:agencies(profile:profiles(name))
      `)
      .eq('agency_id', agencyId);

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      name: d.profile?.name || 'Inconnu',
      phone: d.phone || '',
      pinCode: '0000',
      agencyId: d.agency_id,
      agencyName: d.agency?.profile?.name || '',
      vehicle: d.vehicle || 'Moto',
      available: d.available || false,
      deliveries: 0,
      rating: 5,
      joinedDate: new Date(d.created_at).toLocaleDateString('fr-FR'),
    }));
  }

  async addDriver(agencyId: string, driverData: Omit<DriverAccount, 'id' | 'agencyId' | 'agencyName' | 'deliveries' | 'rating' | 'joinedDate'>): Promise<DriverAccount> {
    // 1. Create a profile for the driver
    const newId = crypto.randomUUID();
    const { data: profile, error: pErr } = await supabase.from('profiles').insert({
      id: newId,
      role: 'livreur',
      name: driverData.name,
      phone: driverData.phone,
    }).select().single();

    if (pErr) throw pErr;

    // 2. Hash the PIN before storing
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(driverData.pinCode));
    const pinHash = Buffer.from(hashBuffer).toString('hex');

    // 3. Create the driver record with pin_code
    const { data: driver, error: dErr } = await supabase.from('drivers').insert({
      id: profile.id,
      agency_id: agencyId,
      phone: driverData.phone,
      available: driverData.available,
      pin_code: pinHash,
    }).select().single();

    if (dErr) throw dErr;

    return {
      id: driver.id,
      name: profile.name,
      phone: driver.phone || '',
      pinCode: driverData.pinCode,
      agencyId: driver.agency_id,
      agencyName: 'Agence',
      vehicle: driver.vehicle || 'Moto',
      available: driver.available || true,
      deliveries: 0,
      rating: 5,
      joinedDate: new Date().toLocaleDateString('fr-FR'),
    };
  }

  // -- 9. Driver Authentication -----------------------
  async authenticateDriver(phone: string, pin: string): Promise<DriverAccount | null> {
    // 1. Fetch driver by phone only (supports both bcrypt and SHA-256 hashes)
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        id,
        phone,
        available,
        agency_id,
        pin_code,
        created_at,
        profile:profiles(name),
        agency:agencies(profile:profiles(name))
      `)
      .eq('phone', phone)
      .single();

    if (error || !data) return null;

    const d = data as any;
    const storedHash: string = d.pin_code || '';

    // 2. Vérifier le PIN — supporte bcrypt (nouveaux comptes) et SHA-256 (anciens comptes)
    let pinValid = false;

    if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
      // Nouveau format : bcrypt
      const bcrypt = await import('bcryptjs');
      pinValid = await bcrypt.compare(pin, storedHash);
    } else if (/^[0-9a-f]{64}$/i.test(storedHash)) {
      // Ancien format : SHA-256 hex
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(pin));
      const pinHash = Buffer.from(hashBuffer).toString('hex');
      pinValid = pinHash === storedHash;

      // Migration automatique : rehacher en bcrypt pour les prochaines connexions
      if (pinValid) {
        const bcrypt = await import('bcryptjs');
        const newHash = await bcrypt.hash(pin, 10);
        await supabase.from('drivers').update({ pin_code: newHash }).eq('id', d.id);
      }
    }

    if (!pinValid) return null;

    return {
      id: d.id,
      name: d.profile?.name || 'Inconnu',
      phone: d.phone || '',
      pinCode: pin,
      agencyId: d.agency_id,
      agencyName: d.agency?.profile?.name || '',
      vehicle: d.vehicle || 'Moto',
      available: d.available || false,
      deliveries: 0,
      rating: 5,
      joinedDate: new Date(d.created_at).toLocaleDateString('fr-FR'),
    };
  }
  // -- 10. Drop Point Agents -----------------------------------------

  /** Superadmin creates a drop point agent. Returns generated agentNumber + plain PIN. */
  async createDropPointAgent(
    data: { name: string; dropPointId: string }
  ): Promise<{ agent: DropPointAgent; plainPin: string }> {
    const dp = this.getDropPointById(data.dropPointId);
    if (!dp) throw new Error('Point Relais introuvable.');

    // Generate unique 9-digit agent number
    let agentNumber: string;
    do {
      agentNumber = String(secureRandomInt(100_000_000, 1_000_000_000));
    } while (dropPointAgentCache.has(agentNumber));

    // Generate 6-digit PIN
    const plainPin = String(secureRandomInt(100_000, 1_000_000));

    // Hash the PIN using bcrypt (jamais en clair)
    const bcrypt = await import('bcryptjs');
    const pinHash = await bcrypt.hash(plainPin, 10);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Store in cache
    dropPointAgentCache.set(agentNumber, {
      id,
      agentNumber,
      pinHash,
      name: data.name,
      dropPointId: data.dropPointId,
      isActive: true,
      createdAt,
    });

    // Persist to Supabase (mandatory — data must survive server restarts)
    const { error: dbErr } = await supabase.from('drop_point_agents').insert({
      id,
      agent_number: agentNumber,
      pin_hash: pinHash,
      name: data.name,
      drop_point_id: data.dropPointId,
      is_active: true,
      created_at: createdAt,
    });

    if (dbErr) {
      // Remove from cache since DB failed, to keep them in sync
      dropPointAgentCache.delete(agentNumber);
      throw new Error(`Impossible de sauvegarder l'agent en base de données : ${dbErr.message}`);
    }

    const agent: DropPointAgent = {
      id,
      agentNumber,
      name: data.name,
      dropPointId: data.dropPointId,
      dropPointName: dp.name,
      dropPointCommune: dp.commune,
      isActive: true,
      createdAt,
    };

    return { agent, plainPin };
  }

  /** Authenticate a drop point agent by agentNumber + PIN with brute-force lockout protection. */
  async authenticateDropPointAgent(
    agentNumber: string,
    pin: string
  ): Promise<DropPointAgent | null> {
    // 1. Vérifier si le compte est temporairement verrouillé pour tentatives erronées (brute-force)
    const now = Date.now();
    const lockout = agentLockoutMap.get(agentNumber);
    if (lockout && lockout.lockedUntil > now) {
      console.warn(`[authenticateDropPointAgent] Compte #${agentNumber} verrouillé jusqu'à ${new Date(lockout.lockedUntil).toISOString()}`);
      return null;
    }

    // Récupérer depuis Supabase ou cache
    let agentRecord: { id: string; agent_number: string; pin_hash: string; name: string; drop_point_id: string; is_active: boolean; created_at: string } | null = null;

    try {
      const { data, error } = await supabase
        .from('drop_point_agents')
        .select('id, agent_number, pin_hash, name, drop_point_id, is_active, created_at')
        .eq('agent_number', agentNumber)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) agentRecord = data;
    } catch {/* check cache fallback */}

    if (!agentRecord) {
      const cached = dropPointAgentCache.get(agentNumber);
      if (cached && cached.isActive) {
        agentRecord = {
          id: cached.id,
          agent_number: cached.agentNumber,
          pin_hash: cached.pinHash,
          name: cached.name,
          drop_point_id: cached.dropPointId,
          is_active: cached.isActive,
          created_at: cached.createdAt,
        };
      }
    }

    if (!agentRecord) return null;

    // 2. Vérification du PIN (supporte bcrypt + migration legacy SHA-256)
    let pinValid = false;
    const storedHash = agentRecord.pin_hash || '';

    if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
      const bcrypt = await import('bcryptjs');
      pinValid = await bcrypt.compare(pin, storedHash);
    } else if (/^[0-9a-f]{64}$/i.test(storedHash)) {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(pin));
      const sha256 = Buffer.from(hashBuffer).toString('hex');
      pinValid = sha256 === storedHash;

      if (pinValid) {
        // Migration transparente vers bcrypt
        const bcrypt = await import('bcryptjs');
        const newHash = await bcrypt.hash(pin, 10);
        await supabase.from('drop_point_agents').update({ pin_hash: newHash }).eq('id', agentRecord.id);
      }
    }

    // 3. Gestion des tentatives échouées & verrouillage
    if (!pinValid) {
      const currentFailures = (lockout?.attempts || 0) + 1;
      if (currentFailures >= 5) {
        // Verrouiller 15 minutes + alerter le centre de sécurité
        agentLockoutMap.set(agentNumber, { attempts: currentFailures, lockedUntil: now + 15 * 60 * 1000 });
        try {
          await supabase.from('security_alerts').insert({
            type: 'account_locked',
            severity: 'high',
            message: `Agent #${agentNumber} verrouillé (bruteforce détecté)`,
            detail: `5 tentatives de code PIN erronées consécutives. Accès verrouillé pour 15 minutes.`,
            userName: agentRecord.name,
            timestamp: new Date().toISOString(),
            resolved: false,
          });
        } catch {/* fallback log */}
      } else {
        agentLockoutMap.set(agentNumber, { attempts: currentFailures, lockedUntil: 0 });
      }
      return null;
    }

    // Connexion réussie -> réinitialiser les tentatives
    agentLockoutMap.delete(agentNumber);

    // Mettre en cache
    dropPointAgentCache.set(agentNumber, {
      id: agentRecord.id,
      agentNumber: agentRecord.agent_number,
      pinHash: agentRecord.pin_hash,
      name: agentRecord.name,
      dropPointId: agentRecord.drop_point_id,
      isActive: agentRecord.is_active,
      createdAt: agentRecord.created_at,
    });

    const dp = this.getDropPointById(agentRecord.drop_point_id);
    return {
      id: agentRecord.id,
      agentNumber: agentRecord.agent_number,
      name: agentRecord.name,
      dropPointId: agentRecord.drop_point_id,
      dropPointName: dp?.name || agentRecord.drop_point_id,
      dropPointCommune: dp?.commune || '',
      isActive: agentRecord.is_active,
      createdAt: agentRecord.created_at,
    };
  }

  /** Verify a 9-digit agent number and return agent info (used by driver UI). */
  async verifyAgentNumber(agentNumber: string): Promise<DropPointAgent | null> {
    try {
      const { data, error } = await supabase
        .from('drop_point_agents')
        .select('id, agent_number, pin_hash, name, drop_point_id, is_active, created_at')
        .eq('agent_number', agentNumber)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        dropPointAgentCache.set(agentNumber, {
          id: data.id,
          agentNumber: data.agent_number,
          pinHash: data.pin_hash,
          name: data.name,
          dropPointId: data.drop_point_id,
          isActive: data.is_active,
          createdAt: data.created_at,
        });

        const dp = this.getDropPointById(data.drop_point_id);
        return {
          id: data.id,
          agentNumber: data.agent_number,
          name: data.name,
          dropPointId: data.drop_point_id,
          dropPointName: dp?.name || data.drop_point_id,
          dropPointCommune: dp?.commune || '',
          isActive: data.is_active,
          createdAt: data.created_at,
        };
      }
      if (!error && !data) return null;
    } catch (e) {
      console.warn('[verifyAgentNumber] DB query failed, checking cache fallback:', e);
    }

    // Fallback cache si coupure réseau
    const cached = dropPointAgentCache.get(agentNumber);
    if (cached && cached.isActive) {
      const dp = this.getDropPointById(cached.dropPointId);
      return {
        id: cached.id,
        agentNumber: cached.agentNumber,
        name: cached.name,
        dropPointId: cached.dropPointId,
        dropPointName: dp?.name || cached.dropPointId,
        dropPointCommune: dp?.commune || '',
        isActive: cached.isActive,
        createdAt: cached.createdAt,
      };
    }
    return null;
  }

  /** Get all drop point agents (optionally filtered by dropPointId), always from Supabase. */
  async getDropPointAgents(dropPointId?: string): Promise<DropPointAgent[]> {
    try {
      // Ensure drop points list is populated
      if (DEFAULT_DROP_POINTS.length === 0) {
        await this.getDropPoints();
      }

      let query = supabase
        .from('drop_point_agents')
        .select(`
          id, agent_number, pin_hash, name, drop_point_id, is_active, created_at,
          drop_point:drop_points(id, name, commune)
        `)
        .order('created_at', { ascending: false });

      if (dropPointId) {
        query = query.eq('drop_point_id', dropPointId);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.warn('[getDropPointAgents] DB query failed, falling back to cache:', error);
        // Fallback to in-memory cache
        const agents: DropPointAgent[] = [];
        for (const [, cached] of dropPointAgentCache) {
          if (dropPointId && cached.dropPointId !== dropPointId) continue;
          const dp = this.getDropPointById(cached.dropPointId);
          agents.push({
            id: cached.id,
            agentNumber: cached.agentNumber,
            name: cached.name,
            dropPointId: cached.dropPointId,
            dropPointName: dp?.name || cached.dropPointId,
            dropPointCommune: dp?.commune || '',
            isActive: cached.isActive,
            createdAt: cached.createdAt,
          });
        }
        return agents;
      }

      // Populate cache for quick future lookups
      for (const row of data) {
        dropPointAgentCache.set(row.agent_number, {
          id: row.id,
          agentNumber: row.agent_number,
          pinHash: row.pin_hash,
          name: row.name,
          dropPointId: row.drop_point_id,
          isActive: row.is_active,
          createdAt: row.created_at,
        });
      }

      return data.map((row: any) => {
        const dp = row.drop_point || this.getDropPointById(row.drop_point_id);
        return {
          id: row.id,
          agentNumber: row.agent_number,
          name: row.name,
          dropPointId: row.drop_point_id,
          dropPointName: dp?.name || row.drop_point_id,
          dropPointCommune: dp?.commune || '',
          isActive: row.is_active,
          createdAt: row.created_at,
        };
      });
    } catch (e) {
      console.error('[getDropPointAgents] Unexpected error:', e);
      return [];
    }
  }

  /** Toggle or set drop point agent active status. */
  async setDropPointAgentStatus(agentId: string, isActive: boolean): Promise<boolean> {
    for (const [num, cached] of dropPointAgentCache) {
      if (cached.id === agentId) {
        dropPointAgentCache.set(num, { ...cached, isActive });
        break;
      }
    }
    try {
      await supabase.from('drop_point_agents').update({ is_active: isActive }).eq('id', agentId);
    } catch (e) {
      console.warn('[setDropPointAgentStatus] DB update failed, cached in memory:', e);
    }
    return true;
  }

  /** Driver assigns a parcel to a drop point via agent number. */
  async assignColisToDropPoint(
    colisId: string,
    agentNumber: string,
    _driverId: string
  ): Promise<{ success: boolean; message: string; agent?: DropPointAgent }> {
    const agent = await this.verifyAgentNumber(agentNumber);
    if (!agent) {
      return { success: false, message: 'Numéro agent introuvable ou désactivé.' };
    }
    const { data: dpData, error } = await supabase.from('drop_points').select('credits').eq('id', agent.dropPointId).single();
    if (error || !dpData) return { success: false, message: 'Point relais introuvable dans la base de données.' };
    
    if (dpData.credits <= 0) {
      return { success: false, message: 'Opération refusée : Ce Point Relais n\'a plus de crédits.' };
    }

    const now = new Date().toISOString();
    packageMetaCache.set(colisId, {
      ...packageMetaCache.get(colisId),
      deliveryMode: 'DROP_POINT_LAST_MILE',
      destDropPointId: agent.dropPointId,
      reroutedAt: now,
      customStatus: 'Déposé en point relais',
    });

    // Mark in pending confirmations cache
    pendingConfirmations.set(colisId, { agentId: agent.id, depositedAt: now });

    try {
      await supabase.from('packages').update({
        status: 'DEPOSITED_AT_DROP_POINT',
        dest_drop_point_id: agent.dropPointId,
      }).eq('id', colisId);
    } catch (e) {
      console.warn('[assignColisToDropPoint] DB update failed, cached in memory:', e);
    }

    return { success: true, message: `Colis attribué au ${agent.dropPointName}.`, agent };
  }

  async assignPackageToDropPointByVendor(
    colisId: string,
    dropPointId: string,
    agencyId: string,
    vendeurName: string,
    vendeurPhone: string
  ): Promise<{ success: boolean; message: string }> {
    const { data: dpData, error } = await supabase.from('drop_points').select('credits, name').eq('id', dropPointId).single();
    if (error || !dpData) return { success: false, message: 'Point relais introuvable dans la base de données.' };
    
    if (dpData.credits <= 0) {
      return { success: false, message: 'Opération refusée : Ce Point Relais n\'a plus de crédits.' };
    }

    packageMetaCache.set(colisId, {
      ...packageMetaCache.get(colisId),
      deliveryMode: 'DROP_POINT_FIRST_MILE',
      originDropPointId: dropPointId,
      vendeurName,
      vendeurPhone,
      customStatus: 'En attente de confirmation relais',
    });

    try {
      await supabase.from('packages').update({
        status: 'PENDING_DROP_POINT_CONFIRMATION',
        origin_drop_point_id: dropPointId,
        agency_id: agencyId
      }).eq('id', colisId);
    } catch (e) {
      console.warn('[assignPackageToDropPointByVendor] DB update failed:', e);
    }

    return { success: true, message: `Colis attribué au ${dpData.name}. Le relais doit confirmer la réception.` };
  }

  /** Agent confirms physical reception of a parcel. */
  async confirmDropPointReception(
    colisId: string,
    agentId: string // agentId is the drop point ID or agent ID
  ): Promise<{ success: boolean; message: string; type?: 'vendor' | 'driver' }> {
    // 1. Fetch the package directly from DB to get reliable origin vs dest ids
    const { data: pkg, error } = await supabase.from('packages').select('status, origin_drop_point_id, dest_drop_point_id').eq('id', colisId).single();
    
    if (error || !pkg) return { success: false, message: 'Colis introuvable.' };

    // Detect type: vendor drop = PENDING_DROP_POINT_CONFIRMATION, driver drop = DEPOSITED_AT_DROP_POINT
    const isVendorDrop = pkg.status === 'PENDING_DROP_POINT_CONFIRMATION';
    const isDriverDrop = pkg.status === 'DEPOSITED_AT_DROP_POINT';

    if (!isVendorDrop && !isDriverDrop) {
      return { success: false, message: `Statut inattendu: ${pkg.status}. Impossible de confirmer.` };
    }

    const currentDpId = isVendorDrop ? pkg.origin_drop_point_id : pkg.dest_drop_point_id;
    if (currentDpId) {
      const { data: dpData } = await supabase.from('drop_points').select('credits').eq('id', currentDpId).single();
      if (dpData) {
         if (dpData.credits <= 0) {
            return { success: false, message: 'Opération refusée : Ce Point Relais n\'a plus de crédits.' };
         }
         // Deduct credit — fallback au direct update si la RPC n'existe pas
         const newCredits = dpData.credits - 1;
         const { error: rpcError } = await supabase.rpc('decrement_drop_point_credits', { dp_id: currentDpId });
         if (rpcError) {
           await supabase.from('drop_points').update({ credits: newCredits }).eq('id', currentDpId);
         }
      }
    }

    // S'il vient d'un vendeur (origin), on génère le code et passe en attente de collecte
    if (isVendorDrop) {
      const code = generatePickupCode();
      packageMetaCache.set(colisId, {
        ...packageMetaCache.get(colisId),
        customStatus: 'En attente de collecte',
        pickupCode: code
      });
      try {
        await supabase.from('packages').update({
          status: 'WAITING_FOR_AGENCY_PICKUP',
          pickup_code: code
        }).eq('id', colisId);
      } catch (e) {
        console.warn('DB update failed', e);
      }
      return { success: true, type: 'vendor', message: 'Réception confirmée. Vous pouvez maintenant assigner une agence.' };
    }

    // Cas normal : colis déposé par le livreur, disponible pour le client
    packageMetaCache.set(colisId, {
      ...packageMetaCache.get(colisId),
      customStatus: 'Disponible au point relais',
    });

    pendingConfirmations.delete(colisId);

    try {
      await supabase.from('packages').update({
        status: 'AVAILABLE_AT_PICKUP_POINT',
      }).eq('id', colisId);
    } catch (e) {
      console.warn('[confirmDropPointReception] DB update failed, cached in memory:', e);
    }

    return { success: true, type: 'driver', message: 'Réception confirmée. Le client peut maintenant récupérer son colis.' };
  }

  /** Assign an agency to a vendor-deposited ColisItem (after drop point confirmation). */
  async assignAgencyToColisItemDeposit(
    colisId: string,
    agencyId: string
  ): Promise<{ success: boolean; message: string }> {
    packageMetaCache.set(colisId, {
      ...packageMetaCache.get(colisId),
      customStatus: 'Déposé en point relais'
    });
    
    try {
      await supabase.from('packages').update({
        agency_id: agencyId,
        status: 'DEPOSITED_AT_DROP_POINT' // Agence assignée, prêt à être récupéré
      }).eq('id', colisId);
    } catch (e) {
      console.warn('DB update failed', e);
    }
    return { success: true, message: 'Dépôt du vendeur confirmé avec succès.' };
  }

  /** Agent hands over the package to the driver using pickup_code */
  async handoverPackageToDriver(pickupCode: string, dropPointId: string): Promise<{ success: boolean; message: string }> {
    const { data: pkg, error } = await supabase
      .from('packages')
      .select('id, status, origin_drop_point_id')
      .eq('pickup_code', pickupCode)
      .eq('origin_drop_point_id', dropPointId)
      .single();

    if (error || !pkg) return { success: false, message: 'Code de collecte invalide ou colis introuvable.' };
    
    if (pkg.status !== 'WAITING_FOR_AGENCY_PICKUP') {
      return { success: false, message: 'Ce colis n\'est pas en attente de collecte.' };
    }

    try {
      await supabase.from('packages').update({ status: 'IN_TRANSIT' }).eq('id', pkg.id);
      
      packageMetaCache.set(pkg.id, {
        ...packageMetaCache.get(pkg.id),
        customStatus: 'En transit',
      });
      return { success: true, message: 'Colis remis au livreur avec succès.' };
    } catch (e) {
      console.warn('handoverPackageToDriver error', e);
      return { success: false, message: 'Erreur lors de la mise à jour.' };
    }
  }

  /** Get packages deposited by vendors waiting for agent confirmation. */
  async getIncomingVendorPackagesForDropPoint(dropPointId: string): Promise<ColisItem[]> {
    const all = await this.getAllPackages();
    return all.filter(p => p.originDropPointId === dropPointId && p.status === 'En attente de confirmation relais');
  }

  /** Get packages deposited by drivers waiting for agent confirmation. */
  async getIncomingDriverPackagesForDropPoint(dropPointId: string): Promise<ColisItem[]> {
    const all = await this.getAllPackages();
    return all.filter(p => p.destDropPointId === dropPointId && p.status === 'Déposé en point relais');
  }

  /** Get packages already confirmed available for pickup at a drop point. */
  async getAvailablePackagesForDropPoint(dropPointId: string): Promise<ColisItem[]> {
    const all = await this.getAllPackages();
    return all.filter(p =>
      (p.destDropPointId === dropPointId || p.originDropPointId === dropPointId) &&
      (p.status === 'Disponible au point relais')
    );
  }

  /** Get vendor deposits confirmed by the drop point (waiting for agency / agency already assigned). */
  async getVendorDepositsForDropPoint(dropPointId: string): Promise<ColisItem[]> {
    const all = await this.getAllPackages();
    return all.filter(p =>
      p.originDropPointId === dropPointId &&
      (p.status === 'En attente de collecte' || p.status === 'Déposé en point relais' || p.rawStatus === 'WAITING_FOR_AGENCY_PICKUP')
    );
  }

  // -- Vendor Deposit Flow -------------------------------------------

  async createVendorDeposit(data: {
    dropPointId: string;
    vendeurName: string;
    vendeurPhone: string;
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    description?: string;
  }): Promise<ColisItem> {
    const dp = this.getDropPointById(data.dropPointId);
    if (!dp) throw new Error('Point relais introuvable.');

    const trackCode = 'MC-' + secureRandomInt(100000, 1000000).toString();
    const otp = secureRandomInt(100000, 1000000).toString();
    const pickupCode = generatePickupCode();

    // On crée directement dans la table packages Supabase
    // On utilise un vendeur_id générique ou on le laisse null si le schéma le permet (ici vendeur_id est NOT NULL dans schema.sql)
    // Donc on va chercher le premier vendeur, ou on doit adapter pour utiliser le vrai vendeur
    const { data: defaultVendeur } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'vendeur')
      .limit(1)
      .single();
    
    const vendeurId = defaultVendeur?.id || '11111111-1111-1111-1111-111111111111';

    const insertData: any = {
      tracking_code: trackCode,
      vendeur_id: vendeurId,
      client_name: data.clientName,
      client_phone: data.clientPhone,
      client_address: data.clientAddress,
      status: 'DEPOSITED_AT_DROP_POINT', // Le statut immédiat
      validation_code: otp,
      delivery_mode: 'DROP_POINT_FIRST_MILE',
      origin_drop_point_id: data.dropPointId,
      pickup_code: pickupCode,
      paid_by_client: true,
      delivery_price: 0,
      package_price: 0,
    };

    const { data: pkg, error } = await supabase.from('packages').insert(insertData).select().single();
    if (error) throw error;

    // Cache pour les métadonnées hors BDD si nécessaire
    packageMetaCache.set(pkg.id, {
      deliveryMode: 'DROP_POINT_FIRST_MILE',
      originDropPointId: data.dropPointId,
      pickupCode: pickupCode,
      vendeurName: data.vendeurName,
      vendeurPhone: data.vendeurPhone,
      customStatus: 'Déposé en point relais',
    });

    const result = await this.getPackageByTracking(pkg.id);
    if (!result) throw new Error('Erreur lors de la récupération du colis créé.');
    return result;
  }

  /** Assign an agency to collect a vendor deposit. Sets agencyId on the deposit. */
  async assignVendorDepositToAgency(
    colisId: string,
    agencyId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.assignAgencyById(colisId, agencyId).then(() => ({
      success: true,
      message: 'Agence assignée avec succès.'
    })).catch((e) => ({
      success: false,
      message: 'Erreur lors de l\'assignation : ' + (e as Error).message
    }));
  }

  /** Mark a vendor deposit as collected by the driver. */
  async markVendorDepositCollected(colisId: string): Promise<{ success: boolean; message: string }> {
    try {
      await supabase.from('packages').update({
        status: 'IN_TRANSIT'
      }).eq('id', colisId);
      
      packageMetaCache.set(colisId, {
        ...packageMetaCache.get(colisId),
        customStatus: 'En transit'
      });
      return { success: true, message: 'Colis marqué comme collecté.' };
    } catch (e) {
      return { success: false, message: 'Erreur lors de la mise à jour.' };
    }
  }

  /** Get a single vendor deposit by pickup code. */
  getVendorDepositByCode(pickupCode: string): VendorDeposit | null {
    return vendorDepositCache.get(pickupCode) || null;
  }

  /** Get all agencies (for drop point agent to choose from). */
  async getAgenciesForDropPoint(): Promise<{ id: string; name: string }[]> {
    const agencies = await this.getAgencies();
    return agencies
      .filter(a => a.status === 'APPROVED')
      .map(a => ({ id: a.id, name: a.name }));
  }
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string; metadata?: any }) {
    const { error } = await supabase
      .from('profiles')
      .update({
        name: data.name,
        phone: data.phone,
        metadata: data.metadata
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      return { success: false, message: 'Erreur lors de la mise à jour du profil.' };
    }
    return { success: true };
  }
}

export const dataService = new DataService();
