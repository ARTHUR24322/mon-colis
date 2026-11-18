-- =====================================================================
-- Migration : Autoriser la suppression / purge administrative des colis
-- Tout en interdisant formellement toute modification (UPDATE) des logs
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================

-- 1. package_audit_logs :
-- Interdit formellement toute falsification (UPDATE),
-- mais autorise la suppression (DELETE) lors de la purge légitime de colis ou comptes par l'administrateur.
CREATE OR REPLACE FUNCTION prevent_package_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'Table package_audit_logs est IMMUABLE : aucune modification (UPDATE) n''est autorisée.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_package_audit_logs ON package_audit_logs;
CREATE TRIGGER trg_immutable_package_audit_logs
BEFORE UPDATE OR DELETE ON package_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_package_audit_tampering();

-- 2. financial_audits :
-- Interdit toute modification (UPDATE), autorise la suppression en cascade légitime
CREATE OR REPLACE FUNCTION prevent_financial_audits_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'Table financial_audits est IMMUABLE : aucune modification (UPDATE) n''est autorisée.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_financial_audits ON financial_audits;
CREATE TRIGGER trg_immutable_financial_audits
BEFORE UPDATE OR DELETE ON financial_audits
FOR EACH ROW EXECUTE FUNCTION prevent_financial_audits_tampering();

-- 3. warehouse_stock_movements :
-- Interdit toute modification (UPDATE), autorise la suppression lors du nettoyage de tests
CREATE OR REPLACE FUNCTION prevent_warehouse_stock_movements_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'Table warehouse_stock_movements est IMMUABLE : aucune modification (UPDATE) n''est autorisée.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_warehouse_stock_movements ON warehouse_stock_movements;
CREATE TRIGGER trg_immutable_warehouse_stock_movements
BEFORE UPDATE OR DELETE ON warehouse_stock_movements
FOR EACH ROW EXECUTE FUNCTION prevent_warehouse_stock_movements_tampering();
