'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ExternalLink,
  Unlink,
  Send,
  Loader2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

interface EventSetting {
  type: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface ChannelState {
  linked: boolean;
  verified_at: string | null;
  enabled: boolean;
}

export default function TelegramNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ChannelState>({ linked: false, verified_at: null, enabled: false });
  const [events, setEvents] = useState<EventSetting[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Génération de lien / QR code
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkData, setLinkData] = useState<{ link: string; expiresAt: number } | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Envoi message test
  const [sendingTest, setSendingTest] = useState(false);

  // Déliaison
  const [unlinking, setUnlinking] = useState(false);

  // Charger les paramètres actuels
  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications/settings');
      if (res.ok) {
        const data = await res.json();
        setChannel(data.channel);
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Erreur chargement réglages Telegram:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (linkData?.link) {
      QRCode.toString(linkData.link, { type: 'svg', margin: 1 })
        .then(setQrSvg)
        .catch((err) => console.warn('QR SVG error:', err));
      QRCode.toDataURL(linkData.link, { width: 200, margin: 1 })
        .then(setQrDataUrl)
        .catch((err) => console.warn('QR DataURL error:', err));
    }
  }, [linkData]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // 1. Générer le lien de liaison
  const handleGenerateLink = async () => {
    try {
      setGeneratingLink(true);
      const res = await fetch('/api/telegram/link-token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erreur lors de la génération du lien.', 'error');
        return;
      }
      setLinkData({
        link: data.link,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      // Génération locale immédiate du QR Code
      try {
        const svg = await QRCode.toString(data.link, { type: 'svg', margin: 1 });
        setQrSvg(svg);
        const url = await QRCode.toDataURL(data.link, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrDataUrl(url);
      } catch (qrErr) {
        console.warn('Erreur génération locale QR code:', qrErr);
      }

      showToast('Lien de liaison généré. Vous avez 10 minutes pour ouvrir Telegram.', 'success');
    } catch {
      showToast('Erreur de connexion au serveur.', 'error');
    } finally {
      setGeneratingLink(false);
    }
  };

  // 2. Envoyer un message de test
  const handleSendTest = async () => {
    try {
      setSendingTest(true);
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Échec de l\'envoi du message de test.', 'error');
        return;
      }
      showToast('Message de test envoyé sur votre Telegram avec succès !', 'success');
    } catch {
      showToast('Erreur de communication avec le serveur.', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  // 3. Délier le compte Telegram
  const handleUnlink = async () => {
    if (!window.confirm('Voulez-vous vraiment délier votre compte Telegram ? Vous ne recevrez plus d\'alertes instantanées.')) {
      return;
    }
    try {
      setUnlinking(true);
      const res = await fetch('/api/telegram/link-token', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erreur lors de la déliaison.', 'error');
        return;
      }
      setChannel({ linked: false, verified_at: null, enabled: false });
      setLinkData(null);
      showToast('Votre compte Telegram a été délié avec succès.', 'success');
    } catch {
      showToast('Erreur de connexion.', 'error');
    } finally {
      setUnlinking(false);
    }
  };

  // 4. Mettre à jour l'état d'un toggle et sauvegarder
  const handleToggle = async (eventType: string, currentVal: boolean) => {
    const updatedEvents = events.map((e) =>
      e.type === eventType ? { ...e, enabled: !currentVal } : e
    );
    setEvents(updatedEvents);

    const prefsPayload: Record<string, boolean> = {};
    updatedEvents.forEach((e) => {
      prefsPayload[e.type] = e.enabled;
    });

    try {
      setSavingPrefs(true);
      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefsPayload }),
      });
      if (!res.ok) {
        showToast('Erreur lors de la sauvegarde de la préférence.', 'error');
        // Rollback local en cas d'échec
        setEvents(events);
      }
    } catch {
      showToast('Erreur de communication.', 'error');
      setEvents(events);
    } finally {
      setSavingPrefs(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 0.75rem' }} />
        <p style={{ fontSize: '0.9rem' }}>Chargement des réglages Telegram...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toast Feedback */}
      {feedback && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: feedback.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#4ade80' : '#f87171',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── CARTE STATUT LIAISON TELEGRAM ─────────────────────────────────── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.3rem' }}>✈️</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>
                Alertes Telegram Sécurisées
              </h3>
              {channel.linked ? (
                <span
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(34,197,94,0.3)',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle2 size={12} /> Lié et actif
                </span>
              ) : (
                <span
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245,158,11,0.3)',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  Non lié
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.4' }}>
              Recevez instantanément vos alertes opérationnelles critiques sur votre smartphone.
              {channel.verified_at && (
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Lié le {new Date(channel.verified_at).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })}
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {channel.linked ? (
              <>
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={sendingTest}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(56,189,248,0.15)',
                    border: '1px solid rgba(56,189,248,0.3)',
                    color: '#38bdf8',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: sendingTest ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sendingTest ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Envoyer un message de test
                </button>

                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: unlinking ? 'not-allowed' : 'pointer',
                  }}
                >
                  {unlinking ? <Loader2 size={15} className="animate-spin" /> : <Unlink size={15} />}
                  Délier
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={generatingLink}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.7rem 1.25rem',
                  borderRadius: '10px',
                  background: '#f97316',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  cursor: generatingLink ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                }}
              >
                {generatingLink ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                Lier mon compte Telegram
              </button>
            )}

            <button
              type="button"
              onClick={loadSettings}
              title="Rafraîchir"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                padding: '0.6rem',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* ── BLOC LIAISON ACTIF (Lien + QR Code) ─────────────────────────── */}
        {linkData && !channel.linked && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1.25rem',
              borderRadius: '12px',
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(249,115,22,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={18} style={{ color: '#f97316' }} />
                <span style={{ fontWeight: '800', color: '#fff', fontSize: '0.95rem' }}>
                  Scannez le QR Code ou ouvrez le lien
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#f97316', background: 'rgba(249,115,22,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                Expire dans 10 minutes
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* QR Code */}
              <div
                style={{
                  background: '#fff',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '150px',
                  height: '150px',
                  boxSizing: 'border-box',
                }}
              >
                {qrSvg ? (
                  <div
                    style={{ width: '134px', height: '134px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code de liaison Telegram"
                    width={134}
                    height={134}
                    style={{ display: 'block', borderRadius: '4px' }}
                  />
                ) : (
                  <Loader2 size={32} className="animate-spin" style={{ color: '#f97316' }} />
                )}
              </div>

              {/* Instructions et lien */}
              <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  1. Scannez ce code avec votre téléphone ou cliquez sur le bouton ci-dessous.<br />
                  2. Telegram s'ouvrira directement sur la conversation avec notre bot.<br />
                  3. Cliquez sur <b>« DÉMARRER »</b> pour lier instantanément votre compte.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a
                    href={linkData.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.6rem 1rem',
                      background: '#0284c7',
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={14} /> Ouvrir Telegram
                  </a>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(linkData.link)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.6rem 1rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? <Check size={14} style={{ color: '#4ade80' }} /> : <Copy size={14} />}
                    {copied ? 'Copié !' : 'Copier le lien'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── LISTE DES PRÉFÉRENCES PAR TYPE D'ALERTE ────────────────────────── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
              Types d'alertes autorisées pour votre compte
            </h4>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Activez ou désactivez les alertes selon vos besoins opérationnels.
            </p>
          </div>
          {savingPrefs && (
            <span style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader2 size={13} className="animate-spin" /> Enregistrement...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {events.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
              Aucun type d'alerte configuré pour votre rôle.
            </p>
          ) : (
            events.map((evt) => (
              <div
                key={evt.type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#f1f5f9' }}>
                    {evt.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    {evt.description}
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={evt.enabled}
                  onClick={() => handleToggle(evt.type, evt.enabled)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    background: evt.enabled ? '#22c55e' : 'rgba(255,255,255,0.15)',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#fff',
                      transform: evt.enabled ? 'translateX(20px)' : 'translateX(0)',
                      transition: 'transform 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
