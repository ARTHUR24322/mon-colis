-- =====================================================================
-- Moncolis — Migration Fulfillment, Stock & Cohérence v2
-- Sauvegarde préalable automatique & Contraintes strictes
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. SAUVEGARDE PRÉALABLE AUTOMATIQUE DES DONNÉES EXISTANTES
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_storage_spaces') THEN
    CREATE TABLE IF NOT EXISTS public.backup_agency_storage_spaces_v1 AS 
    SELECT *, timezone('utc', now()) AS backed_up_at FROM public.agency_storage_spaces;
    RAISE NOTICE '✅ Sauvegarde effectuée : backup_agency_storage_spaces_v1';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_storage_subscriptions') THEN
    CREATE TABLE IF NOT EXISTS public.backup_vendor_storage_subscriptions_v1 AS 
    SELECT *, timezone('utc', now()) AS backed_up_at FROM public.vendor_storage_subscriptions;
    RAISE NOTICE '✅ Sauvegarde effectuée : backup_vendor_storage_subscriptions_v1';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouse_inventory') THEN
    CREATE TABLE IF NOT EXISTS public.backup_warehouse_inventory_v1 AS 
    SELECT *, timezone('utc', now()) AS backed_up_at FROM public.warehouse_inventory;
    RAISE NOTICE '✅ Sauvegarde effectuée : backup_warehouse_inventory_v1';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouse_stock_movements') THEN
    CREATE TABLE IF NOT EXISTS public.backup_warehouse_stock_movements_v1 AS 
    SELECT *, timezone('utc', now()) AS backed_up_at FROM public.warehouse_stock_movements;
    RAISE NOTICE '✅ Sauvegarde effectuée : backup_warehouse_stock_movements_v1';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 2. ESPACES DE STOCKAGE (agency_storage_spaces)
-- Statuts : disponible, reserve, loue, retire
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.agency_storage_spaces 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS surface_m2 NUMERIC(8, 2) DEFAULT 1.0;

-- Contrainte de statuts stricts
ALTER TABLE public.agency_storage_spaces 
  DROP CONSTRAINT IF EXISTS chk_agency_storage_spaces_status;

ALTER TABLE public.agency_storage_spaces 
  ADD CONSTRAINT chk_agency_storage_spaces_status 
  CHECK (status IN ('disponible', 'reserve', 'loue', 'retire'));

-- Rétrocompatibilité : initialiser status selon les places disponibles
UPDATE public.agency_storage_spaces
SET status = CASE 
  WHEN is_active = false THEN 'retire'
  WHEN available_slots <= 0 THEN 'loue'
  ELSE 'disponible'
END
WHERE status = 'disponible' AND (is_active = false OR available_slots <= 0);

CREATE INDEX IF NOT EXISTS idx_agency_storage_spaces_status ON public.agency_storage_spaces(status);


-- ─────────────────────────────────────────────────────────────────────
-- 3. ABONNEMENTS / LOCATIONS (vendor_storage_subscriptions)
-- Statuts : PENDING, ACTIVE, REJECTED, EXPIRED, CANCELLED
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.vendor_storage_subscriptions 
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now() + INTERVAL '48 hours');

-- Mise à jour de la contrainte CHECK sur status
ALTER TABLE public.vendor_storage_subscriptions 
  DROP CONSTRAINT IF EXISTS vendor_storage_subscriptions_status_check;

ALTER TABLE public.vendor_storage_subscriptions 
  ADD CONSTRAINT vendor_storage_subscriptions_status_check 
  CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'CANCELLED'));

-- Contrainte d'unicité partielle : au plus une location active ou en attente par emplacement
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_subs_unique_active_or_pending 
  ON public.vendor_storage_subscriptions(storage_space_id) 
  WHERE status IN ('PENDING', 'ACTIVE');


-- ─────────────────────────────────────────────────────────────────────
-- 4. INVENTAIRE ENTREPÔT (warehouse_inventory)
-- Champs étendus, unicité SKU par vendeur, contraintes de stock
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.warehouse_inventory 
  ADD COLUMN IF NOT EXISTS variant TEXT,
  ADD COLUMN IF NOT EXISTS dimensions TEXT;

-- Contraintes CHECK strictes pour le stock
ALTER TABLE public.warehouse_inventory 
  DROP CONSTRAINT IF EXISTS chk_inventory_stock_non_negative;
ALTER TABLE public.warehouse_inventory 
  ADD CONSTRAINT chk_inventory_stock_non_negative 
  CHECK (quantity_in_stock >= 0);

ALTER TABLE public.warehouse_inventory 
  DROP CONSTRAINT IF EXISTS chk_inventory_reserved_non_negative;
ALTER TABLE public.warehouse_inventory 
  ADD CONSTRAINT chk_inventory_reserved_non_negative 
  CHECK (quantity_reserved >= 0);

ALTER TABLE public.warehouse_inventory 
  DROP CONSTRAINT IF EXISTS chk_inventory_reserved_lte_stock;
ALTER TABLE public.warehouse_inventory 
  ADD CONSTRAINT chk_inventory_reserved_lte_stock 
  CHECK (quantity_reserved <= quantity_in_stock);

-- Contrainte d'unicité (vendor_id, sku) pour éviter les doublons de référence chez un même vendeur
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_inv_vendor_sku_unique 
  ON public.warehouse_inventory(vendor_id, sku) 
  WHERE sku IS NOT NULL AND is_active = true;


-- ─────────────────────────────────────────────────────────────────────
-- 5. JOURNAL DES MOUVEMENTS DE STOCK (warehouse_stock_movements)
-- Mouvements autorisés, unicité colis/produit, immuabilité
-- ─────────────────────────────────────────────────────────────────────

-- Contrainte de type de mouvement étendu
ALTER TABLE public.warehouse_stock_movements 
  DROP CONSTRAINT IF EXISTS warehouse_stock_movements_type_check;

ALTER TABLE public.warehouse_stock_movements 
  ADD CONSTRAINT warehouse_stock_movements_type_check 
  CHECK (type IN ('RESERVE', 'RELEASE', 'DELIVERED', 'RETURN_IN', 'ADJUST', 'DEPOSIT', 'DISPATCH', 'TRANSFER'));

-- Unicité stricte sur (package_id, inventory_id, type) pour RESERVE et DELIVERED
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_mov_unique_reserve 
  ON public.warehouse_stock_movements (package_id, inventory_id, type) 
  WHERE type = 'RESERVE' AND package_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_mov_unique_delivered 
  ON public.warehouse_stock_movements (package_id, inventory_id, type) 
  WHERE type = 'DELIVERED' AND package_id IS NOT NULL;

-- Immuabilité stricte du journal de stock (aucun UPDATE ni DELETE)
CREATE OR REPLACE FUNCTION prevent_warehouse_stock_movements_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table warehouse_stock_movements est STRICTEMENT IMMUABLE : aucune modification (UPDATE) ni suppression (DELETE) n''est autorisée.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_warehouse_stock_movements ON public.warehouse_stock_movements;
CREATE TRIGGER trg_immutable_warehouse_stock_movements
BEFORE UPDATE OR DELETE ON public.warehouse_stock_movements
FOR EACH ROW EXECUTE FUNCTION prevent_warehouse_stock_movements_tampering();


-- ─────────────────────────────────────────────────────────────────────
-- 6. COLIS (packages)
-- Ajout des champs d'entrepôt et contrainte anti-doublon de remise
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.packages 
  ADD COLUMN IF NOT EXISTS warehouse_inventory_id UUID REFERENCES public.warehouse_inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_quantity INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_packages_warehouse_inv ON public.packages(warehouse_inventory_id);


-- ─────────────────────────────────────────────────────────────────────
-- 7. FONCTIONS TRANSACTIONNELLES SERVEUR (Supabase RPC)
-- ─────────────────────────────────────────────────────────────────────

-- 7.1 Réservation atomique d'un espace de stockage
CREATE OR REPLACE FUNCTION public.rpc_reserve_storage_space(
  p_space_id UUID,
  p_vendor_id UUID,
  p_slots INT,
  p_months INT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_space RECORD;
  v_total_price NUMERIC(12, 2);
  v_sub RECORD;
  v_now TIMESTAMP WITH TIME ZONE := timezone('utc', now());
  v_expires TIMESTAMP WITH TIME ZONE := v_now + INTERVAL '48 hours';
BEGIN
  -- Verrouillage de la ligne de l'emplacement
  SELECT * INTO v_space
  FROM public.agency_storage_spaces
  WHERE id = p_space_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Emplacement de stockage introuvable.');
  END IF;

  IF v_space.status != 'disponible' OR v_space.available_slots < p_slots OR v_space.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cet emplacement n''est plus disponible à la location.');
  END IF;

  -- Vérifier qu'il n'y a pas déjà une souscription active ou en attente pour cet espace
  IF EXISTS (
    SELECT 1 FROM public.vendor_storage_subscriptions
    WHERE storage_space_id = p_space_id AND status IN ('PENDING', 'ACTIVE')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cet emplacement fait déjà l''objet d''une demande en cours ou d''une location active.');
  END IF;

  v_total_price := (v_space.price_per_month * p_slots * p_months);

  -- 1. Insérer la souscription en attente (PENDING)
  INSERT INTO public.vendor_storage_subscriptions (
    vendor_id,
    agency_id,
    storage_space_id,
    slots_count,
    price_paid,
    currency,
    status,
    start_date,
    end_date,
    expires_at,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_vendor_id,
    v_space.agency_id,
    p_space_id,
    p_slots,
    v_total_price,
    v_space.currency,
    'PENDING',
    v_now,
    v_now + (p_months * INTERVAL '30 days'),
    v_expires,
    COALESCE(p_notes, 'Demande de location en attente d''acceptation agence'),
    v_now,
    v_now
  ) RETURNING * INTO v_sub;

  -- 2. Marquer l'emplacement comme réservé
  UPDATE public.agency_storage_spaces
  SET 
    status = 'reserve',
    available_slots = GREATEST(0, available_slots - p_slots),
    updated_at = v_now
  WHERE id = p_space_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub.id,
    'status', 'PENDING',
    'expires_at', v_expires,
    'message', 'Demande enregistrée. En attente de validation par l''agence.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7.2 Acceptation ou refus de la location par l'agence
CREATE OR REPLACE FUNCTION public.rpc_review_storage_subscription(
  p_subscription_id UUID,
  p_agency_id UUID,
  p_action TEXT, -- 'accept' ou 'reject'
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sub RECORD;
  v_now TIMESTAMP WITH TIME ZONE := timezone('utc', now());
BEGIN
  SELECT * INTO v_sub
  FROM public.vendor_storage_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Abonnement introuvable.');
  END IF;

  IF v_sub.agency_id != p_agency_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé : cet abonnement ne concerne pas votre agence.');
  END IF;

  IF v_sub.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette demande a déjà été traitée (statut : ' || v_sub.status || ').');
  END IF;

  IF p_action = 'accept' THEN
    -- Valider la location : ACTIVE et l'espace passe à 'loue'
    UPDATE public.vendor_storage_subscriptions
    SET 
      status = 'ACTIVE',
      start_date = v_now,
      updated_at = v_now
    WHERE id = p_subscription_id;

    UPDATE public.agency_storage_spaces
    SET 
      status = 'loue',
      updated_at = v_now
    WHERE id = v_sub.storage_space_id;

    RETURN jsonb_build_object('success', true, 'status', 'ACTIVE', 'message', 'Location acceptée avec succès.');

  ELSIF p_action = 'reject' THEN
    -- Refuser la location : REJECTED, libérer l'espace et restaurer les slots
    UPDATE public.vendor_storage_subscriptions
    SET 
      status = 'REJECTED',
      rejection_reason = p_reason,
      updated_at = v_now
    WHERE id = p_subscription_id;

    UPDATE public.agency_storage_spaces
    SET 
      status = 'disponible',
      available_slots = available_slots + v_sub.slots_count,
      updated_at = v_now
    WHERE id = v_sub.storage_space_id;

    RETURN jsonb_build_object('success', true, 'status', 'REJECTED', 'message', 'Demande refusée. L''emplacement est de nouveau disponible.');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Action non reconnue (accept ou reject attendu).');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7.3 Expiration automatique des réservations en souffrance
CREATE OR REPLACE FUNCTION public.rpc_expire_storage_reservations()
RETURNS INT AS $$
DECLARE
  v_expired_count INT := 0;
  v_rec RECORD;
  v_now TIMESTAMP WITH TIME ZONE := timezone('utc', now());
BEGIN
  FOR v_rec IN 
    SELECT id, storage_space_id, slots_count, vendor_id, agency_id
    FROM public.vendor_storage_subscriptions
    WHERE status = 'PENDING' AND (expires_at IS NOT NULL AND expires_at < v_now)
    FOR UPDATE
  LOOP
    -- Passer la souscription en EXPIRED
    UPDATE public.vendor_storage_subscriptions
    SET 
      status = 'EXPIRED',
      updated_at = v_now
    WHERE id = v_rec.id;

    -- Remettre l'emplacement à disponible
    UPDATE public.agency_storage_spaces
    SET 
      status = 'disponible',
      available_slots = available_slots + v_rec.slots_count,
      updated_at = v_now
    WHERE id = v_rec.storage_space_id;

    -- Notifier le vendeur
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      created_at
    ) VALUES (
      v_rec.vendor_id,
      'Réservation d''emplacement expirée',
      'Votre demande de réservation d''emplacement a expiré après 48h sans validation de l''agence. L''emplacement a été libéré.',
      'WARNING',
      v_now
    );

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7.4 Remise unique au livreur (Handover unifié & idempotent)
CREATE OR REPLACE FUNCTION public.rpc_handover_package_to_driver(
  p_package_id UUID,
  p_driver_id UUID,
  p_actor_id UUID,
  p_actor_name TEXT,
  p_actor_role TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_pkg RECORD;
  v_driver RECORD;
  v_existing_audit RECORD;
  v_now TIMESTAMP WITH TIME ZONE := timezone('utc', now());
  v_now_iso TEXT := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  -- 1. Idempotence par clé
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT * INTO v_existing_audit
    FROM public.package_audit_logs
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'message', 'Action déjà traitée avec succès (idempotence respectée).'
      );
    END IF;
  END IF;

  -- 2. Verrouillage du colis
  SELECT * INTO v_pkg
  FROM public.packages
  WHERE id = p_package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable.');
  END IF;

  -- Si déjà remis ou déjà assigné à ce livreur ou un autre
  IF v_pkg.driver_id IS NOT NULL THEN
    -- Récupérer le nom du livreur existant
    SELECT p.name INTO v_driver
    FROM public.drivers d
    JOIN public.profiles p ON p.id = d.id
    WHERE d.id = v_pkg.driver_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce colis a déjà été remis à ' || COALESCE(v_driver.name, 'un livreur') || ' le ' || to_char(v_pkg.updated_at, 'DD/MM/YYYY à HH24:MI') || '.'
    );
  END IF;

  -- Vérifier l'état éligible
  IF v_pkg.status NOT IN ('ACCEPTED_BY_AGENCY', 'WAITING_FOR_AGENCY_PICKUP', 'CREATED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce colis n''est pas prêt à être remis (statut actuel : ' || v_pkg.status || ').'
    );
  END IF;

  -- 3. Vérifier le livreur
  SELECT d.id, p.name INTO v_driver
  FROM public.drivers d
  JOIN public.profiles p ON p.id = d.id
  WHERE d.id = p_driver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livreur spécifié introuvable.');
  END IF;

  -- 4. Mise à jour conditionnelle de packages
  UPDATE public.packages
  SET 
    driver_id = p_driver_id,
    status = 'ASSIGNED_TO_DRIVER',
    updated_at = v_now
  WHERE id = p_package_id
    AND driver_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conflit de concurrence : le colis a été assigné par un autre utilisateur.');
  END IF;

  -- 5. Journal d'audit dans la même transaction
  INSERT INTO public.package_audit_logs (
    package_id,
    package_code,
    actor_id,
    actor_name,
    actor_role,
    from_status,
    to_status,
    action,
    reason,
    idempotency_key,
    metadata,
    created_at
  ) VALUES (
    p_package_id,
    COALESCE(v_pkg.tracking_code, v_pkg.short_code),
    p_actor_id,
    p_actor_name,
    p_actor_role,
    v_pkg.status,
    'ASSIGNED_TO_DRIVER',
    'HANDOVER_TO_DRIVER',
    'Remise officielle du colis au livreur ' || v_driver.name,
    p_idempotency_key,
    jsonb_build_object('driver_id', p_driver_id, 'driver_name', v_driver.name),
    v_now
  );

  -- 6. Notification au livreur
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    created_at
  ) VALUES (
    p_driver_id,
    '📦 Colis remis pour livraison',
    'Le colis ' || COALESCE(v_pkg.tracking_code, v_pkg.short_code, 'MC') || ' vous a été remis pour livraison directe.',
    'SUCCESS',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'driver_name', v_driver.name,
    'status', 'ASSIGNED_TO_DRIVER',
    'message', 'Colis remis avec succès au livreur ' || v_driver.name || '.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────
-- 8. POLITIQUES RLS ÉTENDUES POUR LE FULFILLMENT
-- ─────────────────────────────────────────────────────────────────────

-- warehouse_inventory : un vendeur ne voit et ne modifie que ses produits
-- et uniquement s'il possède une souscription active
DROP POLICY IF EXISTS "warehouse_inv_vendor_select" ON public.warehouse_inventory;
CREATE POLICY "warehouse_inv_vendor_select" ON public.warehouse_inventory
  FOR SELECT USING (
    vendor_id = auth.uid() OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "warehouse_inv_vendor_insert" ON public.warehouse_inventory;
CREATE POLICY "warehouse_inv_vendor_insert" ON public.warehouse_inventory
  FOR INSERT WITH CHECK (
    vendor_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.vendor_storage_subscriptions
      WHERE vendor_id = auth.uid() 
        AND agency_id = warehouse_inventory.agency_id 
        AND status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "warehouse_inv_vendor_update" ON public.warehouse_inventory;
CREATE POLICY "warehouse_inv_vendor_update" ON public.warehouse_inventory
  FOR UPDATE USING (
    vendor_id = auth.uid()
  );

-- =====================================================================
-- FIN DE LA MIGRATION FULFILLMENT V2
-- =====================================================================

