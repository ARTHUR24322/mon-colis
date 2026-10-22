-- Table pour les paramètres globaux de l'agence (Sécurité & Anti-Fraude)
CREATE TABLE IF NOT EXISTS agency_settings (
    agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
    require_manager_approval BOOLEAN DEFAULT true, -- Maker/Checker
    enforce_hours BOOLEAN DEFAULT false,           -- Verrouillage Horaires
    allowed_start_time TIME DEFAULT '08:00',
    allowed_end_time TIME DEFAULT '18:30',
    volume_discount_enabled BOOLEAN DEFAULT false,
    volume_threshold INTEGER DEFAULT 10,           -- nb de colis
    volume_discount_percent DECIMAL DEFAULT 10.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table pour les Codes Promo Marketing
CREATE TABLE IF NOT EXISTS agency_promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    discount_percent DECIMAL NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(agency_id, code) -- Un code promo est unique par agence
);

-- Active RLS sur les deux tables
ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_promo_codes ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour agency_settings
CREATE POLICY "Les agences voient leurs propres paramètres"
    ON agency_settings FOR SELECT
    USING (auth.uid() = agency_id);

CREATE POLICY "Les agences modifient leurs propres paramètres"
    ON agency_settings FOR UPDATE
    USING (auth.uid() = agency_id);

CREATE POLICY "Les agences insèrent leurs propres paramètres"
    ON agency_settings FOR INSERT
    WITH CHECK (auth.uid() = agency_id);

-- Politiques RLS pour agency_promo_codes
CREATE POLICY "Les agences gèrent leurs codes promo"
    ON agency_promo_codes FOR ALL
    USING (auth.uid() = agency_id);
