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
  name: string;
  commune: string;
  address: string;
  phone: string;
  managerName: string;
  openingHours: string;
  isActive: boolean;
}

export let DEFAULT_DROP_POINTS: DropPoint[] = [];

export interface ColisItem {
  id: string;
  trackingCode: string;
  vendeurId: string;       // the vendor's profile id
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  prixColis: number;       // not in DB — kept for UI compatibility, defaults to 0
  prixLivraison: number | null;
  poids: number;           // not in DB — kept for UI compatibility, defaults to 1
  longueur: number;
  largeur: number;
  hauteur: number;
  distance: number;
  status: 'Créé' | "En attente d'agence" | 'Accepté' | 'En transit' | 'En attente de confirmation relais' | 'Déposé en point relais' | 'Disponible au point relais' | 'En attente de collecte' | 'Livré' | 'Annulé';
  pickupCode?: string | null;    // Code retrait point relais (ex: ABC123)
  vendeurName?: string | null;   // Nom du vendeur ayant déposé
  vendeurPhone?: string | null;  // Téléphone du vendeur
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
  deliveryMode?: 'DIRECT' | 'DROP_POINT_FIRST_MILE' | 'DROP_POINT_LAST_MILE';
  originDropPointId?: string | null;
  originDropPoint?: DropPoint | null;
  destDropPointId?: string | null;
  destDropPoint?: DropPoint | null;
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
}

export const DEFAULT_AGENCIES: AgencyInfo[] = [];

// In-memory overlay cache for packages and agencies metadata (e.g. drop points, approval statuses)
const packageMetaCache = new Map<string, {
  deliveryMode?: 'DIRECT' | 'DROP_POINT_FIRST_MILE' | 'DROP_POINT_LAST_MILE';
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
}>();

// In-memory store for drop point agents (created by Superadmin)
// key = agentNumber (9-digit string)
const dropPointAgentCache = new Map<string, {
  id: string;
  agentNumber: string;
  pinHash: string;
  name: string;
  dropPointId: string;
  isActive: boolean;
  createdAt: string;
}>([
  [
    '123456789',
    {
      id: 'dpa-seed-01',
      agentNumber: '123456789',
      // SHA-256 for '123456'
      pinHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
      name: 'Sarah Maloba',
      dropPointId: 'DP-LIM-01',
      isActive: true,
      createdAt: '2026-09-01T10:00:00.000Z',
    }
  ]
]);

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

/** Generate a pickup code: 3 uppercase letters + 3 digits */
function generatePickupCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  const digits  = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i++) code += digits[Math.floor(Math.random() * digits.length)];
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
    case 'DELIVERED': return 'Livré';
    case 'CANCELLED': return 'Annulé';
    default: return 'Créé';
  }
};

// Maps a raw Supabase packages row to a ColisItem
function mapPackage(p: any): ColisItem {
  const meta = packageMetaCache.get(p.id) || {};
  const originDpId = p.origin_drop_point_id || meta.originDropPointId || null;
  const destDpId = p.dest_drop_point_id || meta.destDropPointId || null;

  const originDropPoint = originDpId ? (DEFAULT_DROP_POINTS.find(dp => dp.id === originDpId) || null) : null;
  const destDropPoint = destDpId ? (DEFAULT_DROP_POINTS.find(dp => dp.id === destDpId) || null) : null;

  return {
    id: p.id,
    trackingCode: p.tracking_code,
    vendeurId: p.vendeur_id || '',
    clientName: p.client_name,
    clientPhone: p.client_phone || '',
    clientAddress: p.client_address,
    prixColis: p.package_price || 0,
    prixLivraison: p.delivery_price || null,
    poids: 1,
    longueur: 0,
    largeur: 0,
    hauteur: 0,
    distance: 0,
    status: meta.customStatus || mapStatusToApp(p.status, p.id),
    agence: p.agency?.profile?.name || null,
    agencyId: p.agency_id,
    livreur: p.driver?.profile?.name || null,
    livreurPhone: p.driver?.phone || null,
    driverId: p.driver_id,
    otp: p.validation_code,
    date: new Date(p.created_at).toLocaleDateString('fr-FR'),
    confirmed: false,
    deliveredAt: null,
    paidByClient: p.paid_by_client !== undefined ? p.paid_by_client : true,
    isPrepaid: p.is_prepaid || false,
    deliveryPrice: p.delivery_price || 0,
    vendorPaid: p.vendor_paid || false,
    deliveryMode: meta.deliveryMode || p.delivery_mode || (destDpId ? 'DROP_POINT_LAST_MILE' : originDpId ? 'DROP_POINT_FIRST_MILE' : 'DIRECT'),
    originDropPointId: originDpId,
    originDropPoint,
    destDropPointId: destDpId,
    destDropPoint,
    inaccessibilityNote: meta.inaccessibilityNote || p.inaccessibility_note || null,
    reroutedAt: meta.reroutedAt || p.rerouted_at || null,
    pickupCode: p.pickup_code || meta.pickupCode || null,
    vendeurName: p.vendeur_name || meta.vendeurName || null,
    vendeurPhone: p.vendeur_phone || meta.vendeurPhone || null,
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
          paid_by_client, delivery_price,
          origin_drop_point_id, dest_drop_point_id, delivery_mode,
          inaccessibility_note, rerouted_at,
          agency:agencies(id, profile:profiles(name)),
          driver:drivers(id, phone, profile:profiles(name))
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

    return data.map(mapPackage);
  }

  // -- 2. Get Single Package -------------
  async getPackageByTracking(query: string): Promise<ColisItem | null> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    const { data, error } = await supabase
      .from('packages')
      .select(`
        id, tracking_code, vendeur_id, agency_id, driver_id,
        client_name, client_address, client_phone,
        status, validation_code, created_at, updated_at,
        paid_by_client, delivery_price,
        origin_drop_point_id, dest_drop_point_id, delivery_mode,
        inaccessibility_note, rerouted_at,
        agency:agencies(id, profile:profiles(name)),
        driver:drivers(id, phone, profile:profiles(name))
      `)
      .or(`id.eq.${cleanQuery},tracking_code.eq.${cleanQuery},validation_code.eq.${cleanQuery}`)
      .single();

    if (error || !data) return null;
    return mapPackage(data);
  }

  // -- 3. Create New Package --------------------------
  async createPackage(p: {
    clientName: string;
    clientAddress: string;
    clientPhone: string;
    prixColis: number;
    poids: number;
    vendeurId: string;
    paidByClient: boolean;
    isPrepaid: boolean;
    deliveryMode?: 'DIRECT' | 'DROP_POINT_FIRST_MILE' | 'DROP_POINT_LAST_MILE';
    originDropPointId?: string;
  }): Promise<ColisItem> {
    const trackCode = 'MC-' + Math.floor(100000 + Math.random() * 900000).toString();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

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

    const initialStatus = p.deliveryMode === 'DROP_POINT_FIRST_MILE'
      ? 'DEPOSITED_AT_DROP_POINT'
      : 'CREATED';

    const insertData: any = {
      tracking_code: trackCode,
      vendeur_id: vendeurId,
      client_name: p.clientName,
      client_phone: p.clientPhone,
      client_address: p.clientAddress,
      status: initialStatus,
      validation_code: otp,
      paid_by_client: p.paidByClient,
      is_prepaid: p.isPrepaid,
      delivery_price: 0,
      package_price: p.prixColis,
    };

    const { data, error } = await supabase.from('packages').insert(insertData).select().single();
    if (error) throw error;

    // Cache drop point metadata
    if (p.deliveryMode || p.originDropPointId) {
      packageMetaCache.set(data.id, {
        deliveryMode: p.deliveryMode || 'DIRECT',
        originDropPointId: p.originDropPointId || null,
        customStatus: p.deliveryMode === 'DROP_POINT_FIRST_MILE' ? 'Déposé en point relais' : undefined,
      });
    }

    return this.getPackageByTracking(data.id) as Promise<ColisItem>;
  }

  // -- 4. Assign Agency by ID (preferred) ----------------------
  async assignAgencyById(colisId: string, agencyId: string): Promise<void> {
    await supabase.from('packages').update({
      agency_id: agencyId,
      status: 'PENDING_AGENCY',
    }).eq('id', colisId);
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

  async validateDeliveryOtp(colisId: string, otp: string): Promise<{ success: boolean; message: string; package?: ColisItem }> {
    const { data: pkg, error } = await supabase
      .from('packages')
      .select('validation_code')
      .eq('id', colisId)
      .single();

    if (error || !pkg) return { success: false, message: 'Colis introuvable.' };
    if (pkg.validation_code !== otp) return { success: false, message: 'Le code OTP est incorrect.' };

    const success = await this.validateDelivery(colisId);
    if (!success) return { success: false, message: 'Erreur lors de la validation.' };

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
      name: dp.name,
      commune: dp.commune,
      address: dp.address,
      phone: dp.phone,
      managerName: dp.manager_name,
      openingHours: dp.opening_hours,
      isActive: dp.is_active
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
        client_name, client_address, client_phone,
        status, validation_code, created_at, updated_at,
        paid_by_client, delivery_price,
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
          address,
          phone,
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
        const status: AgencyStatus = cached?.status || (ag as any).status || 'APPROVED';
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
          coverageZones: cached?.coverageZones || ['Gombe', 'Limete', 'Bandalungwa'],
          fleetSize: cached?.fleetSize || 4,
          createdAt: ag.created_at || cached?.createdAt || new Date().toISOString(),
          drivers: [],
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
        });
      }
    }

    return agenciesList;
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
    // 1. Hash submitted PIN
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(pin));
    const pinHash = Buffer.from(hashBuffer).toString('hex');

    // 2. Fetch driver by phone + matching pin_code
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
      .eq('pin_code', pinHash)
      .single();

    if (error || !data) return null;

    const d = data as any;
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
      agentNumber = String(Math.floor(100_000_000 + Math.random() * 900_000_000));
    } while (dropPointAgentCache.has(agentNumber));

    // Generate 6-digit PIN
    const plainPin = String(Math.floor(100_000 + Math.random() * 900_000));

    // Hash the PIN
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(plainPin));
    const pinHash = Buffer.from(hashBuffer).toString('hex');

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

  /** Authenticate a drop point agent by agentNumber + PIN. */
  async authenticateDropPointAgent(
    agentNumber: string,
    pin: string
  ): Promise<DropPointAgent | null> {
    // First try in-memory cache
    const cached = dropPointAgentCache.get(agentNumber);
    if (cached) {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(pin));
      const pinHash = Buffer.from(hashBuffer).toString('hex');
      if (pinHash !== cached.pinHash || !cached.isActive) return null;
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

    // Fallback to Supabase
    try {
      const { data, error } = await supabase
        .from('drop_point_agents')
        .select('id, agent_number, pin_hash, name, drop_point_id, is_active, created_at')
        .eq('agent_number', agentNumber)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) return null;

      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(pin));
      const pinHash = Buffer.from(hashBuffer).toString('hex');
      if (pinHash !== data.pin_hash) return null;

      // Populate cache
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
    } catch (e) {
      console.warn('[authenticateDropPointAgent] DB query failed:', e);
      return null;
    }
  }

  /** Verify a 9-digit agent number and return agent info (used by driver UI). */
  async verifyAgentNumber(agentNumber: string): Promise<DropPointAgent | null> {
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

    try {
      const { data } = await supabase
        .from('drop_point_agents')
        .select('id, agent_number, pin_hash, name, drop_point_id, is_active, created_at')
        .eq('agent_number', agentNumber)
        .eq('is_active', true)
        .maybeSingle();

      if (!data) return null;

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
    } catch {
      return null;
    }
  }

  /** Get all drop point agents (optionally filtered by dropPointId), always from Supabase. */
  async getDropPointAgents(dropPointId?: string): Promise<DropPointAgent[]> {
    try {
      let query = supabase
        .from('drop_point_agents')
        .select('id, agent_number, pin_hash, name, drop_point_id, is_active, created_at')
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
        const dp = this.getDropPointById(row.drop_point_id);
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

  /** Vendeur attribue un colis à un point relais (via scan de QR code). */
  async assignPackageToDropPointByVendor(
    colisId: string,
    dropPointId: string,
    vendeurName: string,
    vendeurPhone: string
  ): Promise<{ success: boolean; message: string }> {
    const dp = this.getDropPointById(dropPointId);
    if (!dp) return { success: false, message: 'Point relais introuvable.' };

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
      }).eq('id', colisId);
    } catch (e) {
      console.warn('[assignPackageToDropPointByVendor] DB update failed:', e);
    }

    return { success: true, message: `Colis attribué au ${dp.name}. Le relais doit confirmer la réception.` };
  }

  /** Agent confirms physical reception of a parcel. */
  async confirmDropPointReception(
    colisId: string,
    _agentId: string
  ): Promise<{ success: boolean; message: string }> {
    const all = await this.getAllPackages();
    const colis = all.find(c => c.id === colisId);
    
    // S'il vient d'un vendeur (origin), on génère le code et passe en attente de collecte
    if (colis?.status === 'En attente de confirmation relais') {
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
      return { success: true, message: 'Réception confirmée. Vous pouvez maintenant assigner une agence.' };
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

    return { success: true, message: 'Réception confirmée. Le client peut maintenant récupérer son colis.' };
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
    return { success: true, message: 'Agence assignée avec succès.' };
  }

  /** Get packages deposited at a drop point waiting for agent confirmation OR waiting for agency assignment. */
  async getIncomingPackagesForDropPoint(dropPointId: string): Promise<ColisItem[]> {
    const all = await this.getAllPackages();
    return all.filter(p =>
      (p.destDropPointId === dropPointId && p.status === 'Déposé en point relais') ||
      (p.originDropPointId === dropPointId && (p.status === 'En attente de confirmation relais' || p.status === 'En attente de collecte'))
    );
  }

  /** Get packages already confirmed available for pickup at a drop point. */
  async getAvailablePackagesForDropPoint(dropPointId: string): Promise<ColisItem[]> {
    const all = await this.getAllPackages();
    return all.filter(p =>
      (p.destDropPointId === dropPointId || p.originDropPointId === dropPointId) &&
      (p.status === 'Disponible au point relais')
    );
  }

  // -- Vendor Deposit Flow -------------------------------------------

  /**
   * Register a parcel deposited by a vendor at a drop point.
   * Returns the generated pickup code (displayed on the ticket).
   */
  createVendorDeposit(data: {
    dropPointId: string;
    vendeurName: string;
    vendeurPhone: string;
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    description?: string;
  }): VendorDeposit {
    const dp = this.getDropPointById(data.dropPointId);
    if (!dp) throw new Error('Point relais introuvable.');

    const pickupCode = generatePickupCode();
    const deposit: VendorDeposit = {
      id: `vd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pickupCode,
      dropPointId: data.dropPointId,
      dropPointName: dp.name,
      vendeurName: data.vendeurName,
      vendeurPhone: data.vendeurPhone,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientAddress: data.clientAddress,
      description: data.description || '',
      agencyId: null,
      agencyName: null,
      status: 'PENDING_AGENCY',
      createdAt: new Date().toISOString(),
      collectedAt: null,
    };

    vendorDepositCache.set(pickupCode, deposit);
    return deposit;
  }

  /** Get all vendor deposits for a given drop point. */
  getVendorDepositsForDropPoint(dropPointId: string): VendorDeposit[] {
    const result: VendorDeposit[] = [];
    for (const [, d] of vendorDepositCache) {
      if (d.dropPointId === dropPointId) result.push(d);
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Assign an agency to collect a vendor deposit. Sets agencyId on the deposit. */
  assignVendorDepositToAgency(
    pickupCode: string,
    agencyId: string
  ): { success: boolean; deposit?: VendorDeposit; message: string } {
    const deposit = vendorDepositCache.get(pickupCode);
    if (!deposit) return { success: false, message: 'Code retrait introuvable.' };
    if (deposit.status === 'COLLECTED') return { success: false, message: 'Ce colis a déjà été collecté.' };

    // Find agency name from in-memory cache or use id
    const agencies = Array.from(agencyMetaCache.entries());
    const agencyName = agencies.find(([id]) => id === agencyId)?.[1] as unknown as string || agencyId;

    const updated: VendorDeposit = {
      ...deposit,
      agencyId,
      agencyName: agencyName || agencyId,
      status: 'AGENCY_ASSIGNED',
    };
    vendorDepositCache.set(pickupCode, updated);
    return { success: true, deposit: updated, message: 'Agence assignée avec succès.' };
  }

  /** Mark a vendor deposit as collected by the driver. */
  markVendorDepositCollected(pickupCode: string): { success: boolean; message: string } {
    const deposit = vendorDepositCache.get(pickupCode);
    if (!deposit) return { success: false, message: 'Code retrait introuvable.' };

    vendorDepositCache.set(pickupCode, {
      ...deposit,
      status: 'COLLECTED',
      collectedAt: new Date().toISOString(),
    });
    return { success: true, message: 'Colis marqué comme collecté.' };
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
}

export const dataService = new DataService();
