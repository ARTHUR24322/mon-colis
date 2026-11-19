'use client';

import React, { useState } from 'react';
import { X, KeyRound, AlertTriangle, RefreshCw, CheckCircle2, Lock, Eye, EyeOff, Copy, Check, ShieldCheck } from 'lucide-react';

interface AdminDropPointSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  dropPoint: {
    id: string;
    code?: string;
    name: string;
    commune: string;
    agentId?: string;
    agentNumber?: string;
    managerName?: string;
  };
  mode: 'EDIT_CODE' | 'REGEN_QR' | 'RESET_PIN';
  onSuccess: (updatedData: { code?: string; newQrToken?: string; plainPin?: string; agentNumber?: string }) => void;
}

export default function AdminDropPointSecurityModal({
  isOpen,
  onClose,
  dropPoint,
  mode,
  onSuccess,
}: AdminDropPointSecurityModalProps) {
  const [newCode, setNewCode] = useState(dropPoint.code || dropPoint.id);
  const [newPin, setNewPin] = useState(() => String(Math.floor(100_000 + Math.random() * 900_000)));
  const [showPin, setShowPin] = useState(true);
  const [copied, setCopied] = useState(false);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [credentialsResult, setCredentialsResult] = useState<{
    agentNumber: string;
    plainPin: string;
    agentName: string;
    dropPointName: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentCode = dropPoint.code || dropPoint.id;

  const generateRandomPin = () => {
    const random = String(Math.floor(100_000 + Math.random() * 900_000));
    setNewPin(random);
  };

  const copyCredentials = () => {
    if (!credentialsResult) return;
    const text = `Point Relais : ${credentialsResult.dropPointName}\nAgent / Gérant : ${credentialsResult.agentName}\nNuméro Agent (Identifiant) : ${credentialsResult.agentNumber}\nCode PIN de Connexion (6 chiffres) : ${credentialsResult.plainPin}\nConnexion : /login ou /point-relais`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

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
      } else if (mode === 'REGEN_QR') {
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
      } else if (mode === 'RESET_PIN') {
        // Validation du PIN 6 chiffres
        const cleanPin = newPin.trim();
        if (!/^\d{6}$/.test(cleanPin)) {
          setError('Le nouveau code PIN de connexion doit comporter exactement 6 chiffres numériques.');
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/admin/drop-points/${dropPoint.id}/reset-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newPin: cleanPin,
            agentId: dropPoint.agentId,
            reason: reason.trim() || 'Réinitialisation du code PIN par le Super Admin',
            adminPin: pin.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Erreur lors de la réinitialisation du code PIN.');
        } else {
          setSuccessMsg(data.message);
          setCredentialsResult({
            agentNumber: data.agent.agentNumber,
            plainPin: data.plainPin,
            agentName: data.agent.name,
            dropPointName: data.agent.dropPointName,
          });
          onSuccess({ plainPin: data.plainPin, agentNumber: data.agent.agentNumber });
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
        borderRadius: '24px', width: '100%', maxWidth: '480px',
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
            background: mode === 'EDIT_CODE'
              ? 'rgba(59, 130, 246, 0.15)'
              : mode === 'RESET_PIN'
              ? 'rgba(234, 179, 8, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            color: mode === 'EDIT_CODE'
              ? '#60a5fa'
              : mode === 'RESET_PIN'
              ? '#facc15'
              : '#f87171',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {mode === 'EDIT_CODE' ? <KeyRound size={22} /> : mode === 'RESET_PIN' ? <Lock size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
              {mode === 'EDIT_CODE'
                ? 'Modifier le code du Point Relais'
                : mode === 'RESET_PIN'
                ? 'Changer le code PIN de connexion (6 chiffres)'
                : 'Régénérer le QR Code'}
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              {dropPoint.name} {dropPoint.agentNumber ? `· Agent #${dropPoint.agentNumber}` : `(${currentCode})`}
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

        {mode === 'RESET_PIN' && !credentialsResult && (
          <div style={{
            background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: '12px', padding: '0.85rem', fontSize: '0.8rem', color: '#fef08a',
            marginBottom: '1rem', lineHeight: 1.5
          }}>
            <strong>Accès gérant / agent relais :</strong> Ce code PIN à 6 chiffres permet au responsable du point relais de se connecter sur son tableau de bord avec son numéro agent à 9 chiffres.
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

        {successMsg && !credentialsResult && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e',
            color: '#86efac', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* Écran de succès après réinitialisation du PIN */}
        {credentialsResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '16px', padding: '1.25rem', textAlign: 'center'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.75rem'
              }}>
                <ShieldCheck size={26} />
              </div>
              <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
                Code PIN mis à jour avec succès !
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                Communiquez ces identifiants au gérant du point relais.
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: '#94a3b8' }}>Point Relais :</span>
                <span style={{ color: '#fff', fontWeight: '700' }}>{credentialsResult.dropPointName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: '#94a3b8' }}>Gérant / Agent :</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{credentialsResult.agentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: '#94a3b8' }}>Identifiant (9 chiffres) :</span>
                <span style={{
                  fontFamily: 'monospace', fontWeight: '900', color: '#60a5fa',
                  background: 'rgba(59,130,246,0.15)', padding: '0.2rem 0.5rem', borderRadius: '6px'
                }}>
                  #{credentialsResult.agentNumber}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: '#94a3b8' }}>Nouveau Code PIN :</span>
                <span style={{
                  fontFamily: 'monospace', fontWeight: '900', color: '#facc15', fontSize: '1.25rem',
                  background: 'rgba(234,179,8,0.15)', padding: '0.25rem 0.75rem', borderRadius: '8px',
                  letterSpacing: '2px', border: '1px solid rgba(234,179,8,0.3)'
                }}>
                  {credentialsResult.plainPin}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={copyCredentials}
                style={{
                  flex: 1, padding: '0.8rem', borderRadius: '10px',
                  border: 'none', background: copied ? '#16a34a' : 'linear-gradient(135deg, #eab308, #ca8a04)',
                  color: '#000', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copié !' : 'Copier les accès'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.8rem 1.25rem', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                  color: '#fff', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
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

            {mode === 'RESET_PIN' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1' }}>
                    Nouveau Code PIN de connexion (6 chiffres) :
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    style={{
                      background: 'none', border: 'none', color: '#facc15', fontSize: '0.75rem',
                      fontWeight: '700', cursor: 'pointer', textDecoration: 'underline'
                    }}
                  >
                    Générer au hasard
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    style={{
                      width: '100%', padding: '0.75rem 3rem 0.75rem 1rem', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                      color: '#facc15', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: '800',
                      letterSpacing: '4px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
                  Exactement 6 chiffres numériques.
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
                placeholder={mode === 'RESET_PIN' ? 'Ex: Oubli du code par le gérant / Renouvellement de sécurité' : 'Ex: Demande de changement du gérant / Rotation trimestrielle'}
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Code PIN Super Admin de confirmation (facultatif si session active) :
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
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
                    : mode === 'RESET_PIN'
                    ? 'linear-gradient(135deg, #eab308, #ca8a04)'
                    : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: mode === 'RESET_PIN' ? '#000' : '#fff', fontSize: '0.85rem', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
                {mode === 'EDIT_CODE'
                  ? 'Confirmer le code'
                  : mode === 'RESET_PIN'
                  ? 'Appliquer le PIN 6 chiffres'
                  : 'Régénérer immédiatement'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
