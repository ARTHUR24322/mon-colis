-- ============================================================================
-- MIGRATION: Table des Notifications Temps Réel (Livreurs, Agences, Vendeurs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour requêtes performantes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Sécurité RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : l'utilisateur peut lire ses propres notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Politique d'insertion / mise à jour via service role
DROP POLICY IF EXISTS "Service role full access on notifications" ON notifications;
CREATE POLICY "Service role full access on notifications"
  ON notifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- Activer les événements temps réel Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignorer si déjà présent ou publication non gérée
  NULL;
END $$;
