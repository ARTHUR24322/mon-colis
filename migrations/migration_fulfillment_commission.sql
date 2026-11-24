-- =====================================================================
-- Moncolis — Migration Commission Entrepôts & Stockage
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================

-- 1. Ajout de la commission par défaut sur les espaces de stockage des agences
ALTER TABLE IF EXISTS public.agency_storage_spaces
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00;

-- 2. Ajout de la commission sur les abonnements/locations de stockage souscrites
ALTER TABLE IF EXISTS public.vendor_storage_subscriptions
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS net_agency_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 3. Initialisation des montants pour les souscriptions existantes
UPDATE public.vendor_storage_subscriptions
SET 
  commission_rate = COALESCE(commission_rate, 10.00),
  commission_amount = ROUND((COALESCE(price_paid, 0) * (COALESCE(commission_rate, 10.00) / 100)), 2),
  net_agency_amount = ROUND(COALESCE(price_paid, 0) - (COALESCE(price_paid, 0) * (COALESCE(commission_rate, 10.00) / 100)), 2)
WHERE commission_amount = 0 OR commission_amount IS NULL;
