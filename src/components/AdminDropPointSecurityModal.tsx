'use client';

import React, { useState } from 'react';
import { X, KeyRound, AlertTriangle, RefreshCw, CheckCircle2, Lock } from 'lucide-react';

interface AdminDropPointSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  dropPoint: {
    id: string;
    code?: string;
    name: string;
    commune: string;
  };
  mode: 'EDIT_CODE' | 'REGEN_QR';
  onSuccess: (updatedData: { code?: string; newQrToken?: string }) => void;
}

export default function AdminDropPointSecurityModal({
  isOpen,
  onClose,
  dropPoint,
  mode,
  onSuccess,
}: AdminDropPointSecurityModalProps) {
  const [newCode, setNewCode] = useState(dropPoint.code || dropPoint.id);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCode = dropPoint.code || dropPoint.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'EDIT_CODE') {
        if (!newCode.trim() || newCode.trim().toUpperCase() === currentCode.toUpperCase()) {
          setError('Veuillez saisir un nouveau code différent de l\'actuel.');
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/admin/drop-points/${dropPoint.id}/update-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newCode: newCode.trim().toUpperCase(),
            reason: reason.trim() || 'Mise à jour standard par le Super Admin',
            adminPin: pin.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Erreur lors du changement de code.');
        } else {
          setSuccessMsg(data.message);
          onSuccess({ code: data.newCode });
          setTimeout(() => onClose(), 1500);
        }
      } else {
        // REGEN_QR
        const res = await fetch(`/api/admin/drop-points/${dropPoint.id}/regenerate-qr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminPin: pin.trim(),
            reason: reason.trim() || 'Régénération de sécurité du QR Code',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Erreur lors de la régénération du QR Code.');
        } else {
          setSuccessMsg(data.message);
          onSuccess({ newQrToken: data.newQrToken });
          setTimeout(() => onClose(), 1500);
        }
      }
    } catch {
      setError('Erreur de communication avec le serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '24px', width: '100%', maxWidth: '460px',
        padding: '1.75rem', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
        color: '#fff',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8',
            width: '32px', height: '32px', borderRadius: '50%',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: mode === 'EDIT_CODE' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: mode === 'EDIT_CODE' ? '#60a5fa' : '#f87171',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {mode === 'EDIT_CODE' ? <KeyRound size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
              {mode === 'EDIT_CODE' ? 'Modifier le code du Point Relais' : 'Régénérer le QR Code'}
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              {dropPoint.name} ({currentCode})
            </p>
          </div>
        </div>

        {mode === 'REGEN_QR' && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px', padding: '0.85rem', fontSize: '0.8rem', color: '#fca5a5',
            marginBottom: '1rem', lineHeight: 1.5
          }}>
            <strong>Avertissement de sécurité critique :</strong> L'ancien QR code sera immédiatement révoqué. Tout scan de l'ancienne affiche physique sera refusé. Le point relais devra imprimer le nouveau QR code.
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444',
            color: '#fca5a5', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e',
            color: '#86efac', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'EDIT_CODE' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Nouveau code affiché (unicité obligatoire) :
              </label>
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase())}
                placeholder={`DP-${dropPoint.commune.slice(0, 3).toUpperCase()}-1234`}
                required
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '1rem', fontFamily: 'monospace', fontWeight: '700'
                }}
              />
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                L'identifiant technique interne reste immuable. Les colis existants restent parfaitement rattachés.
              </span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
              Motif de l'opération (pour le journal d'audit) :
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Demande de changement du gérant / Rotation trimestrielle"
              required
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: '0.85rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
              Code PIN Super Admin de confirmation :
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                style={{
                  width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '1.1rem', letterSpacing: '4px'
                }}
              />
              <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                color: '#94a3b8', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer'
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none',
                background: mode === 'EDIT_CODE'
                  ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                  : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff', fontSize: '0.85rem', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
              {mode === 'EDIT_CODE' ? 'Confirmer le code' : 'Régénérer immédiatement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
