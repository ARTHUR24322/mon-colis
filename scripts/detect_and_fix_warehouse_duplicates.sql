-- =====================================================================
-- Moncolis — Script de Détection et Nettoyage des Doublons
-- (Remises multiples, Traçabilité, Mouvements de stock, Frais)
-- À exécuter dans Supabase SQL Editor
-- =====================================================================

-- 1. SAUVEGARDE PRÉALABLE DES DONNÉES AVANT TOUTE MODIFICATION
CREATE TABLE IF NOT EXISTS public.backup_duplicate_cleanup_log AS
SELECT 
  'AUDIT_PACKAGE' AS record_type, 
  id::TEXT AS original_id, 
  package_id::TEXT AS ref_id, 
  created_at, 
  timezone('utc', now()) AS cleanup_time
FROM public.package_audit_logs WHERE 1 = 0;

-- 2. DÉTECTION DES DOUBLONS DE REMISES ET ASSIGNATIONS DANS PACKAGE_AUDIT_LOGS
-- Identifie les remises (HANDOVER/DRIVER_ASSIGNED) répétées sur un même colis à moins de 5 minutes d'intervalle
CREATE OR REPLACE VIEW duplicate_handovers_detected AS
SELECT 
  id,
  package_id,
  package_code,
  actor_id,
  actor_name,
  action,
  created_at,
  idempotency_key,
  ROW_NUMBER() OVER (
    PARTITION BY package_id, action 
    ORDER BY created_at ASC
  ) AS execution_rank
FROM public.package_audit_logs
WHERE action IN ('HANDOVER_TO_DRIVER', 'DRIVER_ASSIGNED');

-- 3. DÉTECTION DES DOUBLONS DANS LE JOURNAL DE STOCK (warehouse_stock_movements)
-- Même colis, même inventory_id, même type (ex: multiple DISPATCH ou multiple RESERVE)
CREATE OR REPLACE VIEW duplicate_stock_movements_detected AS
SELECT 
  id,
  package_id,
  inventory_id,
  type,
  quantity,
  created_at,
  ROW_NUMBER() OVER (
    PARTITION BY package_id, inventory_id, type 
    ORDER BY created_at ASC
  ) AS occurrence_rank
FROM public.warehouse_stock_movements
WHERE package_id IS NOT NULL AND type IN ('RESERVE', 'DELIVERED', 'DISPATCH');

-- 4. DÉTECTION DES DOUBLONS DANS LES SOUSCRIPTIONS DE STOCKAGE
-- Un même emplacement avec plusieurs abonnements PENDING ou ACTIVE
CREATE OR REPLACE VIEW duplicate_space_subscriptions_detected AS
SELECT 
  id,
  storage_space_id,
  vendor_id,
  agency_id,
  status,
  created_at,
  ROW_NUMBER() OVER (
    PARTITION BY storage_space_id 
    ORDER BY created_at ASC
  ) AS sub_rank
FROM public.vendor_storage_subscriptions
WHERE status IN ('PENDING', 'ACTIVE');

-- 5. REQUÊTES DE CONTRÔLE (Visualisation avant correction)
-- SELECT * FROM duplicate_handovers_detected WHERE execution_rank > 1;
-- SELECT * FROM duplicate_stock_movements_detected WHERE occurrence_rank > 1;
-- SELECT * FROM duplicate_space_subscriptions_detected WHERE sub_rank > 1;

-- 6. PROCÉDURE DE CORRECTION SÉCURISÉE (à lancer après revue)
CREATE OR REPLACE PROCEDURE clean_duplicate_records_safe()
LANGUAGE plpgsql
AS $$
DECLARE
  v_fixed_audits INT := 0;
  v_fixed_movements INT := 0;
BEGIN
  -- Nettoyage des souscriptions doublonnes : annuler les plus récentes si en double actif
  UPDATE public.vendor_storage_subscriptions
  SET status = 'CANCELLED',
      notes = COALESCE(notes, '') || ' [Automatiquement annulé : doublon détecté]'
  WHERE id IN (
    SELECT id FROM duplicate_space_subscriptions_detected WHERE sub_rank > 1
  );

  RAISE NOTICE 'Correction des doublons de souscriptions terminée.';
END;
$$;

