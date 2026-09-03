/**
 * Moncolis Data & Database Service (Supabase Integrated)
 * Connects components to Supabase PostgreSQL.
 * Columns verified to exist in the live DB:
 *   packages: id, tracking_code, vendeur_id, agency_id, driver_id,
 *             client_name, client_address, client_phone, status,
 *             validation_code, created_at, updated_at
 */

import { supabase } from '@/utils/supabase/client';

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
  status: 'Créé' | "En attente d'agence" | 'Accepté' | 'En transit' | 'Livré' | 'Annulé';
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
  drivers: DriverAccount[];
}

export const DEFAULT_AGENCIES: AgencyInfo[] = [];

const mapStatusToApp = (dbStatus: string): ColisItem['status'] => {
  switch (dbStatus) {
    case 'CREATED': return 'Créé';
    case 'PENDING_AGENCY': return "En attente d'agence";
    case 'ACCEPTED_BY_AGENCY': return 'Accepté';
    case 'IN_TRANSIT':
    case 'ASSIGNED_TO_DRIVER':
      return 'En transit';
    case 'DELIVERED': return 'Livré';
    case 'CANCELLED': return 'Annulé';
    default: return 'Créé';
  }
};

// Maps a raw Supabase packages row to a ColisItem
// Only reads columns that actually exist in the DB.
function mapPackage(p: any): ColisItem {
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
    status: mapStatusToApp(p.status),
    agence: p.agency?.profile?.name || null,
    agencyId: p.agency_id,
    livreur: p.driver?.profile?.name || null,
    livreurPhone: p.driver?.phone || null,
    driverId: p.driver_id,
    otp: p.validation_code,
    date: new Date(p.created_at).toLocaleDateString('fr-FR'),
    confirmed: false,     // column does not exist in DB yet
    deliveredAt: null,    // column does not exist in DB yet
    paidByClient: p.paid_by_client !== undefined ? p.paid_by_client : true,
    isPrepaid: p.is_prepaid || false,
    deliveryPrice: p.delivery_price || 0,
    vendorPaid: p.vendor_paid || false,
  };
}

class DataService {

  // ── 1. Packages List ─────────────────────────────────────────
  async getAllPackages(): Promise<ColisItem[]> {
    const { data, error } = await supabase
      .from('packages')
      .select(`
        id, tracking_code, vendeur_id, agency_id, driver_id,
        client_name, client_address, client_phone,
        status, validation_code, created_at, updated_at,
        paid_by_client, delivery_price,
        agency:agencies(id, profile:profiles(name)),
        driver:drivers(id, phone, profile:profiles(name))
      `)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error fetching packages:', error);
      return [];
    }

    return data.map(mapPackage);
  }

  // ── 2. Get Single Package ─────────────
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
        agency:agencies(id, profile:profiles(name)),
        driver:drivers(id, phone, profile:profiles(name))
      `)
      .or(`id.eq.${cleanQuery},tracking_code.eq.${cleanQuery},validation_code.eq.${cleanQuery}`)
      .single();

    if (error || !data) return null;
    return mapPackage(data);
  }

  // ── 3. Create New Package ──────────────────────────
  async createPackage(p: { clientName: string, clientAddress: string, clientPhone: string, prixColis: number, poids: number, vendeurId: string, paidByClient: boolean, isPrepaid: boolean }): Promise<ColisItem> {
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

    const insertData = {
      tracking_code: trackCode,
      vendeur_id: vendeurId,
      client_name: p.clientName,
      client_phone: p.clientPhone,
      client_address: p.clientAddress,
      status: 'CREATED',
      validation_code: otp,
      paid_by_client: p.paidByClient,
      is_prepaid: p.isPrepaid,
      delivery_price: 0,
      package_price: p.prixColis,
    };

    const { data, error } = await supabase.from('packages').insert(insertData).select().single();
    if (error) throw error;

    return this.getPackageByTracking(data.id) as Promise<ColisItem>;
  }

  // ── 4. Assign Agency by ID (preferred) ──────────────────────
  async assignAgencyById(colisId: string, agencyId: string): Promise<void> {
    await supabase.from('packages').update({
      agency_id: agencyId,
      status: 'PENDING_AGENCY',
    }).eq('id', colisId);
  }

  // ── 4b. Assign Agency by name (fallback) ─────────────────────
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

  // ── 4c. Agency Package Actions ─────────────────────────────────
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

  // ── 5. Assign Driver ─────────────────────────────────────────
  async assignDriver(colisId: string, driverId: string): Promise<void> {
    await supabase.from('packages').update({
      driver_id: driverId,
      status: 'IN_TRANSIT',
    }).eq('id', colisId);
  }

  // ── 6. Validate Delivery ─────────────────────────────────────
  async validateDelivery(colisId: string): Promise<boolean> {
    const { error } = await supabase.from('packages').update({
      status: 'DELIVERED',
    }).eq('id', colisId);

    return !error;
  }

  // ── 6b. Vendor Payments ────────────────────────────────────────
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

  // ── 7. Get Deliveries for a Driver ───────────────────────────
  async getPackagesForDriver(driverQuery: string): Promise<ColisItem[]> {
    const pkgs = await this.getAllPackages();
    return pkgs.filter(p => p.driverId === driverQuery || p.livreur === driverQuery);
  }

  // ── 7.2 Get Packages for a specific Agency ────────────────────
  // Only returns packages that have been explicitly assigned to this agency.
  // Packages with status CREATED and no agency_id are NOT shown here.
  async getPackagesForAgency(agencyId: string): Promise<ColisItem[]> {
    const { data, error } = await supabase
      .from('packages')
      .select(`
        id, tracking_code, vendeur_id, agency_id, driver_id,
        client_name, client_address, client_phone,
        status, validation_code, created_at, updated_at,
        paid_by_client, delivery_price,
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

  // ── 7.5 Realtime Subscriptions ───────────────────────────────
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

  // ── 8. Agencies Management ───────────────────────────────────
  async getAgencies(): Promise<AgencyInfo[]> {
    const { data, error } = await supabase
      .from('agencies')
      .select(`
        id,
        address,
        phone,
        profile:profiles(name)
      `);

    if (error || !data) return [];

    return data.map((ag: any) => ({
      id: ag.id,
      name: ag.profile?.name || 'Agence Inconnue',
      phone: ag.phone || '',
      address: ag.address || '',
      score: 90,
      recommended: true,
      price: '1.5 USD',
      drivers: [],
    }));
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

  // ── 9. Driver Authentication ───────────────────────
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
}

export const dataService = new DataService();
