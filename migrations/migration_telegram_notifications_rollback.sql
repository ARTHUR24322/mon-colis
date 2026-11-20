-- ============================================================================
-- ROLLBACK: Suppression des tables et politiques de notifications Telegram
-- ============================================================================

DROP TABLE IF EXISTS notification_outbox CASCADE;
DROP TABLE IF EXISTS telegram_link_tokens CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS notification_channels CASCADE;
