-- =====================================================================
-- Moncolis — Migration Fulfillment & Entrepôt (Phase 1)
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================
-- Cette migration met en place le système de stockage et fulfillment :
-- 1. agency_storage_spaces : Offres d'espaces/rayons définies par les agences
-- 2. vendor_storage_subscriptions : Locations d'espaces souscrites par les vendeurs
-- 3. warehouse_inventory : Catalogue des produits stockés en entrepôt par vendeur
-- 4. warehouse_stock_movements : Historique et traçabilité de chaque flux (entrée, sortie, retour)
-- 5. warehouse_inbound_batches : Bons de dépôt physique avec QR Code pour réapprovisionnement
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────────────────────

-- 1.1 Espaces de stockage proposés par les agences
CREATE TABLE IF NOT EXISTS public.agency_storage_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  name TEXT NOT NULL,                                       -- Ex: "Étagère Standard A", "Box sécurisé 1m³"
  description TEXT,
  total_slots INT NOT NULL DEFAULT 1,                       -- Capacité totale (ex: 20 emplacements)
  available_slots INT NOT NULL DEFAULT 1,                   -- Emplacements encore disponibles
  price_per_month NUMERIC(12, 2) NOT NULL DEFAULT 0,        -- Prix mensuel de location
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF')),
  max_weight_per_slot NUMERIC(10, 2),                       -- Poids max en kg par emplacement
  dimensions TEXT,                                          -- Ex: "120x60x50 cm"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- 1.2 Abonnements/Locations d'espaces par les vendeurs
CREATE TABLE IF NOT EXISTS public.vendor_storage_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  storage_space_id UUID REFERENCES public.agency_storage_spaces(id) ON DELETE CASCADE,
  slots_count INT NOT NULL DEFAULT 1,
  price_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- 1.3 Bons de dépôt de marchandise en entrepôt (Inbound avec QR Code)
CREATE TABLE IF NOT EXISTS public.warehouse_inbound_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,                        -- Ex: "INB-2026-0001"
  vendor_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  storage_space_id UUID REFERENCES public.agency_storage_spaces(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('DRAFT', 'PENDING', 'RECEIVED', 'REJECTED', 'CANCELLED')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,                 -- Détails des articles prévus et reçus
  qr_token TEXT UNIQUE,                                     -- Token pour validation par scan QR à l'agence
  total_items_count INT NOT NULL DEFAULT 0,
  received_items_count INT DEFAULT 0,
  deposited_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  received_by TEXT,                                         -- Nom ou identifiant de l'agent qui a réceptionné
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- 1.4 Inventaire des produits stockés en entrepôt
CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  storage_space_id UUID REFERENCES public.agency_storage_spaces(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.vendor_storage_subscriptions(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,                                                 -- Référence vendeur / Code-barres
  barcode TEXT,
  photo_url TEXT,
  category TEXT,
  unit_price NUMERIC(12, 2) DEFAULT 0,
  unit_currency TEXT DEFAULT 'USD' CHECK (unit_currency IN ('USD', 'CDF')),
  quantity_in_stock INT NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  quantity_reserved INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0), -- Réservé pour commandes en cours
  shelf_location TEXT,                                      -- Emplacement physique précis (ex: "Rayon A - Étagère 3")
  low_stock_threshold INT NOT NULL DEFAULT 5,              -- Seuil pour alerte de réapprovisionnement
  weight_kg NUMERIC(8, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- 1.5 Historique et traçabilité des mouvements de stock
CREATE TABLE IF NOT EXISTS public.warehouse_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.warehouse_inventory(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'DISPATCH', 'RETURN', 'ADJUSTMENT', 'TRANSFER')),
  quantity INT NOT NULL,                                    -- Nombre d'unités déplacées (+/-)
  previous_stock INT NOT NULL DEFAULT 0,
  new_stock INT NOT NULL DEFAULT 0,
  package_id UUID,                                          -- Référence au colis en cas d'expédition ou retour
  inbound_batch_id UUID REFERENCES public.warehouse_inbound_batches(id) ON DELETE SET NULL,
  reference TEXT,                                           -- Référence externe ou bon de livraison
  performed_by TEXT,                                        -- Agent ou vendeur à l'origine du mouvement
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);


-- ─────────────────────────────────────────────────────────────────────
-- 2. INDEX DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────

-- agency_storage_spaces
CREATE INDEX IF NOT EXISTS idx_agency_storage_spaces_agency ON public.agency_storage_spaces(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_storage_spaces_active ON public.agency_storage_spaces(is_active);

-- vendor_storage_subscriptions
CREATE INDEX IF NOT EXISTS idx_storage_subs_vendor ON public.vendor_storage_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_storage_subs_agency ON public.vendor_storage_subscriptions(agency_id);
CREATE INDEX IF NOT EXISTS idx_storage_subs_status ON public.vendor_storage_subscriptions(status);

-- warehouse_inbound_batches
CREATE INDEX IF NOT EXISTS idx_inbound_batches_vendor ON public.warehouse_inbound_batches(vendor_id);
CREATE INDEX IF NOT EXISTS idx_inbound_batches_agency ON public.warehouse_inbound_batches(agency_id);
CREATE INDEX IF NOT EXISTS idx_inbound_batches_qr ON public.warehouse_inbound_batches(qr_token);
CREATE INDEX IF NOT EXISTS idx_inbound_batches_status ON public.warehouse_inbound_batches(status);

-- warehouse_inventory
CREATE INDEX IF NOT EXISTS idx_warehouse_inv_vendor ON public.warehouse_inventory(vendor_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inv_agency ON public.warehouse_inventory(agency_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inv_sku ON public.warehouse_inventory(sku);
CREATE INDEX IF NOT EXISTS idx_warehouse_inv_vendor_agency ON public.warehouse_inventory(vendor_id, agency_id);

-- warehouse_stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_mov_inv ON public.warehouse_stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_agency ON public.warehouse_stock_movements(agency_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_vendor ON public.warehouse_stock_movements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_created ON public.warehouse_stock_movements(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 3. SÉCURITÉ ROW LEVEL SECURITY (RLS) & POLITIQUES
-- ─────────────────────────────────────────────────────────────────────

-- Activer RLS sur les 5 tables
ALTER TABLE public.agency_storage_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_storage_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inbound_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock_movements ENABLE ROW LEVEL SECURITY;

-- 3.1 Politiques service_role globales (accès API backend complet)
DROP POLICY IF EXISTS "storage_spaces_service_role_all" ON public.agency_storage_spaces;
CREATE POLICY "storage_spaces_service_role_all" ON public.agency_storage_spaces
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "storage_subs_service_role_all" ON public.vendor_storage_subscriptions;
CREATE POLICY "storage_subs_service_role_all" ON public.vendor_storage_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "inbound_batches_service_role_all" ON public.warehouse_inbound_batches;
CREATE POLICY "inbound_batches_service_role_all" ON public.warehouse_inbound_batches
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "warehouse_inv_service_role_all" ON public.warehouse_inventory;
CREATE POLICY "warehouse_inv_service_role_all" ON public.warehouse_inventory
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "stock_mov_service_role_all" ON public.warehouse_stock_movements;
CREATE POLICY "stock_mov_service_role_all" ON public.warehouse_stock_movements
  FOR ALL USING (auth.role() = 'service_role');

-- 3.2 Consultation publique des offres d'espaces de stockage actives
DROP POLICY IF EXISTS "storage_spaces_public_active_read" ON public.agency_storage_spaces;
CREATE POLICY "storage_spaces_public_active_read" ON public.agency_storage_spaces
  FOR SELECT USING (is_active = true);


-- ─────────────────────────────────────────────────────────────────────
-- 4. TRIGGER AUTOMATIQUE POUR UPDATED_AT
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  -- agency_storage_spaces
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_storage_spaces_updated_at') THEN
    CREATE TRIGGER trg_storage_spaces_updated_at
      BEFORE UPDATE ON public.agency_storage_spaces
      FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;

  -- vendor_storage_subscriptions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_storage_subs_updated_at') THEN
    CREATE TRIGGER trg_storage_subs_updated_at
      BEFORE UPDATE ON public.vendor_storage_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;

  -- warehouse_inbound_batches
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inbound_batches_updated_at') THEN
    CREATE TRIGGER trg_inbound_batches_updated_at
      BEFORE UPDATE ON public.warehouse_inbound_batches
      FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;

  -- warehouse_inventory
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_warehouse_inv_updated_at') THEN
    CREATE TRIGGER trg_warehouse_inv_updated_at
      BEFORE UPDATE ON public.warehouse_inventory
      FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- FIN DE LA MIGRATION FULFILLMENT & ENTREPÔT
-- ─────────────────────────────────────────────────────────────────────
