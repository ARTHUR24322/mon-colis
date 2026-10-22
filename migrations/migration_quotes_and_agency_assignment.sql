-- =====================================================================
-- Migration : Devis colis (package_quotes) + colonnes attribution agence
-- Fichier : migration_quotes_and_agency_assignment.sql
-- À exécuter dans Supabase SQL Editor
-- =====================================================================

-- 1. TABLE DES DEVIS (snapshot figé au moment de l'acceptation vendeur)
CREATE TABLE IF NOT EXISTS package_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,

  -- Détail du devis (snapshot figé)
  prix_marchandise NUMERIC NOT NULL DEFAULT 0,
  frais_livraison NUMERIC NOT NULL DEFAULT 0,
  montant_encaisser NUMERIC NOT NULL DEFAULT 0,  -- paiement à la livraison
  paid_by_client BOOLEAN NOT NULL DEFAULT true,
  devise TEXT NOT NULL DEFAULT 'USD',
  taux_change NUMERIC NOT NULL DEFAULT 2800,       -- taux figé au moment du devis
  poids_kg NUMERIC NOT NULL DEFAULT 1,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  commune_destination TEXT,
  tarif_commune NUMERIC DEFAULT 0,
  tarif_poids NUMERIC DEFAULT 0,

  -- Statut et durée de validité
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,   -- 24h par défaut
  accepted_at TIMESTAMP WITH TIME ZONE,            -- moment d'acceptation vendeur
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_package_quotes_package_id ON package_quotes(package_id);
CREATE INDEX IF NOT EXISTS idx_package_quotes_status ON package_quotes(status);

ALTER TABLE package_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "package_quotes_select" ON package_quotes FOR SELECT USING (true);
CREATE POLICY "package_quotes_insert" ON package_quotes FOR INSERT WITH CHECK (true);
CREATE POLICY "package_quotes_update" ON package_quotes FOR UPDATE USING (true) WITH CHECK (true);

-- 2. COLONNE SUR PACKAGES : référence au devis accepté
ALTER TABLE packages ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES package_quotes(id) ON DELETE SET NULL;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS quote_accepted_at TIMESTAMP WITH TIME ZONE;

-- Index pour accès rapide
CREATE INDEX IF NOT EXISTS idx_packages_quote_id ON packages(quote_id) WHERE quote_id IS NOT NULL;

-- 3. STATUT SUPPLÉMENTAIRE : QUOTE_PENDING (vendeur doit accepter un devis)
DO $$
BEGIN
  ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_status_check;
  ALTER TABLE packages ADD CONSTRAINT packages_status_check
    CHECK (status IN (
      'CREATED',
      'QUOTE_PENDING',
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
  RAISE NOTICE 'Mise à jour contrainte status packages : %', SQLERRM;
END $$;

-- 4. Table security_logs (pour les connexions agence)
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_ip TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  target_role TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_actor_ip ON security_logs(actor_ip);

ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_logs_insert" ON security_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "security_logs_select_admin" ON security_logs FOR SELECT USING (true);
