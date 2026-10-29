-- =====================================================================
-- Migration Moncolis v2 : Cohérence Financière & Sécurité Renforcée
-- À exécuter dans le SQL Editor de Supabase
-- Prérequis : migration_financial_audit_and_security.sql déjà exécutée
-- =====================================================================

-- 1. INDEX PARTIEL : détection rapide des doublons de paiement
-- (index direct sur created_at pour éviter l'erreur Postgres 42P17 sur date_trunc avec timestamptz)
CREATE INDEX IF NOT EXISTS idx_financial_audits_duplicate_detection
  ON financial_audits (actor_id, amount_cdf, created_at DESC)
  WHERE status = 'COMPLETED';

-- 2. VUE : doublons potentiels (même acteur, même montant, dans les 2 heures)
CREATE OR REPLACE VIEW financial_audit_duplicates 
WITH (security_invoker = true) AS
SELECT
  fa1.id          AS audit_id,
  fa1.actor_name,
  fa1.target_name,
  fa1.amount_cdf,
  fa1.amount_usd,
  fa1.exchange_rate_applied,
  fa1.created_at,
  fa1.idempotency_key,
  fa1.mobile_money_ref,
  fa1.package_code,
  COUNT(*) OVER (
    PARTITION BY fa1.actor_id, fa1.amount_cdf
    ORDER BY fa1.created_at
    RANGE BETWEEN INTERVAL '2 hours' PRECEDING AND CURRENT ROW
  ) AS occurrences_in_2h,
  CASE
    WHEN COUNT(*) OVER (
      PARTITION BY fa1.actor_id, fa1.amount_cdf
      ORDER BY fa1.created_at
      RANGE BETWEEN INTERVAL '2 hours' PRECEDING AND CURRENT ROW
    ) > 1 THEN true
    ELSE false
  END AS is_potential_duplicate
FROM financial_audits fa1
WHERE fa1.status = 'COMPLETED'
ORDER BY fa1.created_at DESC;

-- 3. COLONNE code court lisible (MC-000044) sur packages (créée avant la vue)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS short_code TEXT;

CREATE OR REPLACE FUNCTION generate_package_short_code()
RETURNS TRIGGER AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  IF NEW.short_code IS NULL THEN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(short_code FROM 4) AS INTEGER)), 0
    ) + 1
    INTO seq_num
    FROM packages
    WHERE short_code ~ '^MC-[0-9]+$';
    NEW.short_code := 'MC-' || LPAD(seq_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_package_short_code ON packages;
CREATE TRIGGER trg_package_short_code
BEFORE INSERT ON packages
FOR EACH ROW
EXECUTE FUNCTION generate_package_short_code();

-- Rétroactivement remplir les colis existants (exécuter une seule fois)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM packages
  WHERE short_code IS NULL
)
UPDATE packages p
SET short_code = 'MC-' || LPAD(n.rn::TEXT, 6, '0')
FROM numbered n
WHERE p.id = n.id;

-- Index d'unicité sur short_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_packages_short_code
  ON packages(short_code)
  WHERE short_code IS NOT NULL;

-- 4. VUE : colis livrés orphelins (sans agence) pour réconciliation
CREATE OR REPLACE VIEW orphan_delivered_packages 
WITH (security_invoker = true) AS
SELECT
  p.id,
  COALESCE(p.short_code, p.tracking_code, 'MC-' || UPPER(LEFT(p.id::TEXT, 8))) AS package_code,
  p.client_name,
  p.delivery_price                        AS montant_livraison_usd,
  p.package_price                         AS valeur_marchandise_usd,
  p.created_at,
  p.updated_at                            AS delivered_at,
  prof.name                               AS vendeur_name,
  prof.id                                 AS vendeur_id
FROM packages p
LEFT JOIN profiles prof ON prof.id = p.vendeur_id
WHERE p.status = 'DELIVERED'
  AND (p.agency_id IS NULL OR NOT EXISTS (SELECT 1 FROM agencies WHERE id = p.agency_id))
ORDER BY p.updated_at DESC;

-- 5. CONTRAINTE : un colis ne peut pas passer à DELIVERED avec delivery_price = 0
--    sauf si is_prepaid = true (montant déjà reçu).
--    Ne se déclenche QUE lors d'un CHANGEMENT vers le statut DELIVERED (évite de bloquer les colis d'historique).
CREATE OR REPLACE FUNCTION prevent_zero_amount_delivery()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DELIVERED'
     AND (OLD.status IS DISTINCT FROM 'DELIVERED')
     AND (NEW.delivery_price IS NULL OR NEW.delivery_price = 0)
     AND (NEW.is_prepaid IS NULL OR NEW.is_prepaid = false)
  THEN
    RAISE EXCEPTION
      'Impossible de passer le colis % au statut LIVRÉ avec un montant de livraison à 0 USD (non prépayé).',
      NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_zero_delivery ON packages;
CREATE TRIGGER trg_prevent_zero_delivery
BEFORE UPDATE OF status ON packages
FOR EACH ROW
WHEN (NEW.status = 'DELIVERED' AND OLD.status IS DISTINCT FROM 'DELIVERED')
EXECUTE FUNCTION prevent_zero_amount_delivery();

-- =====================================================================
-- Vérification post-migration :
--   SELECT * FROM orphan_delivered_packages LIMIT 10;
--   SELECT * FROM financial_audit_duplicates WHERE is_potential_duplicate LIMIT 20;
--   SELECT short_code, created_at FROM packages ORDER BY created_at LIMIT 5;
-- =====================================================================
