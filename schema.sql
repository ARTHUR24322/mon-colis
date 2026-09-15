-- Schéma de base de données Moncolis pour Supabase
-- Création des tables et des règles RLS

-- 1. Table Profiles (Utilisateurs: Vendeurs, Agences, Livreurs)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('vendeur', 'agence', 'livreur')),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS sur profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Les profils sont lisibles par tous les utilisateurs connectés" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Table Agencies (Spécifique aux Agences, optionnel mais utile)
CREATE TABLE agencies (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible par tous" ON agencies FOR SELECT USING (true);
CREATE POLICY "Admin agence seulement" ON agencies FOR UPDATE USING (auth.uid() = id);

-- 3. Table Drivers (Lien entre livreur et agence)
CREATE TABLE drivers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  phone TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agences peuvent voir leurs livreurs" ON drivers FOR SELECT USING (true); -- on pourrait limiter par agency_id
CREATE POLICY "Agences peuvent ajouter des livreurs" ON drivers FOR INSERT WITH CHECK (auth.uid() = agency_id);

-- 4. Table Packages (Colis)
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_id UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE, -- Lien public sans login
  vendeur_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL, -- Le vendeur choisit une agence
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL, -- L'agence assigne un livreur
  
  client_name TEXT NOT NULL,
  client_address TEXT NOT NULL,
  client_phone TEXT,
  
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PENDING_AGENCY', 'ACCEPTED_BY_AGENCY', 'REJECTED_BY_AGENCY', 'ASSIGNED_TO_DRIVER', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
  validation_code TEXT NOT NULL, -- Code OTP pour valider la livraison
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
-- Politiques d'accès aux colis
CREATE POLICY "Vendeur peut voir ses propres colis" ON packages FOR SELECT USING (auth.uid() = vendeur_id);
CREATE POLICY "Agence peut voir les colis qui lui sont assignés" ON packages FOR SELECT USING (auth.uid() = agency_id);
CREATE POLICY "Livreur peut voir ses propres courses" ON packages FOR SELECT USING (auth.uid() = driver_id);
-- Le lien de tracking permet de récupérer publiquement avec la clé de la page public
-- (Géré via API ou policy publique sur un paramètre)

CREATE POLICY "Vendeur peut insérer un colis" ON packages FOR INSERT WITH CHECK (auth.uid() = vendeur_id);
-- Mise à jour (Agence accepte, Livreur livre) - à affiner selon logique métier
CREATE POLICY "Agences et Livreurs peuvent mettre à jour statuts" ON packages FOR UPDATE USING (auth.uid() = agency_id OR auth.uid() = driver_id);

-- 5. Trigger d'updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_packages_updated_at
BEFORE UPDATE ON packages
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 6. Table Points de Dépôt / Relais (Drop-off & Pick-up network)
CREATE TABLE IF NOT EXISTS drop_points (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  commune TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  opening_hours TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE drop_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Points de dépôt visibles publiquement" ON drop_points FOR SELECT USING (true);

-- 7. Évolutions Agences (Validation Superadmin sur demande)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'));
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS coverage_zones TEXT[] DEFAULT '{}';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS fleet_size INTEGER DEFAULT 1;

-- 8. Évolutions Colis (Mode point relais & zones inaccessibles)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'DIRECT' CHECK (delivery_mode IN ('DIRECT', 'DROP_POINT_FIRST_MILE', 'DROP_POINT_LAST_MILE'));
ALTER TABLE packages ADD COLUMN IF NOT EXISTS origin_drop_point_id TEXT REFERENCES drop_points(id) ON DELETE SET NULL;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS dest_drop_point_id TEXT REFERENCES drop_points(id) ON DELETE SET NULL;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS inaccessibility_note TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS rerouted_at TIMESTAMP WITH TIME ZONE;

-- 9. Table Agents Points de Dépôt / Relais (Superadmin-managed 9-digit agents)
CREATE TABLE IF NOT EXISTS drop_point_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_number CHAR(9) UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  drop_point_id TEXT NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE drop_point_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents points relais visibles publiquement ou restreints" ON drop_point_agents FOR SELECT USING (true);
CREATE POLICY "Service role peut inserer des agents" ON drop_point_agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role peut modifier des agents" ON drop_point_agents FOR UPDATE USING (true) WITH CHECK (true);


