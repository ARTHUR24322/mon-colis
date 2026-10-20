-- ============================================================================
-- MIGRATION: Identifiants Staff pour les membres d'équipe agence
-- Chaque membre (hors directeur) reçoit un identifiant unique lié à l'agence
-- Format : MC-XXX-NNNN (ex: MC-KIN-0042)
-- ============================================================================

-- 1. Ajouter la colonne staff_id à agency_members
ALTER TABLE agency_members
  ADD COLUMN IF NOT EXISTS staff_id TEXT UNIQUE;

-- 2. Index pour recherche rapide au login par staff_id
CREATE INDEX IF NOT EXISTS idx_agency_members_staff_id ON agency_members(staff_id) WHERE staff_id IS NOT NULL;

-- 3. Créer une séquence globale pour les numéros de staff
CREATE SEQUENCE IF NOT EXISTS agency_staff_seq START 1 INCREMENT 1;

-- 4. Générer des staff_id pour les membres existants (non-directeurs sans staff_id)
-- Format : MC-[3 premières lettres agence en majuscule]-[numéro 4 chiffres]
UPDATE agency_members am
SET staff_id = 'MC-' ||
    UPPER(LEFT(COALESCE(
        (SELECT REGEXP_REPLACE(a.name, '[^A-Za-z]', '', 'g') FROM agencies a WHERE a.id = am.agency_id LIMIT 1),
        'AGC'
    ), 3)) ||
    '-' ||
    LPAD(CAST(nextval('agency_staff_seq') AS TEXT), 4, '0')
WHERE staff_id IS NULL
  AND role != 'directeur';

-- 5. Vérification
SELECT id, name, role, email, staff_id, agency_id FROM agency_members ORDER BY created_at;
