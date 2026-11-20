/**
 * Tests unitaires – notification-outbox.ts
 * Vérifie : idempotence, préférences, droits par rôle, délais de réessai.
 * Supabase entièrement simulé.
 */

import {
  enqueueNotification,
  enqueueNotificationForAgencyMembers,
  getRetryDelaySeconds,
} from '../notification-outbox';

// ---------------------------------------------------------------------------
// Registre mutable pour les résultats simulés
// (accessible AVANT que jest.mock soit hissé)
// ---------------------------------------------------------------------------

let mockChannelResult: { data: Record<string, unknown> | null; error: { code: string } | null } = {
  data: { id: 'chan-1', enabled: true, verified_at: '2024-01-01T00:00:00Z' },
  error: null,
};
let mockPrefResult: { data: { enabled: boolean } | null; error: null } = {
  data: null,
  error: null,
};
let mockInsertResult: { error: { code: string } | null } = { error: null };
let mockMembersResult: { data: Array<{ id: string; role: string; is_active: boolean }> | null; error: null } = {
  data: [],
  error: null,
};

// ---------------------------------------------------------------------------
// Mock Supabase Admin (inline, pas de référence à des variables externes)
// ---------------------------------------------------------------------------

jest.mock('@/utils/supabase/admin', () => {
  // Chaîne fluide générique
  function makeChain(resolveWith: () => unknown) {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in',
                     'is', 'lt', 'lte', 'gte', 'order', 'limit'];
    for (const m of methods) {
      chain[m] = jest.fn(() => chain);
    }
    chain['maybeSingle'] = jest.fn(resolveWith);
    chain['then'] = jest.fn((cb: (v: unknown) => unknown) =>
      Promise.resolve(resolveWith()).then(cb)
    );
    return chain;
  }

  return {
    supabaseAdmin: {
      from: jest.fn((table: string) => {
        if (table === 'notification_channels') {
          return makeChain(() => Promise.resolve(mockChannelResult));
        }
        if (table === 'notification_preferences') {
          return makeChain(() => Promise.resolve(mockPrefResult));
        }
        if (table === 'notification_outbox') {
          const chain = makeChain(() => Promise.resolve(mockInsertResult));
          chain['insert'] = jest.fn(() => Promise.resolve(mockInsertResult));
          return chain;
        }
        if (table === 'agency_members') {
          return makeChain(() => Promise.resolve(mockMembersResult));
        }
        // tables secondaires (financial_audit_logs, etc.)
        return makeChain(() => Promise.resolve({ data: null, error: null }));
      }),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers de réinitialisation
// ---------------------------------------------------------------------------

function resetMocks() {
  mockChannelResult = {
    data: { id: 'chan-1', enabled: true, verified_at: '2024-01-01T00:00:00Z' },
    error: null,
  };
  mockPrefResult = { data: null, error: null };
  mockInsertResult = { error: null };
  mockMembersResult = { data: [], error: null };
  jest.clearAllMocks();
}

beforeEach(resetMocks);

// ---------------------------------------------------------------------------
// getRetryDelaySeconds
// ---------------------------------------------------------------------------

describe('getRetryDelaySeconds', () => {
  it('tentative 0 → 30s', () => expect(getRetryDelaySeconds(0)).toBe(30));
  it('tentative 1 → 2min (120s)', () => expect(getRetryDelaySeconds(1)).toBe(120));
  it('tentative 2 → 10min (600s)', () => expect(getRetryDelaySeconds(2)).toBe(600));
  it('tentative 3 → 30min (1800s)', () => expect(getRetryDelaySeconds(3)).toBe(1800));
  it('tentative 4+ → 1h (3600s)', () => {
    expect(getRetryDelaySeconds(4)).toBe(3600);
    expect(getRetryDelaySeconds(99)).toBe(3600);
  });
});

// ---------------------------------------------------------------------------
// Helpers pour compter les appels à notification_outbox
// ---------------------------------------------------------------------------

async function getOutboxCallCount(): Promise<number> {
  const { supabaseAdmin } = await import('@/utils/supabase/admin');
  return (supabaseAdmin.from as jest.Mock).mock.calls
    .filter(([table]: [string]) => table === 'notification_outbox').length;
}

// ---------------------------------------------------------------------------
// Canal absent ou désactivé
// ---------------------------------------------------------------------------

describe('enqueueNotification – canal absent/désactivé', () => {
  it('ne touche pas l\'outbox si aucun canal', async () => {
    mockChannelResult = { data: null, error: null };

    await enqueueNotification({
      userId: 'superadmin-master-id',
      eventType: 'ECART_VERSEMENT_SUPERADMIN',
      payload: { reference: 'S-001', amount: '500' },
      dedupeKey: 'ECART_VERSEMENT_SUPERADMIN:S-001:2024-01-15T14',
    });

    expect(await getOutboxCallCount()).toBe(0);
  });

  it('ne touche pas l\'outbox si canal désactivé', async () => {
    mockChannelResult = {
      data: { id: 'chan-1', enabled: false, verified_at: '2024-01-01T00:00:00Z' },
      error: null,
    };

    await enqueueNotification({
      userId: 'superadmin-master-id',
      eventType: 'ECART_VERSEMENT_SUPERADMIN',
      payload: { reference: 'S-002' },
      dedupeKey: 'ECART_VERSEMENT_SUPERADMIN:S-002:2024-01-15T14',
    });

    expect(await getOutboxCallCount()).toBe(0);
  });

  it('ne touche pas l\'outbox si canal non vérifié', async () => {
    mockChannelResult = {
      data: { id: 'chan-1', enabled: true, verified_at: null },
      error: null,
    };

    await enqueueNotification({
      userId: 'superadmin-master-id',
      eventType: 'CREDIT_RELAIS_BAS',
      payload: { reference: 'RP-01', amount: '50' },
      dedupeKey: 'CREDIT_RELAIS_BAS:RP-01:2024',
    });

    expect(await getOutboxCallCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Préférence désactivée
// ---------------------------------------------------------------------------

describe('enqueueNotification – préférence désactivée', () => {
  it('n\'insère pas si l\'utilisateur a désactivé ce type d\'alerte', async () => {
    mockPrefResult = { data: { enabled: false }, error: null };

    await enqueueNotification({
      userId: 'superadmin-master-id',
      eventType: 'CONNEXION_SUSPECTE',
      payload: { identifier: 'admin', attempts: '5', ip: '1.2.3.4' },
      dedupeKey: 'CONNEXION_SUSPECTE:admin:2024-01-15T14',
    });

    expect(await getOutboxCallCount()).toBe(0);
  });

  it('insère si la préférence est absente (défaut activé)', async () => {
    mockPrefResult = { data: null, error: null }; // Pas de préférence = activé par défaut

    await enqueueNotification({
      userId: 'superadmin-master-id',
      eventType: 'CONNEXION_SUSPECTE',
      payload: { identifier: 'admin', attempts: '5', ip: '1.2.3.4' },
      dedupeKey: 'CONNEXION_SUSPECTE:admin:2024-01-15T14',
    });

    expect(await getOutboxCallCount()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Droits par rôle
// ---------------------------------------------------------------------------

describe('enqueueNotification – droits par rôle', () => {
  it('n\'insère pas un événement superadmin pour un membre agence', async () => {
    await enqueueNotification({
      userId: 'member-123',
      eventType: 'ECART_VERSEMENT_SUPERADMIN',
      payload: { reference: 'S-003' },
      dedupeKey: 'ECART_VERSEMENT_SUPERADMIN:S-003:2024',
      agencyId: 'agency-1',
      agencyRole: 'directeur',
    });

    expect(await getOutboxCallCount()).toBe(0);
  });

  it('n\'insère pas si le rôle comptable n\'a pas accès à COLIS_A_RECUPERER_RELAIS', async () => {
    await enqueueNotification({
      userId: 'comptable-456',
      eventType: 'COLIS_A_RECUPERER_RELAIS',
      payload: { reference: 'MC-100', drop_point_name: 'Relais Nord' },
      dedupeKey: 'COLIS_A_RECUPERER_RELAIS:MC-100:2024',
      agencyId: 'agency-1',
      agencyRole: 'comptable',
    });

    expect(await getOutboxCallCount()).toBe(0);
  });

  it('insère correctement pour un directeur éligible (NOUVEAU_COLIS_AGENCE)', async () => {
    await enqueueNotification({
      userId: 'directeur-789',
      eventType: 'NOUVEAU_COLIS_AGENCE',
      payload: { reference: 'MC-200', id: 'pkg-200' },
      dedupeKey: 'NOUVEAU_COLIS_AGENCE:MC-200:2024-01-15T10',
      agencyId: 'agency-1',
      agencyRole: 'directeur',
    });

    expect(await getOutboxCallCount()).toBeGreaterThan(0);
  });

  it('insère pour gestionnaire éligible (VERSEMENT_EN_ATTENTE)', async () => {
    await enqueueNotification({
      userId: 'gestionnaire-001',
      eventType: 'VERSEMENT_EN_ATTENTE',
      payload: { reference: 'VRS-001', amount: '250 USD' },
      dedupeKey: 'VERSEMENT_EN_ATTENTE:VRS-001:2024',
      agencyId: 'agency-1',
      agencyRole: 'gestionnaire',
    });

    expect(await getOutboxCallCount()).toBeGreaterThan(0);
  });

  it('insère correctement pour le super admin (ID fixe)', async () => {
    await enqueueNotification({
      userId: 'superadmin-master-id',
      eventType: 'PAIEMENT_ECHEC',
      payload: { reference: 'PAY-001', amount: '1000 USD' },
      dedupeKey: 'PAIEMENT_ECHEC:PAY-001:2024',
    });

    expect(await getOutboxCallCount()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Idempotence (conflict 23505)
// ---------------------------------------------------------------------------

describe('enqueueNotification – idempotence', () => {
  it('ne propage pas d\'erreur si dedupe_key existe déjà (23505 unique_violation)', async () => {
    mockInsertResult = { error: { code: '23505' } };

    await expect(
      enqueueNotification({
        userId: 'superadmin-master-id',
        eventType: 'CREDIT_RELAIS_BAS',
        payload: { reference: 'RP-01', amount: '50' },
        dedupeKey: 'CREDIT_RELAIS_BAS:RP-01:2024-01-15T14',
      })
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Robustesse (ne lève JAMAIS d'erreur vers l'appelant)
// ---------------------------------------------------------------------------

describe('enqueueNotification – robustesse', () => {
  it('ne lève jamais d\'erreur même si Supabase est indisponible', async () => {
    mockChannelResult = { data: null, error: { code: 'PGRST000' } };

    await expect(
      enqueueNotification({
        userId: 'superadmin-master-id',
        eventType: 'PAIEMENT_ECHEC',
        payload: { reference: 'PAY-001' },
        dedupeKey: 'PAIEMENT_ECHEC:PAY-001:2024',
      })
    ).resolves.toBeUndefined();
  });

  it('ne lève jamais d\'erreur même si insert échoue (erreur non-23505)', async () => {
    mockInsertResult = { error: { code: 'PGRST301' } };

    await expect(
      enqueueNotification({
        userId: 'superadmin-master-id',
        eventType: 'DEMANDE_ADHESION_AGENCE',
        payload: { reference: 'AGC-001' },
        dedupeKey: 'DEMANDE_ADHESION_AGENCE:AGC-001:2024',
      })
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// enqueueNotificationForAgencyMembers
// ---------------------------------------------------------------------------

describe('enqueueNotificationForAgencyMembers', () => {
  it('fonctionne sans erreur si aucun membre actif', async () => {
    mockMembersResult = { data: [], error: null };

    await expect(
      enqueueNotificationForAgencyMembers({
        agencyId: 'agency-abc',
        eventType: 'NOUVEAU_COLIS_AGENCE',
        payload: { reference: 'MC-999' },
        dedupeKey: 'NOUVEAU_COLIS_AGENCE:MC-999:2024',
      })
    ).resolves.toBeUndefined();
  });

  it('ne lève pas d\'erreur si Supabase agency_members échoue', async () => {
    mockMembersResult = { data: null, error: null };

    await expect(
      enqueueNotificationForAgencyMembers({
        agencyId: 'agency-xyz',
        eventType: 'COLIS_REFUSE_RELAIS',
        payload: { reference: 'MC-888', drop_point_name: 'Relais Sud' },
        dedupeKey: 'COLIS_REFUSE_RELAIS:MC-888:2024',
      })
    ).resolves.toBeUndefined();
  });
});
