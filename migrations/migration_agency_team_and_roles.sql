-- ============================================================================
-- MIGRATION: Multi-Agents & Rôles Espace Agence (/agence)
-- ============================================================================

-- 1. Table des membres d'équipe de l'agence
CREATE TABLE IF NOT EXISTS agency_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    phone TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('directeur', 'gestionnaire', 'agent_comptoir', 'comptable', 'lecture_seule')),
    password_hash TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    invited_by UUID,
    invite_token TEXT,
    invite_expires_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(agency_id, email)
);

-- Index pour recherche rapide lors du login
CREATE INDEX IF NOT EXISTS idx_agency_members_lookup ON agency_members(email, is_active);
CREATE INDEX IF NOT EXISTS idx_agency_members_agency ON agency_members(agency_id);

-- RLS
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les membres peuvent lire leur propre agence"
    ON agency_members FOR SELECT
    USING (agency_id = auth.uid());

CREATE POLICY "Directeur gère les membres de son agence"
    ON agency_members FOR ALL
    USING (agency_id = auth.uid());

-- 2. Migrer / Initialiser chaque agence existante avec son directeur
INSERT INTO agency_members (agency_id, email, phone, name, role, password_hash, is_active)
SELECT 
    p.id as agency_id,
    p.email,
    p.phone,
    p.name,
    'directeur' as role,
    p.password_hash,
    true as is_active
FROM profiles p
JOIN agencies a ON a.id = p.id
WHERE p.role = 'agence'
ON CONFLICT (agency_id, email) DO NOTHING;
