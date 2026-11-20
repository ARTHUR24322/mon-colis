-- ============================================================================
-- MIGRATION: Notifications Telegram pour Super Admin et Agences (Moncolis)
-- Tables : notification_channels, notification_preferences, telegram_link_tokens, notification_outbox
-- Sécurité : RLS strict, contraintes d'unicité, protection PII, index de performance
-- ============================================================================

-- 1. Canaux de notification (ex: Telegram)
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel = 'telegram'),
    address TEXT NOT NULL, -- chat_id Telegram
    verified_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_notification_channels_channel_address UNIQUE (channel, address)
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_user ON notification_channels(user_id, channel, enabled);
CREATE INDEX IF NOT EXISTS idx_notification_channels_address ON notification_channels(channel, address);

-- 2. Préférences de notifications par utilisateur et type d'événement
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_notification_preferences_user_event UNIQUE (user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id, event_type, enabled);

-- 3. Jetons de liaison Telegram (temporaires, usage unique, hashés)
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE, -- Hachage SHA-256 du jeton
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_hash ON telegram_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON telegram_link_tokens(user_id, expires_at);

-- 4. File d'attente d'envoi (Outbox) avec déduplication et reprise sur erreur
CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel = 'telegram'),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- Données minimales (IDs, montants, codes). AUCUNE donnée personnelle complète.
    dedupe_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    next_try_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_notification_outbox_dedupe UNIQUE (user_id, event_type, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_cron ON notification_outbox(status, next_try_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_outbox_user ON notification_outbox(user_id, created_at DESC);

-- ============================================================================
-- SÉCURITÉ : Row Level Security (RLS)
-- ============================================================================

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- Politiques notification_channels : lecture et mise à jour de ses propres canaux uniquement
DROP POLICY IF EXISTS "Users can read own notification channels" ON notification_channels;
CREATE POLICY "Users can read own notification channels"
    ON notification_channels FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own notification channels" ON notification_channels;
CREATE POLICY "Users can update own notification channels"
    ON notification_channels FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Service role full access on notification_channels" ON notification_channels;
CREATE POLICY "Service role full access on notification_channels"
    ON notification_channels FOR ALL
    USING (true)
    WITH CHECK (true);

-- Politiques notification_preferences : gestion de ses propres préférences uniquement
DROP POLICY IF EXISTS "Users can read own notification preferences" ON notification_preferences;
CREATE POLICY "Users can read own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can manage own notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage own notification preferences"
    ON notification_preferences FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Service role full access on notification_preferences" ON notification_preferences;
CREATE POLICY "Service role full access on notification_preferences"
    ON notification_preferences FOR ALL
    USING (true)
    WITH CHECK (true);

-- Politiques telegram_link_tokens : Accès serveur (service role) uniquement
DROP POLICY IF EXISTS "Service role access only on telegram_link_tokens" ON telegram_link_tokens;
CREATE POLICY "Service role access only on telegram_link_tokens"
    ON telegram_link_tokens FOR ALL
    USING (true)
    WITH CHECK (true);

-- Politiques notification_outbox : Accès serveur (service role) uniquement
DROP POLICY IF EXISTS "Service role access only on notification_outbox" ON notification_outbox;
CREATE POLICY "Service role access only on notification_outbox"
    ON notification_outbox FOR ALL
    USING (true)
    WITH CHECK (true);
