/**
 * Moncolis — Service Serveur Fulfillment & Stock (Fulfillment by Moncolis)
 * 
 * Centralise l'ensemble des règles métier strictes pour :
 * 1. La réservation atomique et la validation des espaces de stockage (Bug 2.1)
 * 2. L'inventaire produits, la cohérence des colonnes et RLS (Bug 2.2)
 * 3. La remise unique, conditionnelle et idempotente au livreur (Bug 2.3)
 * 4. La gestion du stock (on_hand, reserved, disponible) et décrémentation sur OTP
 */

import { supabaseAdmin } from '@/utils/supabase/admin';
import { supabase as supabaseAnon } from '@/utils/supabase/client';

const db = supabaseAdmin || supabaseAnon;

export interface ReserveSpaceParams {
  vendorId: string;
  storageSpaceId: string;
  slotsCount: number;
  months: number;
  notes?: string;
}

export interface ReviewSubscriptionParams {
  subscriptionId: string;
  agencyId: string;
  action: 'accept' | 'reject';
  reason?: string;
}

export interface HandoverParams {
  packageId: string;
  driverId: string;
  agencyId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  idempotencyKey?: string;
}

export interface CreateInventoryParams {
  vendorId: string;
  agencyId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  photoUrl?: string;
  category?: string;
  variant?: string;
  dimensions?: string;
  unitPrice?: number;
  unitCurrency?: 'USD' | 'CDF';
  initialQuantity?: number;
  lowStockThreshold?: number;
  weightKg?: number;
  shelfLocation?: string;
  storageSpaceId?: string;
  subscriptionId?: string;
}

export class FulfillmentService {
  /**
   * 1. Réservation atomique d'un espace de stockage (Bug 2.1)
   * Statut : disponible -> reserve -> PENDING
   */
  async reserveStorageSpace(params: ReserveSpaceParams) {
    const { vendorId, storageSpaceId, slotsCount, months, notes } = params;
    const slots = Math.max(1, slotsCount || 1);
    const numMonths = Math.max(1, months || 1);

    // Essayer via RPC PostgreSQL si disponible
    try {
      const { data: rpcRes, error: rpcErr } = await db.rpc('rpc_reserve_storage_space', {
        p_space_id: storageSpaceId,
        p_vendor_id: vendorId,
        p_slots: slots,
        p_months: numMonths,
        p_notes: notes || null,
      });

      if (!rpcErr && rpcRes) {
        return rpcRes;
      }
    } catch {
      // Fallback Node.js ci-dessous
    }

    // 1. Charger l'espace de stockage
    const { data: space, error: spaceErr } = await db
      .from('agency_storage_spaces')
      .select('*')
      .eq('id', storageSpaceId)
      .maybeSingle();

    if (spaceErr || !space) {
      return { success: false, error: 'Emplacement de stockage introuvable.' };
    }

    if (!space.is_active || (space.status && space.status !== 'disponible') || space.available_slots < slots) {
      return {
        success: false,
        error: `Cet emplacement n'est plus disponible (places restantes : ${space.available_slots || 0}).`,
      };
    }

    // 2. Vérifier si une souscription active ou en attente existe déjà
    const { data: existingSubs } = await db
      .from('vendor_storage_subscriptions')
      .select('id, status')
      .eq('storage_space_id', storageSpaceId)
      .in('status', ['PENDING', 'ACTIVE']);

    if (existingSubs && existingSubs.length > 0) {
      return {
        success: false,
        error: 'Cet emplacement fait déjà l’objet d’une demande ou d’une location en cours.',
      };
    }

    const pricePerMonth = Number(space.price_per_month || 0);
    const totalPrice = pricePerMonth * slots * numMonths;
    const now = new Date();
    const startDate = now.toISOString();
    const endDate = new Date(now.getTime() + numMonths * 30 * 24 * 3600 * 1000).toISOString();
    const expiresAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

    // 3. Mise à jour conditionnelle atomique de l'espace
    const newAvailable = Math.max(0, space.available_slots - slots);
    const newStatus = newAvailable === 0 ? 'reserve' : 'disponible';

    const { data: updatedSpace, error: updSpaceErr } = await db
      .from('agency_storage_spaces')
      .update({
        available_slots: newAvailable,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storageSpaceId)
      .gte('available_slots', slots)
      .select()
      .maybeSingle();

    if (updSpaceErr || !updatedSpace) {
      return {
        success: false,
        error: 'Conflit de réservation : l’emplacement vient d’être réservé par un autre utilisateur.',
      };
    }

    // 4. Insérer la souscription avec le statut PENDING (et NON ACTIVE)
    const { data: newSub, error: subErr } = await db
      .from('vendor_storage_subscriptions')
      .insert({
        vendor_id: vendorId,
        agency_id: space.agency_id,
        storage_space_id: space.id,
        slots_count: slots,
        price_paid: totalPrice,
        currency: space.currency || 'USD',
        status: 'PENDING',
        start_date: startDate,
        end_date: endDate,
        expires_at: expiresAt,
        notes: notes || `Demande de ${slots} emplacement(s) sur ${numMonths} mois.`,
        created_at: startDate,
        updated_at: startDate,
      })
      .select()
      .single();

    if (subErr) {
      // Rollback de la place en cas d'échec d'insertion
      await db
        .from('agency_storage_spaces')
        .update({
          available_slots: space.available_slots,
          status: space.status || 'disponible',
        })
        .eq('id', storageSpaceId);

      return { success: false, error: subErr.message };
    }

    // 5. Notifier l'agence de la nouvelle demande
    try {
      await db.from('notifications').insert({
        user_id: space.agency_id,
        title: 'Nouvelle demande de location d’emplacement',
        message: `Un vendeur souhaite louer ${slots} emplacement(s) (${space.name}). Veuillez accepter ou décliner.`,
        type: 'INFO',
        created_at: startDate,
      });
    } catch {}

    return {
      success: true,
      subscription: newSub,
      message: 'Demande envoyée à l’agence avec succès. L’emplacement est réservé pour 48h en attente d’acceptation.',
    };
  }

  /**
   * Validation ou refus de la souscription par l'agence (Bug 2.1)
   */
  async reviewSubscription(params: ReviewSubscriptionParams) {
    const { subscriptionId, agencyId, action, reason } = params;

    try {
      const { data: rpcRes, error: rpcErr } = await db.rpc('rpc_review_storage_subscription', {
        p_subscription_id: subscriptionId,
        p_agency_id: agencyId,
        p_action: action,
        p_reason: reason || null,
      });

      if (!rpcErr && rpcRes) {
        return rpcRes;
      }
    } catch {
      // Fallback Node.js
    }

    const { data: sub, error: subErr } = await db
      .from('vendor_storage_subscriptions')
      .select('*, space:agency_storage_spaces(*)')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subErr || !sub) {
      return { success: false, error: 'Abonnement introuvable.' };
    }

    if (sub.agency_id !== agencyId) {
      return { success: false, error: 'Non autorisé pour votre agence.' };
    }

    if (sub.status !== 'PENDING') {
      return { success: false, error: `Cette demande est déjà ${sub.status}.` };
    }

    const nowIso = new Date().toISOString();

    if (action === 'accept') {
      await db
        .from('vendor_storage_subscriptions')
        .update({
          status: 'ACTIVE',
          start_date: nowIso,
          updated_at: nowIso,
        })
        .eq('id', subscriptionId);

      await db
        .from('agency_storage_spaces')
        .update({
          status: 'loue',
          updated_at: nowIso,
        })
        .eq('id', sub.storage_space_id);

      // Notifier le vendeur
      await db.from('notifications').insert({
        user_id: sub.vendor_id,
        title: 'Demande de location acceptée !',
        message: `L'agence a validé votre location pour "${sub.space?.name || 'votre emplacement'}". Vous pouvez dès maintenant gérer votre stock.`,
        type: 'SUCCESS',
        created_at: nowIso,
      });

      return { success: true, message: 'Location acceptée. Espace actif pour le vendeur.' };
    } else {
      // Refus
      await db
        .from('vendor_storage_subscriptions')
        .update({
          status: 'REJECTED',
          rejection_reason: reason || 'Refusé par l’agence',
          updated_at: nowIso,
        })
        .eq('id', subscriptionId);

      // Restaurer les places de l'espace
      if (sub.space) {
        const restoredSlots = (sub.space.available_slots || 0) + (sub.slots_count || 1);
        await db
          .from('agency_storage_spaces')
          .update({
            available_slots: restoredSlots,
            status: 'disponible',
            updated_at: nowIso,
          })
          .eq('id', sub.storage_space_id);
      }

      await db.from('notifications').insert({
        user_id: sub.vendor_id,
        title: 'Demande de location déclinée',
        message: `L'agence a décliné votre demande de location : "${reason || 'Emplacement non disponible'}".`,
        type: 'WARNING',
        created_at: nowIso,
      });

      return { success: true, message: 'Demande déclinée. L’emplacement est à nouveau disponible.' };
    }
  }

  /**
   * Expiration automatique des réservations PENDING après 48h
   */
  async expireOldReservations() {
    try {
      const { data, error } = await db.rpc('rpc_expire_storage_reservations');
      if (!error && typeof data === 'number') return data;
    } catch {}

    const nowIso = new Date().toISOString();
    const { data: expiredSubs } = await db
      .from('vendor_storage_subscriptions')
      .select('*, space:agency_storage_spaces(*)')
      .eq('status', 'PENDING')
      .lt('expires_at', nowIso);

    if (!expiredSubs || expiredSubs.length === 0) return 0;

    let count = 0;
    for (const sub of expiredSubs) {
      await db
        .from('vendor_storage_subscriptions')
        .update({ status: 'EXPIRED', updated_at: nowIso })
        .eq('id', sub.id);

      if (sub.space) {
        await db
          .from('agency_storage_spaces')
          .update({
            available_slots: (sub.space.available_slots || 0) + (sub.slots_count || 1),
            status: 'disponible',
            updated_at: nowIso,
          })
          .eq('id', sub.storage_space_id);
      }

      try {
        await db.from('notifications').insert({
          user_id: sub.vendor_id,
          title: 'Réservation de stockage expirée',
          message: 'Votre réservation sans validation d’agence a expiré. L’emplacement a été remis en disponibilité.',
          type: 'INFO',
          created_at: nowIso,
        });
      } catch {}
      count++;
    }

    return count;
  }

  /**
   * Génération automatique de SKU unique : PRÉFIXE-NOM-0001
   */
  async generateUniqueSku(vendorIdOrName: string, maybeProductName?: string): Promise<string> {
    const productName = maybeProductName !== undefined ? maybeProductName : vendorIdOrName;
    const vendorId = maybeProductName !== undefined ? vendorIdOrName : '';

    const cleanName = (productName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'PROD';

    const prefix = 'MC';

    let count = 0;
    if (vendorId) {
      try {
        const { count: dbCount } = await db
          .from('warehouse_inventory')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId);
        count = dbCount || 0;
      } catch {}
    }

    const seq = ((count || 0) + 1).toString().padStart(4, '0');
    let candidate = `${prefix}-${cleanName}-${seq}`;

    // Vérifier l'unicité
    if (vendorId) {
      try {
        const { data: existing } = await db
          .from('warehouse_inventory')
          .select('id')
          .eq('vendor_id', vendorId)
          .eq('sku', candidate)
          .maybeSingle();

        if (existing) {
          const rand = Math.floor(1000 + Math.random() * 9000);
          candidate = `${prefix}-${cleanName}-${rand}`;
        }
      } catch {}
    }

    return candidate;
  }

  /**
   * Vérifier l'existence d'un SKU pour un vendeur
   */
  async checkSkuExists(vendorId: string, sku: string) {
    if (!sku?.trim()) return null;
    const { data } = await db
      .from('warehouse_inventory')
      .select('id, product_name, quantity_in_stock, quantity_reserved, unit_price')
      .eq('vendor_id', vendorId)
      .eq('sku', sku.trim())
      .eq('is_active', true)
      .maybeSingle();

    return data || null;
  }

  /**
   * 2. Création d'un article en stock avec vérification de location active (Bug 2.2)
   */
  async createInventoryItem(params: CreateInventoryParams) {
    const {
      vendorId,
      agencyId,
      productName,
      sku,
      barcode,
      photoUrl,
      category,
      variant,
      dimensions,
      unitPrice,
      unitCurrency,
      initialQuantity,
      lowStockThreshold,
      weightKg,
      shelfLocation,
      storageSpaceId,
      subscriptionId,
    } = params;

    if (!vendorId || !agencyId || !productName?.trim()) {
      return { success: false, error: 'Vendeur, agence et nom de produit obligatoires.' };
    }

    // VÉRIFICATION STRICTE : Le vendeur doit posséder une location ACTIVE auprès de cette agence
    const { data: activeSubs, error: subCheckErr } = await db
      .from('vendor_storage_subscriptions')
      .select('id, storage_space_id')
      .eq('vendor_id', vendorId)
      .eq('agency_id', agencyId)
      .eq('status', 'ACTIVE')
      .limit(1);

    if (subCheckErr || !activeSubs || activeSubs.length === 0) {
      return {
        success: false,
        error: 'Accès refusé : vous devez avoir une location d’emplacement acceptée et active auprès de cette agence pour y enregistrer des articles.',
      };
    }

    const assignedSubId = subscriptionId || activeSubs[0].id;
    const assignedSpaceId = storageSpaceId || activeSubs[0].storage_space_id;

    // Vérifier l'unicité du SKU s'il est fourni
    if (sku?.trim()) {
      const existing = await this.checkSkuExists(vendorId, sku.trim());
      if (existing) {
        return {
          success: false,
          skuExists: true,
          existingItem: existing,
          error: `Le SKU "${sku}" existe déjà pour l’article "${existing.product_name}".`,
        };
      }
    }

    const initialQty = Math.max(0, initialQuantity || 0);
    const threshold = Math.max(1, lowStockThreshold ?? 5);

    // INSERTION AVEC NOM DE COLONNE EXACT (low_stock_threshold)
    const { data: created, error: insertErr } = await db
      .from('warehouse_inventory')
      .insert({
        vendor_id: vendorId,
        agency_id: agencyId,
        storage_space_id: assignedSpaceId,
        subscription_id: assignedSubId,
        product_name: productName.trim(),
        sku: sku?.trim() || null,
        barcode: barcode?.trim() || null,
        photo_url: photoUrl?.trim() || null,
        category: category?.trim() || 'Général',
        variant: variant?.trim() || null,
        dimensions: dimensions?.trim() || null,
        unit_price: unitPrice || 0,
        unit_currency: unitCurrency === 'CDF' ? 'CDF' : 'USD',
        quantity_in_stock: initialQty,
        quantity_reserved: 0,
        shelf_location: shelfLocation?.trim() || 'Rayon A',
        low_stock_threshold: threshold,
        weight_kg: weightKg || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertErr || !created) {
      console.error('[createInventoryItem] Erreur insertion base:', insertErr);
      return { success: false, error: insertErr?.message || 'Erreur lors de l’enregistrement de l’article.' };
    }

    // Si stock initial > 0, consigner le mouvement DEPOSIT
    if (initialQty > 0) {
      try {
        await db.from('warehouse_stock_movements').insert({
          inventory_id: created.id,
          agency_id: agencyId,
          vendor_id: vendorId,
          type: 'DEPOSIT',
          quantity: initialQty,
          previous_stock: 0,
          new_stock: initialQty,
          performed_by: 'Vendeur',
          notes: 'Stock initial à la création du produit',
        });
      } catch (movErr) {
        console.warn('[createInventoryItem] Mouvement DEPOSIT non consigné:', movErr);
      }
    }

    return {
      success: true,
      item: created,
      message: 'Article créé et enregistré en stock avec succès.',
    };
  }

  /**
   * 3. Remise unique, conditionnelle et idempotente au livreur (Bug 2.3)
   * Utilisé par TOUS les écrans (Entrepôt et Gestion de colis).
   */
  async executePackageHandover(params: HandoverParams) {
    const { packageId, driverId, agencyId, actorId, actorName, actorRole, idempotencyKey } = params;

    // 1. Essai via RPC PostgreSQL
    try {
      const { data: rpcRes, error: rpcErr } = await db.rpc('rpc_handover_package_to_driver', {
        p_package_id: packageId,
        p_driver_id: driverId,
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_actor_role: actorRole,
        p_idempotency_key: idempotencyKey || null,
      });

      if (!rpcErr && rpcRes) {
        return rpcRes;
      }
    } catch {
      // Fallback Node.js
    }

    // 2. Vérification d'idempotence
    if (idempotencyKey) {
      const { data: existingAudit } = await db
        .from('package_audit_logs')
        .select('id, to_status, created_at')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingAudit) {
        return {
          success: true,
          idempotent: true,
          message: 'Remise déjà confirmée (idempotence respectée).',
        };
      }
    }

    // 3. Charger le colis
    const { data: pkg, error: pkgErr } = await db
      .from('packages')
      .select('id, tracking_code, short_code, status, agency_id, driver_id, updated_at, warehouse_inventory_id, warehouse_quantity')
      .eq('id', packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return { success: false, error: 'Colis introuvable.' };
    }

    // Vérifier si déjà remis au livreur
    if (pkg.driver_id) {
      const { data: drv } = await db
        .from('profiles')
        .select('name')
        .eq('id', pkg.driver_id)
        .maybeSingle();

      const driverName = drv?.name || 'un livreur';
      const formattedDate = pkg.updated_at ? new Date(pkg.updated_at).toLocaleString('fr-FR') : 'une date antérieure';
      return {
        success: false,
        error: `Ce colis a déjà été remis à ${driverName} le ${formattedDate}.`,
      };
    }

    // Vérifier l'état éligible
    const eligibleStatuses = ['ACCEPTED_BY_AGENCY', 'WAITING_FOR_AGENCY_PICKUP', 'CREATED'];
    if (!eligibleStatuses.includes(pkg.status)) {
      return {
        success: false,
        error: `Ce colis ne peut pas être remis dans son état actuel (${pkg.status}).`,
      };
    }

    // 4. Charger les données du livreur
    const { data: driverProfile } = await db
      .from('profiles')
      .select('name')
      .eq('id', driverId)
      .maybeSingle();
    const driverName = driverProfile?.name || 'Livreur';

    const nowIso = new Date().toISOString();

    // 5. Mise à jour conditionnelle stricte (WHERE id = X AND driver_id IS NULL)
    const { data: updatedPkg, error: updErr } = await db
      .from('packages')
      .update({
        driver_id: driverId,
        agency_id: agencyId || pkg.agency_id,
        status: 'ASSIGNED_TO_DRIVER',
        updated_at: nowIso,
      })
      .eq('id', packageId)
      .is('driver_id', null)
      .select()
      .maybeSingle();

    if (updErr || !updatedPkg) {
      return {
        success: false,
        error: 'Conflit : ce colis a été assigné en parallèle par un autre utilisateur.',
      };
    }

    // 6. Journaliser dans package_audit_logs dans la même opération
    await db.from('package_audit_logs').insert({
      package_id: packageId,
      package_code: pkg.tracking_code || pkg.short_code,
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      from_status: pkg.status,
      to_status: 'ASSIGNED_TO_DRIVER',
      action: 'HANDOVER_TO_DRIVER',
      reason: `Remise du colis au livreur ${driverName}`,
      idempotency_key: idempotencyKey || null,
      metadata: { driver_id: driverId, driver_name: driverName },
      created_at: nowIso,
    });

    // 7. Notifier le livreur
    try {
      await db.from('notifications').insert({
        user_id: driverId,
        title: '📦 Colis remis pour livraison',
        message: `Le colis ${pkg.tracking_code || pkg.short_code || ''} vous a été remis par l’agence. Course active !`,
        type: 'PACKAGE_HANDOVER',
        created_at: nowIso,
      });
    } catch {}

    return {
      success: true,
      package: updatedPkg,
      message: `Colis remis avec succès au livreur ${driverName}.`,
    };
  }

  /**
   * 4. RÈGLE DE STOCK : Décrémentation physique STRICTEMENT lors de la validation réussie de l'OTP
   */
  async handleOtpValidationStockDeduction(packageId: string) {
    const { data: pkg } = await db
      .from('packages')
      .select('id, warehouse_inventory_id, warehouse_quantity, agency_id, vendeur_id')
      .eq('id', packageId)
      .maybeSingle();

    if (!pkg?.warehouse_inventory_id) {
      return { handled: false, reason: 'Pas un colis fulfillment' };
    }

    const qty = Math.max(1, pkg.warehouse_quantity || 1);
    const invId = pkg.warehouse_inventory_id;

    // Charger l'inventaire actuel
    const { data: inv } = await db
      .from('warehouse_inventory')
      .select('*')
      .eq('id', invId)
      .maybeSingle();

    if (!inv) return { handled: false, error: 'Article inventaire introuvable' };

    const currentStock = Number(inv.quantity_in_stock || 0);
    const currentReserved = Number(inv.quantity_reserved || 0);

    const newStock = Math.max(0, currentStock - qty);
    const newReserved = Math.max(0, currentReserved - qty);

    // Décrémentation physique
    await db
      .from('warehouse_inventory')
      .update({
        quantity_in_stock: newStock,
        quantity_reserved: newReserved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invId);

    // Inscription du mouvement DELIVERED
    try {
      await db.from('warehouse_stock_movements').insert({
        inventory_id: invId,
        agency_id: inv.agency_id,
        vendor_id: inv.vendor_id,
        package_id: packageId,
        type: 'DELIVERED',
        quantity: -qty,
        previous_stock: currentStock,
        new_stock: newStock,
        performed_by: 'Système (Validation OTP Client)',
        notes: `Décrémentation physique après validation OTP du colis ${packageId}`,
      });
    } catch (e) {
      console.warn('[handleOtpValidationStockDeduction] Mouvement DELIVERED déjà enregistré ou contrainte respectée');
    }

    return { handled: true, newStock, newReserved };
  }

  /**
   * Libération de la réservation en cas d'annulation ou refus
   */
  async handlePackageStockRelease(packageId: string, reason?: string) {
    const { data: pkg } = await db
      .from('packages')
      .select('id, warehouse_inventory_id, warehouse_quantity')
      .eq('id', packageId)
      .maybeSingle();

    if (!pkg?.warehouse_inventory_id) return { handled: false };

    const qty = Math.max(1, pkg.warehouse_quantity || 1);
    const invId = pkg.warehouse_inventory_id;

    const { data: inv } = await db
      .from('warehouse_inventory')
      .select('*')
      .eq('id', invId)
      .maybeSingle();

    if (!inv) return { handled: false };

    const curReserved = Number(inv.quantity_reserved || 0);
    const newReserved = Math.max(0, curReserved - qty);

    await db
      .from('warehouse_inventory')
      .update({
        quantity_reserved: newReserved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invId);

    try {
      await db.from('warehouse_stock_movements').insert({
        inventory_id: invId,
        agency_id: inv.agency_id,
        vendor_id: inv.vendor_id,
        package_id: packageId,
        type: 'RELEASE',
        quantity: qty,
        previous_stock: inv.quantity_in_stock,
        new_stock: inv.quantity_in_stock,
        performed_by: 'Système',
        notes: `Libération de réservation : ${reason || 'Colis annulé ou refusé'}`,
      });
    } catch {}

    return { handled: true, newReserved };
  }
}

export const fulfillmentService = new FulfillmentService();

