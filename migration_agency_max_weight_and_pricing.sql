-- =====================================================================
-- Migration : Poids maximum agence et devise de la grille tarifaire
-- Fichier : migration_agency_max_weight_and_pricing.sql
-- =====================================================================

-- 1. Ajouter la colonne max_weight_kg (Poids max accepté par l'agence, ex: 30 kg)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS max_weight_kg NUMERIC DEFAULT 30;

-- 2. Ajouter la devise de la grille tarifaire (par défaut 'FC' pour la RDC)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS devise_grille TEXT DEFAULT 'FC';

-- 3. Mettre à jour les colonnes de distance et tarifs sur packages si absentes
ALTER TABLE packages ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 1;

-- 4. Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_agencies_max_weight ON agencies(max_weight_kg);
