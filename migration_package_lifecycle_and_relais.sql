-- =====================================================================
-- Migration : Cycle de vie des colis, Points Relais & Sécurité d'état
-- Fichier : migration_package_lifecycle_and_relais.sql
-- =====================================================================

-- 1. MISE À JOUR DE LA CONTRAINTE DE STATUT SUR PACKAGES
DO $$
BEGIN
  ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_status_check;
  ALTER TABLE packages ADD CONSTRAINT packages_status_check
    CHECK (status IN (
      'CREATED',
      'PENDING_AGENCY',
      'ACCEPTED_BY_AGENCY',
      'REJECTED_BY_AGENCY',
      'ASSIGNED_TO_DRIVER',
      'IN_TRANSIT',
      'DEPOSITED_AT_DROP_POINT',
      'AVAILABLE_AT_PICKUP_POINT',
      'WAITING_FOR_AGENCY_PICKUP',
      'REFUSED_BY_DROP_POINT',
      'IN_DISPUTE',
      'DELIVERED',
      'CANCELLED'
    ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur lors de la mise a jour de la contrainte status : %', SQLERRM;
END $$;

-- 2. AJOUT DES COLONNES DE RÉCLAMATION SUR PACKAGES
ALTER TABLE packages ADD COLUMN IF NOT EXISTS claim_reason TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'NONE'
  CHECK (claim_status IN ('NONE', 'OPEN', 'RESOLVED'));
ALTER TABLE packages ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- 3. AJOUT DES COLONNES DE REFUS SUR PACKAGES
ALTER TABLE packages ADD COLUMN IF NOT EXISTS refusal_reason_code TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS refusal_comment TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS refused_at TIMESTAMP WITH TIME ZONE;

-- 4. ÉVOLUTION DROP_POINTS (Code affiché modifiable + QR Token aléatoire)
ALTER TABLE drop_points ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE drop_points ADD COLUMN IF NOT EXISTS qr_token TEXT;
ALTER TABLE drop_points ADD COLUMN IF NOT EXISTS qr_rotated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

-- Initialiser le code avec l'id existant si vide
UPDATE drop_points SET code = id WHERE code IS NULL OR code = '';

-- Initialiser un qr_token cryptographique si vide
UPDATE drop_points
SET qr_token = 'QR-' || encode(gen_random_bytes(16), 'hex')
WHERE qr_token IS NULL OR qr_token = '';

-- Contraintes d'unicité
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drop_points_code_unique'
  ) THEN
    ALTER TABLE drop_points ADD CONSTRAINT drop_points_code_unique UNIQUE (code);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drop_points_qr_token_unique'
  ) THEN
    ALTER TABLE drop_points ADD CONSTRAINT drop_points_qr_token_unique UNIQUE (qr_token);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Contraintes drop_points ignorees : %', SQLERRM;
END $$;

-- 5. TABLE HISTORIQUE DES CODES DE POINTS RELAIS
CREATE TABLE IF NOT EXISTS drop_point_code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_point_id TEXT NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
  old_code TEXT NOT NULL,
  new_code TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT NOT NULL DEFAULT 'Super Admin',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dp_code_history_dp_id ON drop_point_code_history(drop_point_id);
ALTER TABLE drop_point_code_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture admin historique codes drop_points" ON drop_point_code_history FOR SELECT USING (true);
CREATE POLICY "Insertion historique codes drop_points" ON drop_point_code_history FOR INSERT WITH CHECK (true);

-- 6. TABLE D'AUDIT IMMUABLE DES TRANSITIONS DE COLIS (PACKAGE_AUDIT_LOGS)
CREATE TABLE IF NOT EXISTS package_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  package_code TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_package_audit_pkg_id ON package_audit_logs(package_id);
CREATE INDEX IF NOT EXISTS idx_package_audit_created_at ON package_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_package_audit_idempotency ON package_audit_logs(idempotency_key);

-- Règle d'immuabilité stricte pour package_audit_logs
CREATE OR REPLACE FUNCTION prevent_package_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table package_audit_logs est STRICTEMENT IMMUABLE : aucune modification (UPDATE) ni suppression (DELETE) n''est autorisee.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_package_audit_logs ON package_audit_logs;
CREATE TRIGGER trg_immutable_package_audit_logs
BEFORE UPDATE OR DELETE ON package_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_package_audit_tampering();

ALTER TABLE package_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "package_audit_logs_select" ON package_audit_logs FOR SELECT USING (true);
CREATE POLICY "package_audit_logs_insert" ON package_audit_logs FOR INSERT WITH CHECK (true);

-- 7. TABLE NOTIFICATIONS (si inexistante)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'INFO',
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (true);
