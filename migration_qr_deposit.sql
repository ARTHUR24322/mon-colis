-- =====================================================================
-- Migration complète : QR Dépôt + Tables manquantes
-- À exécuter dans Supabase SQL Editor (onglet SQL Editor)
-- =====================================================================

-- 1. Table vendor_payment_requests (si pas encore créée)
CREATE TABLE IF NOT EXISTS vendor_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SEEN', 'PAID', 'REJECTED')),
  message TEXT,
  reject_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE vendor_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor payment requests visible to agencies and vendors" ON vendor_payment_requests;
CREATE POLICY "Vendor payment requests visible to agencies and vendors"
  ON vendor_payment_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Vendors can insert payment requests" ON vendor_payment_requests;
CREATE POLICY "Vendors can insert payment requests"
  ON vendor_payment_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Agencies can update payment requests" ON vendor_payment_requests;
CREATE POLICY "Agencies can update payment requests"
  ON vendor_payment_requests FOR UPDATE USING (true);

-- 2. Table driver_cash_requests (si pas encore créée)
CREATE TABLE IF NOT EXISTS driver_cash_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'REJECTED', 'CANCELLED')),
  note TEXT,
  reject_reason TEXT,
  type TEXT DEFAULT 'MANUAL'
    CHECK (type IN ('MANUAL', 'QR_DEPOSIT')),
  qr_token TEXT UNIQUE,
  qr_expires_at TIMESTAMP WITH TIME ZONE,
  confirmed_by_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE driver_cash_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Driver cash requests visible to all authenticated" ON driver_cash_requests;
CREATE POLICY "Driver cash requests visible to all authenticated"
  ON driver_cash_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can insert cash requests" ON driver_cash_requests;
CREATE POLICY "Drivers can insert cash requests"
  ON driver_cash_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Agencies can update cash requests" ON driver_cash_requests;
CREATE POLICY "Agencies can update cash requests"
  ON driver_cash_requests FOR UPDATE USING (true);

-- 3. Si driver_cash_requests EXISTE déjà, ajouter les colonnes manquantes
ALTER TABLE driver_cash_requests
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'MANUAL';

ALTER TABLE driver_cash_requests
  ADD COLUMN IF NOT EXISTS qr_token TEXT;

ALTER TABLE driver_cash_requests
  ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE driver_cash_requests
  ADD COLUMN IF NOT EXISTS confirmed_by_agency_id UUID;

-- Contrainte CANCELLED sur status (si pas déjà présente)
DO $$
BEGIN
  ALTER TABLE driver_cash_requests
    DROP CONSTRAINT IF EXISTS driver_cash_requests_status_check;
  ALTER TABLE driver_cash_requests
    ADD CONSTRAINT driver_cash_requests_status_check
    CHECK (status IN ('PENDING', 'PAID', 'REJECTED', 'CANCELLED'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Status constraint update skipped: %', SQLERRM;
END $$;

-- Contrainte UNIQUE sur qr_token (si pas déjà présente)
DO $$
BEGIN
  ALTER TABLE driver_cash_requests
    ADD CONSTRAINT driver_cash_requests_qr_token_unique UNIQUE (qr_token);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'QR token unique constraint skipped: %', SQLERRM;
END $$;

-- 4. Index pour performances
CREATE INDEX IF NOT EXISTS idx_driver_cash_requests_qr_token
  ON driver_cash_requests(qr_token)
  WHERE qr_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_driver_cash_requests_driver_type_status
  ON driver_cash_requests(driver_id, type, status);

CREATE INDEX IF NOT EXISTS idx_vendor_payment_requests_agency_status
  ON vendor_payment_requests(agency_id, status);

-- 5. Colonne pickup_code sur packages (si pas déjà présente)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS pickup_code TEXT;
CREATE INDEX IF NOT EXISTS idx_packages_pickup_code ON packages(pickup_code) WHERE pickup_code IS NOT NULL;

