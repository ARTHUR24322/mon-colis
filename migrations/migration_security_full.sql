-- =====================================================================
-- Moncolis — Migration Sécurité Complète
-- Applique RLS + Policies sur toutes les tables publiques
-- Corrige les alertes Supabase Advisor (Security Definer Views, RLS disabled)
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 0. ACTIVER RLS SUR TOUTES LES TABLES PUBLIQUES
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agencies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drivers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.packages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drop_points            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drop_point_agents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_audits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_cash_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_cash_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_codes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.login_attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.driver_payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.package_quotes         ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 1. SUPPRIMER LES ANCIENNES POLICIES (idempotent)
-- ─────────────────────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "profiles_service_role_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_read"             ON public.profiles;

-- agencies
DROP POLICY IF EXISTS "agencies_service_role_all"    ON public.agencies;
DROP POLICY IF EXISTS "agencies_public_read"          ON public.agencies;

-- vendors
DROP POLICY IF EXISTS "vendors_read_policy"           ON public.vendors;
DROP POLICY IF EXISTS "vendors_write_policy"          ON public.vendors;
DROP POLICY IF EXISTS "vendors_service_role_all"      ON public.vendors;

-- drivers
DROP POLICY IF EXISTS "drivers_service_role_all"      ON public.drivers;

-- packages
DROP POLICY IF EXISTS "packages_service_role_all"     ON public.packages;

-- drop_points
DROP POLICY IF EXISTS "drop_points_service_role_all"  ON public.drop_points;
DROP POLICY IF EXISTS "drop_points_public_read"        ON public.drop_points;

-- drop_point_agents
DROP POLICY IF EXISTS "drop_point_agents_service_role_all" ON public.drop_point_agents;

-- notifications
DROP POLICY IF EXISTS "notifications_service_role_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_own"               ON public.notifications;

-- financial_audits
DROP POLICY IF EXISTS "financial_audits_service_role_all" ON public.financial_audits;

-- system_settings
DROP POLICY IF EXISTS "system_settings_service_role_all" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_public_read"       ON public.system_settings;

-- agency_cash_sessions
DROP POLICY IF EXISTS "cash_sessions_service_role_all" ON public.agency_cash_sessions;

-- vendor_payment_requests
DROP POLICY IF EXISTS "vendor_payment_requests_service_role_all" ON public.vendor_payment_requests;

-- agency_cash_requests
DROP POLICY IF EXISTS "agency_cash_requests_service_role_all" ON public.agency_cash_requests;

-- promo_codes
DROP POLICY IF EXISTS "promo_codes_service_role_all" ON public.promo_codes;

-- security_logs
DROP POLICY IF EXISTS "security_logs_service_role_all" ON public.security_logs;

-- login_attempts
DROP POLICY IF EXISTS "login_attempts_service_role_all" ON public.login_attempts;

-- driver_payment_sessions
DROP POLICY IF EXISTS "driver_payment_sessions_service_role_all" ON public.driver_payment_sessions;

-- package_quotes
DROP POLICY IF EXISTS "package_quotes_service_role_all" ON public.package_quotes;

-- ─────────────────────────────────────────────────────────────────────
-- 2. POLICIES PAR TABLE
--    Stratégie : le service_role (backend) a accès total.
--    Les clés anon/authenticated n'ont aucun accès direct (tout passe par l'API).
-- ─────────────────────────────────────────────────────────────────────

-- ── profiles ──────────────────────────────────────────────────────────
-- Le backend (service_role) gère tout. Pas d'accès direct depuis le browser.
CREATE POLICY "profiles_service_role_all" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ── agencies ──────────────────────────────────────────────────────────
CREATE POLICY "agencies_service_role_all" ON public.agencies
  FOR ALL USING (auth.role() = 'service_role');

-- Lecture publique des agences APPROVED (pour la sélection par les vendeurs)
CREATE POLICY "agencies_public_approved_read" ON public.agencies
  FOR SELECT USING (status = 'APPROVED');

-- ── vendors ───────────────────────────────────────────────────────────
CREATE POLICY "vendors_service_role_all" ON public.vendors
  FOR ALL USING (auth.role() = 'service_role');

-- ── drivers ───────────────────────────────────────────────────────────
CREATE POLICY "drivers_service_role_all" ON public.drivers
  FOR ALL USING (auth.role() = 'service_role');

-- ── packages ──────────────────────────────────────────────────────────
CREATE POLICY "packages_service_role_all" ON public.packages
  FOR ALL USING (auth.role() = 'service_role');

-- ── drop_points ───────────────────────────────────────────────────────
CREATE POLICY "drop_points_service_role_all" ON public.drop_points
  FOR ALL USING (auth.role() = 'service_role');

-- Lecture publique des points relais actifs
CREATE POLICY "drop_points_public_active_read" ON public.drop_points
  FOR SELECT USING (is_active = true);

-- ── drop_point_agents ─────────────────────────────────────────────────
CREATE POLICY "drop_point_agents_service_role_all" ON public.drop_point_agents
  FOR ALL USING (auth.role() = 'service_role');

-- ── notifications ─────────────────────────────────────────────────────
CREATE POLICY "notifications_service_role_all" ON public.notifications
  FOR ALL USING (auth.role() = 'service_role');

-- ── financial_audits ──────────────────────────────────────────────────
CREATE POLICY "financial_audits_service_role_all" ON public.financial_audits
  FOR ALL USING (auth.role() = 'service_role');

-- ── system_settings ───────────────────────────────────────────────────
CREATE POLICY "system_settings_service_role_all" ON public.system_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Lecture publique des paramètres système non sensibles (taux de change, etc.)
CREATE POLICY "system_settings_public_read" ON public.system_settings
  FOR SELECT USING (
    key NOT IN (
      'admin_accounts',
      'smtp_config',
      'resend_api_key',
      'session_secret',
      'webhook_secrets'
    )
  );

-- ── agency_cash_sessions ──────────────────────────────────────────────
CREATE POLICY "cash_sessions_service_role_all" ON public.agency_cash_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- ── vendor_payment_requests ───────────────────────────────────────────
CREATE POLICY "vendor_payment_requests_service_role_all" ON public.vendor_payment_requests
  FOR ALL USING (auth.role() = 'service_role');

-- ── agency_cash_requests ──────────────────────────────────────────────
CREATE POLICY "agency_cash_requests_service_role_all" ON public.agency_cash_requests
  FOR ALL USING (auth.role() = 'service_role');

-- ── promo_codes ───────────────────────────────────────────────────────
CREATE POLICY "promo_codes_service_role_all" ON public.promo_codes
  FOR ALL USING (auth.role() = 'service_role');

-- ── security_logs ─────────────────────────────────────────────────────
CREATE POLICY "security_logs_service_role_all" ON public.security_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ── login_attempts ────────────────────────────────────────────────────
CREATE POLICY "login_attempts_service_role_all" ON public.login_attempts
  FOR ALL USING (auth.role() = 'service_role');

-- ── driver_payment_sessions ───────────────────────────────────────────
CREATE POLICY "driver_payment_sessions_service_role_all" ON public.driver_payment_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- ── package_quotes ────────────────────────────────────────────────────
CREATE POLICY "package_quotes_service_role_all" ON public.package_quotes
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- 3. CORRIGER LES VUES "SECURITY DEFINER" → "SECURITY INVOKER"
--    (supprime les alertes Supabase Advisor)
-- ─────────────────────────────────────────────────────────────────────

ALTER VIEW IF EXISTS public.financial_audit_duplicates   SET (security_invoker = true);
ALTER VIEW IF EXISTS public.orphan_delivered_packages    SET (security_invoker = true);

-- ─────────────────────────────────────────────────────────────────────
-- 4. RÉVOQUER LES ACCÈS PUBLIC / ANON SUR LES FONCTIONS SENSIBLES
-- ─────────────────────────────────────────────────────────────────────

-- Révoquer l'accès anon aux extensions potentiellement dangereuses
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 5. SÉCURISER LE SCHEMA PUBLIC
--    Empêche les utilisateurs anonymes de créer des objets dans public
-- ─────────────────────────────────────────────────────────────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- Uniquement le service_role et postgres peuvent créer
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 6. INDEX DE SÉCURITÉ (optimisation des requêtes RLS)
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_packages_agency_id     ON public.packages(agency_id);
CREATE INDEX IF NOT EXISTS idx_packages_vendor_id     ON public.packages(vendor_id);
CREATE INDEX IF NOT EXISTS idx_packages_driver_id     ON public.packages(driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_agency_id      ON public.drivers(agency_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_audits_agency_id ON public.financial_audits(agency_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id  ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip      ON public.login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_agency_cash_sessions_agency_id ON public.agency_cash_sessions(agency_id);

-- ─────────────────────────────────────────────────────────────────────
-- FIN DE LA MIGRATION SÉCURITÉ COMPLÈTE
-- ─────────────────────────────────────────────────────────────────────
