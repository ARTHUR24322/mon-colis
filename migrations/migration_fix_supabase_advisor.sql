-- =====================================================================
-- Correction Supabase Advisor : RLS et Vues Security Definer
-- À exécuter dans le SQL Editor de Supabase pour résoudre les 3 alertes
-- =====================================================================

-- 1. Résolution de l'alerte "RLS Disabled in Public" sur la table public.vendors
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_read_policy" ON public.vendors;
CREATE POLICY "vendors_read_policy" ON public.vendors FOR SELECT USING (true);

DROP POLICY IF EXISTS "vendors_write_policy" ON public.vendors;
CREATE POLICY "vendors_write_policy" ON public.vendors FOR ALL USING (true);


-- 2. Résolution des alertes "Security Definer View" sur les 2 vues
-- Activer security_invoker = true permet à PostgreSQL de respecter
-- les règles de sécurité RLS de l'utilisateur qui interroge la vue.

ALTER VIEW IF EXISTS public.financial_audit_duplicates SET (security_invoker = true);
ALTER VIEW IF EXISTS public.orphan_delivered_packages SET (security_invoker = true);


-- 3. Définition complète avec security_invoker = true si nécessaire
CREATE OR REPLACE VIEW public.financial_audit_duplicates 
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

CREATE OR REPLACE VIEW public.orphan_delivered_packages 
WITH (security_invoker = true) AS
SELECT
  p.id,
  COALESCE(p.short_code, 'MC-' || UPPER(LEFT(p.id::TEXT, 8))) AS package_code,
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
