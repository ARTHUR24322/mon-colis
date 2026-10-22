-- =====================================================================
-- Migration : Cohérence Financière, Idempotence, Immuabilité & Sécurité
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================

-- 1. Table financial_audits complète et immuable
CREATE TABLE IF NOT EXISTS financial_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE,                     -- Contrainte d'idempotence stricte : empêche tout double paiement
  action_type TEXT NOT NULL,                       -- Ex: PAYMENT_AGENCY_TO_VENDOR, COMMISSION_PERCEIVED, etc.
  amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- Devise de référence de stockage
  amount_cdf NUMERIC(14, 2) NOT NULL DEFAULT 0,    -- Montant en Francs Congolais (FC)
  exchange_rate_applied NUMERIC(10, 2) NOT NULL DEFAULT 2800, -- Taux appliqué au moment précis de la transaction
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,                        -- Ex: Agence ALI Express
  target_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_name TEXT NOT NULL,                       -- Nom réel du bénéficiaire (ex: Jean Mukendi)
  target_role TEXT,                                -- Ex: 'vendeur', 'livreur', 'agence'
  status TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
  reference TEXT,                                  -- Référence interne de la demande / transaction
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL, -- Colis concerné
  package_code TEXT,                               -- Code court lisible (ex: MC-000044)
  mobile_money_ref TEXT,                           -- Référence Mobile Money (M-Pesa, Airtel Money, Orange Money)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Si la table existait déjà, s'assurer que toutes les colonnes requises sont présentes :
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS amount_cdf NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC(10, 2) DEFAULT 2800;
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS package_id UUID;
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS package_code TEXT;
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS mobile_money_ref TEXT;
ALTER TABLE financial_audits ADD COLUMN IF NOT EXISTS target_name TEXT;

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_financial_audits_idempotency ON financial_audits(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_financial_audits_package ON financial_audits(package_id);
CREATE INDEX IF NOT EXISTS idx_financial_audits_target ON financial_audits(target_id);
CREATE INDEX IF NOT EXISTS idx_financial_audits_created ON financial_audits(created_at DESC);

-- 2. GARANTIE D'IMMUABILITÉ STRICTE EN BASE
-- Empêche formellement tout UPDATE et tout DELETE sur financial_audits
CREATE OR REPLACE FUNCTION prevent_financial_audits_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table financial_audits est STRICTEMENT IMMUABLE : aucune modification (UPDATE) ni suppression (DELETE) n''est autorisée.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_financial_audits ON financial_audits;
CREATE TRIGGER trg_immutable_financial_audits
BEFORE UPDATE OR DELETE ON financial_audits
FOR EACH ROW EXECUTE FUNCTION prevent_financial_audits_tampering();

-- RLS sur financial_audits
ALTER TABLE financial_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_audits_read_admin" ON financial_audits;
CREATE POLICY "financial_audits_read_admin" ON financial_audits FOR SELECT USING (true);
DROP POLICY IF EXISTS "financial_audits_insert" ON financial_audits;
CREATE POLICY "financial_audits_insert" ON financial_audits FOR INSERT WITH CHECK (true);
-- Aucune policy pour UPDATE ou DELETE n'existe !

-- 3. Table des IPs bloquées automatiquement suite aux attaques de brute-force
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 1,
  blocked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_ips_all" ON blocked_ips FOR ALL USING (true);

-- 4. Table des tentatives d'authentification pour limiter le brute-force (Agents et Livreurs)
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Numéro agent (9 chiffres) ou Téléphone livreur
  failed_count INTEGER DEFAULT 1,
  locked_until TIMESTAMP WITH TIME ZONE,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_identifier ON auth_rate_limits(identifier);
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_rate_limits_all" ON auth_rate_limits FOR ALL USING (true);
