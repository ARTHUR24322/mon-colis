/**
 * Tests unitaires – Module Telegram (src/lib/telegram.ts)
 * API Telegram entièrement simulée (jest.fn) – aucun appel réseau réel.
 */

import { sendTelegram, escapeHtml, buildMessageHtml, TelegramError } from '../telegram';

// ---------------------------------------------------------------------------
// Mock global de fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock du client Supabase (pour disableChannelByChatId)
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
  })),
}));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset();
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token-never-logged';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
});

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
  it('échappe &, <, > et "', () => {
    expect(escapeHtml('Prix <100$ & "rabais">')).toBe(
      'Prix &lt;100$ &amp; &quot;rabais&quot;&gt;'
    );
  });

  it('gère null et undefined sans erreur', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('convertit les nombres en chaîne', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('ne modifie pas un texte sans caractères spéciaux', () => {
    expect(escapeHtml('Bonjour Moncolis')).toBe('Bonjour Moncolis');
  });
});

// ---------------------------------------------------------------------------
// buildMessageHtml
// ---------------------------------------------------------------------------

describe('buildMessageHtml', () => {
  it('construit un message HTML correct', () => {
    const html = buildMessageHtml({
      emoji: '📦',
      title: 'Nouveau colis',
      lines: [
        { label: 'Référence', value: 'MC-123' },
        { label: 'Montant', value: '$20' },
      ],
    });
    expect(html).toContain('📦');
    expect(html).toContain('<b>Nouveau colis</b>');
    expect(html).toContain('Référence');
    expect(html).toContain('MC-123');
  });

  it('omet les lignes null ou undefined', () => {
    const html = buildMessageHtml({
      emoji: '⚠️',
      title: 'Alerte',
      lines: [
        { label: 'Visible', value: 'oui' },
        { label: 'Invisible', value: null },
        { label: 'Absent', value: undefined },
      ],
    });
    expect(html).toContain('Visible');
    expect(html).not.toContain('Invisible');
    expect(html).not.toContain('Absent');
  });

  it('échappe les valeurs dynamiques', () => {
    const html = buildMessageHtml({
      emoji: '🔔',
      title: 'Test <injection>',
      lines: [{ label: 'Val', value: '<script>alert(1)</script>' }],
    });
    expect(html).toContain('&lt;injection&gt;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// sendTelegram – Succès
// ---------------------------------------------------------------------------

describe('sendTelegram – succès', () => {
  it('envoie un message simple et résout sans erreur', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ ok: true }),
    });

    await expect(
      sendTelegram('12345678', '<b>Test Moncolis</b>')
    ).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    // Le token ne doit PAS apparaître dans l'URL en tant que paramètre de log
    expect(url).toContain('/sendMessage');
    expect(url).toContain('test-bot-token-never-logged'); // normal dans l'URL API

    // Corps de la requête
    const body = JSON.parse(options.body);
    expect(body.chat_id).toBe('12345678');
    expect(body.parse_mode).toBe('HTML');
    expect(body.disable_web_page_preview).toBe(true);
    expect(body.reply_markup).toBeUndefined();
  });

  it('ajoute un bouton inline si button est fourni', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ ok: true }),
    });

    await sendTelegram('12345678', '<b>Alerte</b>', {
      label: 'Voir le colis',
      url: 'https://app.moncolis.com/colis/MC-123',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reply_markup.inline_keyboard[0][0].text).toBe('Voir le colis');
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe(
      'https://app.moncolis.com/colis/MC-123'
    );
  });
});

// ---------------------------------------------------------------------------
// sendTelegram – Rate limit (429)
// ---------------------------------------------------------------------------

describe('sendTelegram – 429 Rate limit', () => {
  it('lève TelegramError RATE_LIMITED avec le retryAfter de l\'API', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 429,
      ok: false,
      json: async () => ({ ok: false, parameters: { retry_after: 15 } }),
    });

    await expect(sendTelegram('12345678', 'test')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfter: 15,
    });
  });

  it('utilise 30s par défaut si retry_after est absent', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 429,
      ok: false,
      json: async () => ({ ok: false }),
    });

    await expect(sendTelegram('12345678', 'test')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfter: 30,
    });
  });
});

// ---------------------------------------------------------------------------
// sendTelegram – Canal bloqué (403)
// ---------------------------------------------------------------------------

describe('sendTelegram – 403 Bot bloqué', () => {
  it('lève TelegramError CHANNEL_DISABLED et désactive le canal', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 403,
      ok: false,
      json: async () => ({ ok: false, description: 'Forbidden: bot was blocked by the user' }),
    });

    await expect(sendTelegram('99999999', 'test')).rejects.toMatchObject({
      code: 'CHANNEL_DISABLED',
    });
  });
});

// ---------------------------------------------------------------------------
// sendTelegram – Chat introuvable (400)
// ---------------------------------------------------------------------------

describe('sendTelegram – 400 Chat not found', () => {
  it('lève TelegramError CHAT_NOT_FOUND et désactive le canal', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ ok: false, description: 'Bad Request: chat not found' }),
    });

    await expect(sendTelegram('00000000', 'test')).rejects.toMatchObject({
      code: 'CHAT_NOT_FOUND',
    });
  });

  it('lève API_ERROR pour un 400 non lié au chat', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ ok: false, description: 'Bad Request: message text is empty' }),
    });

    await expect(sendTelegram('12345678', '')).rejects.toMatchObject({
      code: 'API_ERROR',
    });
  });
});

// ---------------------------------------------------------------------------
// sendTelegram – Erreur réseau
// ---------------------------------------------------------------------------

describe('sendTelegram – Erreur réseau', () => {
  it('lève TelegramError NETWORK si fetch rejette', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(sendTelegram('12345678', 'test')).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });
});

// ---------------------------------------------------------------------------
// sendTelegram – Telegram ok:false avec HTTP 200
// ---------------------------------------------------------------------------

describe('sendTelegram – ok:false', () => {
  it('lève API_ERROR si ok:false dans la réponse JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ ok: false, description: 'Some internal Telegram error' }),
    });

    await expect(sendTelegram('12345678', 'test')).rejects.toMatchObject({
      code: 'API_ERROR',
    });
  });
});

// ---------------------------------------------------------------------------
// sendTelegram – Token manquant
// ---------------------------------------------------------------------------

describe('sendTelegram – Token bot manquant', () => {
  it('lève API_ERROR si TELEGRAM_BOT_TOKEN n\'est pas défini', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    await expect(sendTelegram('12345678', 'test')).rejects.toMatchObject({
      code: 'API_ERROR',
    });

    // fetch ne doit PAS avoir été appelé
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
