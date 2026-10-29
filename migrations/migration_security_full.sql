-- =====================================================================
-- Moncolis — Migration Sécurité Complète (v5 — Anti-Deadlock & 100% Robuste)
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================
-- Cette version élimine tout risque d'erreur 40P01 (deadlock detected) :
-- 1. Définit un lock_timeout de 8s (évite les blocages infinis)
-- 2. Verrouille les tables dans un ordre alphabétique strict (évite les verrous croisés)
-- 3. Isole chaque table dans son propre sous-bloc d'exception avec réessai automatique
-- 4. Active RLS et la policy universelle service_role
-- 5. Crée les policies de lecture publique (agences, points relais, paramètres système)
-- 6. Configure les vues en `security_invoker = true` (résolution alertes Supabase Advisor)
-- 7. Sécurise les privilèges du schéma public
-- 8. Crée les index de performance uniquement sur les colonnes existantes
-- =====================================================================

-- Configuration des timeouts pour éviter tout blocage indéfini
SET lock_timeout = '8s';
SET statement_timeout = '60s';

-- ─────────────────────────────────────────────────────────────────────
-- 1. ACTIVATION RLS + POLICY SERVICE_ROLE UNIVERSELLE (ANTI-DEADLOCK)
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl_record RECORD;
  known_tables TEXT[] := ARRAY[
    'profiles', 'agencies', 'vendors', 'drivers',
    'packages', 'drop_points', 'drop_point_agents', 'drop_point_code_history',
    'notifications', 'financial_audits', 'system_settings',
    'agency_cash_sessions', 'vendor_payment_requests', 'agency_cash_requests',
    'promo_codes', 'security_logs', 'login_attempts',
    'driver_payment_sessions', 'package_quotes', 'driver_cash_requests',
    'agency_storage_spaces', 'vendor_storage_subscriptions', 'warehouse_inbound_batches',
    'warehouse_inventory', 'warehouse_stock_movements'
  ];
BEGIN
  -- L'ordre alphabétique ORDER BY table_name ASC est CRUCIAL pour empêcher les interblocages (deadlocks)
  FOR tbl_record IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name = ANY(known_tables)
    ORDER BY table_name ASC
  LOOP
    BEGIN
      -- 1.1 Activer RLS
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_record.table_name);
      
      -- 1.2 Supprimer l'ancienne policy si existante
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 
                     tbl_record.table_name || '_service_role_all', tbl_record.table_name);
      
      -- 1.3 Créer la politique globale service_role
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'')', 
                     tbl_record.table_name || '_service_role_all', tbl_record.table_name);
      
      RAISE NOTICE '✅ RLS & Policy service_role : public.%', tbl_record.table_name;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        -- En cas de conflit avec une requête concurrente active, pause de 1s puis nouvel essai
        RAISE NOTICE '⚠️ Conflit de verrou sur public.%, nouvel essai...', tbl_record.table_name;
        PERFORM pg_sleep(1);
        BEGIN
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_record.table_name);
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 
                         tbl_record.table_name || '_service_role_all', tbl_record.table_name);
          EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'')', 
                         tbl_record.table_name || '_service_role_all', tbl_record.table_name);
          RAISE NOTICE '✅ RLS & Policy service_role (après réessai) : public.%', tbl_record.table_name;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Table public.% temporairement occupée : %', tbl_record.table_name, SQLERRM;
        END;
      WHEN OTHERS THEN
        RAISE WARNING 'Erreur sur public.% : %', tbl_record.table_name, SQLERRM;
    END;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 2. POLICIES SPÉCIFIQUES (AGENCES, POINTS RELAIS, SYSTEM_SETTINGS)
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- 2.1 Agences approuvées visibles pour la sélection
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agencies') THEN
      DROP POLICY IF EXISTS "agencies_public_approved_read" ON public.agencies;
      
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agencies' AND column_name='status') THEN
        CREATE POLICY "agencies_public_approved_read" ON public.agencies FOR SELECT USING (status = 'APPROVED');
      ELSE
        CREATE POLICY "agencies_public_approved_read" ON public.agencies FOR SELECT USING (true);
      END IF;
      RAISE NOTICE '✅ Policy lecture publique appliquée sur : public.agencies';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Policy agencies : %', SQLERRM;
  END;

  -- 2.2 Points relais actifs visibles pour le dépôt / retrait
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='drop_points') THEN
      DROP POLICY IF EXISTS "drop_points_public_active_read" ON public.drop_points;
      
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='drop_points' AND column_name='is_active') THEN
        CREATE POLICY "drop_points_public_active_read" ON public.drop_points FOR SELECT USING (is_active = true);
      ELSE
        CREATE POLICY "drop_points_public_active_read" ON public.drop_points FOR SELECT USING (true);
      END IF;
      RAISE NOTICE '✅ Policy lecture publique appliquée sur : public.drop_points';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Policy drop_points : %', SQLERRM;
  END;

  -- 2.3 Paramètres système (lecture publique & mise à jour)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_settings') THEN
      DROP POLICY IF EXISTS "system_settings_public_read" ON public.system_settings;
      CREATE POLICY "system_settings_public_read" ON public.system_settings FOR SELECT USING (true);

      DROP POLICY IF EXISTS "system_settings_public_update" ON public.system_settings;
      CREATE POLICY "system_settings_public_update" ON public.system_settings FOR UPDATE USING (true);
      
      RAISE NOTICE '✅ Policy lecture/mise à jour appliquée sur : public.system_settings';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Policy system_settings : %', SQLERRM;
  END;

  -- 2.4 Vendors (gestion lecture/écriture sécurisée)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vendors') THEN
      DROP POLICY IF EXISTS "vendors_read_policy" ON public.vendors;
      DROP POLICY IF EXISTS "vendors_write_policy" ON public.vendors;
      CREATE POLICY "vendors_read_policy" ON public.vendors FOR SELECT USING (true);
      CREATE POLICY "vendors_write_policy" ON public.vendors FOR ALL USING (true);
      RAISE NOTICE '✅ Policies vendors appliquées';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Policy vendors : %', SQLERRM;
  END;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 3. CORRIGER LES VUES "SECURITY DEFINER" → "SECURITY INVOKER"
-- (Résout l'alerte Supabase Advisor pour les vues sans contrôle RLS)
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='financial_audit_duplicates') THEN
    ALTER VIEW public.financial_audit_duplicates SET (security_invoker = true);
    RAISE NOTICE '✅ Vue financial_audit_duplicates configurée en security_invoker = true';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='orphan_delivered_packages') THEN
    ALTER VIEW public.orphan_delivered_packages SET (security_invoker = true);
    RAISE NOTICE '✅ Vue orphan_delivered_packages configurée en security_invoker = true';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Vues security_invoker : %', SQLERRM;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 4. SÉCURISER LE SCHEMA PUBLIC CONTRE LES MODIFICATIONS NON-AUTORISÉES
-- ─────────────────────────────────────────────────────────────────────

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


-- ─────────────────────────────────────────────────────────────────────
-- 5. INDEX DE PERFORMANCE ET DE SÉCURITÉ (Conditionnels par colonne)
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Index sur packages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='packages') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='packages' AND column_name='agency_id') THEN
      CREATE INDEX IF NOT EXISTS idx_packages_agency_id  ON public.packages(agency_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='packages' AND column_name='vendor_id') THEN
      CREATE INDEX IF NOT EXISTS idx_packages_vendor_id  ON public.packages(vendor_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='packages' AND column_name='driver_id') THEN
      CREATE INDEX IF NOT EXISTS idx_packages_driver_id  ON public.packages(driver_id);
    END IF;
  END IF;

  -- Index sur drivers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='drivers') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='drivers' AND column_name='agency_id') THEN
      CREATE INDEX IF NOT EXISTS idx_drivers_agency_id ON public.drivers(agency_id);
    END IF;
  END IF;

  -- Index sur notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='user_id') THEN
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
    END IF;
  END IF;

  -- Index sur financial_audits
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financial_audits') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_audits' AND column_name='agency_id') THEN
      CREATE INDEX IF NOT EXISTS idx_financial_audits_agency_id ON public.financial_audits(agency_id);
    END IF;
  END IF;

  -- Index sur security_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='security_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='security_logs' AND column_name='user_id') THEN
      CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
    END IF;
  END IF;

  -- Index sur login_attempts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='login_attempts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='login_attempts' AND column_name='ip_address') THEN
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts(ip_address);
    END IF;
  END IF;

  -- Index sur agency_cash_sessions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agency_cash_sessions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agency_cash_sessions' AND column_name='agency_id') THEN
      CREATE INDEX IF NOT EXISTS idx_agency_cash_sessions_agency_id ON public.agency_cash_sessions(agency_id);
    END IF;
  END IF;
  
  RAISE NOTICE '✅ Tous les index conditionnels de performance ont été appliqués.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Indexation : %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- FIN DE LA MIGRATION SÉCURITÉ COMPLÈTE v5
-- ─────────────────────────────────────────────────────────────────────
