-- =====================================================================
-- MIGRATION COMPLÈTE : PAIEMENTS, CAISSE QR/OTP & MARCHANDISE
-- À exécuter dans l'éditeur SQL de Supabase (SQL Editor -> New Query)
-- Script 100% idempotent (peut être exécuté plusieurs fois sans erreur)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes indispensables sur la table packages
-- ---------------------------------------------------------------------
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_prepaid BOOLEAN DEFAULT false;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS paid_by_client BOOLEAN DEFAULT true;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS vendor_paid BOOLEAN DEFAULT false;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS pickup_code TEXT;

COMMENT ON COLUMN packages.is_prepaid IS
  'TRUE = client a déjà payé la marchandise (pas de collecte livreur). FALSE = le livreur collecte le montant chez le client (COD).';

COMMENT ON COLUMN packages.paid_by_client IS
  'TRUE = client paie les frais de livraison. FALSE = frais déduits du reversement vendeur.';

COMMENT ON COLUMN packages.vendor_paid IS
  'TRUE = marchandise déjà reversée au vendeur par l''agence. FALSE = en attente de reversement.';

CREATE INDEX IF NOT EXISTS idx_packages_is_prepaid ON packages(is_prepaid);
CREATE INDEX IF NOT EXISTS idx_packages_vendor_paid ON packages(vendor_paid, status);
CREATE INDEX IF NOT EXISTS idx_packages_pickup_code ON packages(pickup_code) WHERE pickup_code IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Table vendor_payment_requests (Demandes de reversement des vendeurs)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SEEN', 'PAID', 'REJECTED', 'EXPIRED')),
  message TEXT,
  reject_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE vendor_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_payment_requests_all" ON vendor_payment_requests;
CREATE POLICY "vendor_payment_requests_all"
  ON vendor_payment_requests FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vendor_payment_requests_agency_status
  ON vendor_payment_requests(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_requests_vendor_status
  ON vendor_payment_requests(vendor_id, status);

-- ---------------------------------------------------------------------
-- 3. Table driver_cash_requests (Dépôts de caisse livreur via QR ou Manuel)
-- ---------------------------------------------------------------------
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

DROP POLICY IF EXISTS "driver_cash_requests_all" ON driver_cash_requests;
CREATE POLICY "driver_cash_requests_all"
  ON driver_cash_requests FOR ALL USING (true) WITH CHECK (true);

-- Colonnes additionnelles si la table existait déjà antérieurement
ALTER TABLE driver_cash_requests ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'MANUAL';
ALTER TABLE driver_cash_requests ADD COLUMN IF NOT EXISTS qr_token TEXT;
ALTER TABLE driver_cash_requests ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE driver_cash_requests ADD COLUMN IF NOT EXISTS confirmed_by_agency_id UUID;

CREATE INDEX IF NOT EXISTS idx_driver_cash_requests_qr_token
  ON driver_cash_requests(qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_cash_requests_driver_type_status
  ON driver_cash_requests(driver_id, type, status);

-- ---------------------------------------------------------------------
-- 4. Table ledger_entries (Grand livre des transactions financières)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'CDF',
  status TEXT DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
  notes TEXT,
  confirmed_by_vendor_at TIMESTAMP WITH TIME ZONE,
  confirmed_by_agency_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_entries_all" ON ledger_entries;
CREATE POLICY "ledger_entries_all"
  ON ledger_entries FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_agency_vendor
  ON ledger_entries(agency_id, vendor_id, status);

-- ---------------------------------------------------------------------
-- 5. Table payment_otps (Codes OTP sécurisés pour confirmation vendeur)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_entry_id UUID REFERENCES ledger_entries(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  otp_hash TEXT NOT NULL,
  used BOOLEAN DEFAULT false NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE payment_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_otps_all" ON payment_otps;
CREATE POLICY "payment_otps_all"
  ON payment_otps FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_payment_otps_vendor_used
  ON payment_otps(vendor_id, used, expires_at);

-- ---------------------------------------------------------------------
-- 6. Table notifications (si non créée)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_all" ON notifications;
CREATE POLICY "notifications_all"
  ON notifications FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read, created_at DESC);
