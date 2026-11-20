import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  SUPERADMIN_EVENTS,
  AGENCY_EVENTS,
  getAllowedEventsForUser,
  SuperAdminEventType,
  AgencyEventType,
} from '@/types/telegram-notifications';

describe('Étape 2 : Schéma et Migrations Notifications Telegram', () => {
  const migrationPath = path.join(process.cwd(), 'migrations', 'migration_telegram_notifications.sql');
  const rollbackPath = path.join(process.cwd(), 'migrations', 'migration_telegram_notifications_rollback.sql');

  it('le fichier de migration existe et contient les 4 tables requises', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('CREATE TABLE IF NOT EXISTS notification_channels');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS notification_preferences');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS telegram_link_tokens');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS notification_outbox');
  });

  it('le fichier de migration applique la sécurité RLS sur toutes les tables', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;');

    expect(content).toContain('CREATE POLICY "Users can read own notification channels"');
    expect(content).toContain('CREATE POLICY "Service role access only on telegram_link_tokens"');
    expect(content).toContain('CREATE POLICY "Service role access only on notification_outbox"');
  });

  it('le fichier de migration contient les contraintes d’unicité et d’indexation requises', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');

    // notification_channels unicité (channel, address)
    expect(content).toContain('uq_notification_channels_channel_address UNIQUE (channel, address)');

    // notification_preferences unicité (user_id, event_type)
    expect(content).toContain('uq_notification_preferences_user_event UNIQUE (user_id, event_type)');

    // telegram_link_tokens token_hash UNIQUE
    expect(content).toContain('token_hash TEXT NOT NULL UNIQUE');

    // notification_outbox unicité (user_id, event_type, dedupe_key)
    expect(content).toContain('uq_notification_outbox_dedupe UNIQUE (user_id, event_type, dedupe_key)');

    // Index pour cron outbox
    expect(content).toContain('idx_notification_outbox_cron');
  });

  it('le fichier de rollback existe et nettoie proprement les 4 tables', () => {
    expect(fs.existsSync(rollbackPath)).toBe(true);
    const content = fs.readFileSync(rollbackPath, 'utf-8');

    expect(content).toContain('DROP TABLE IF EXISTS notification_outbox CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS telegram_link_tokens CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS notification_preferences CASCADE;');
    expect(content).toContain('DROP TABLE IF EXISTS notification_channels CASCADE;');
  });

  it('le modèle de rôles et permissions par défaut respecte scrupuleusement la matrice', () => {
    // 1. Superadmin a accès aux 8 événements superadmin
    const superAdminEvents = getAllowedEventsForUser({ isSuperAdmin: true });
    expect(superAdminEvents.length).toBe(8);
    const superAdminTypes = superAdminEvents.map(e => e.type);
    expect(superAdminTypes).toContain('ECART_VERSEMENT_SUPERADMIN');
    expect(superAdminTypes).toContain('CONNEXION_SUSPECTE');
    expect(superAdminTypes).toContain('PIN_RELAIS_REINITIALISE');
    expect(superAdminTypes).toContain('CREDIT_RELAIS_BAS');
    expect(superAdminTypes).toContain('COLIS_SANS_MOUVEMENT');
    expect(superAdminTypes).toContain('RECLAMATION_VENDEUR');
    expect(superAdminTypes).toContain('DEMANDE_ADHESION_AGENCE');
    expect(superAdminTypes).toContain('PAIEMENT_ECHEC');

    // 2. Agence - Directeur : a accès à tous les événements agence
    const directeurEvents = getAllowedEventsForUser({ agencyRole: 'directeur' });
    expect(directeurEvents.length).toBe(6);

    // 3. Agence - Agent de comptoir : uniquement versements en attente
    const comptoirEvents = getAllowedEventsForUser({ agencyRole: 'agent_comptoir' });
    expect(comptoirEvents.length).toBe(1);
    expect(comptoirEvents[0].type).toBe('VERSEMENT_EN_ATTENTE');

    // 4. Agence - Comptable : versements et écarts de caisse
    const comptableEvents = getAllowedEventsForUser({ agencyRole: 'comptable' });
    const comptableTypes = comptableEvents.map(e => e.type);
    expect(comptableTypes).toContain('VERSEMENT_EN_ATTENTE');
    expect(comptableTypes).toContain('ECART_CAISSE_AGENCE');
    expect(comptableTypes).not.toContain('NOUVEAU_COLIS_AGENCE');

    // 5. Agence - Lecture seule : aucune notification autorisée
    const lectureSeuleEvents = getAllowedEventsForUser({ agencyRole: 'lecture_seule' });
    expect(lectureSeuleEvents.length).toBe(0);
  });

  it('le hachage de jeton de liaison produit un SHA-256 valide et non réversible', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    expect(rawToken.length).toBe(64);
    expect(hash.length).toBe(64);
    expect(hash).not.toBe(rawToken);

    // Même hash sur ré-exécution
    const verifyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    expect(verifyHash).toBe(hash);
  });
});
