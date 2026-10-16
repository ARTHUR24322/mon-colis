'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, X, Shield, Delete } from 'lucide-react';

interface PinModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  destination?: string; // label like "Gestion des Admins"
}

export default function PinModal({ onSuccess, onCancel, destination }: PinModalProps) {
  const [pin, setPin]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleVerify = useCallback(async (value: string) => {
    if (value.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Code incorrect.');
        setPin('');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch {
      setError('Erreur de connexion.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  // Auto-submit when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4) {
      handleVerify(pin);
    }
  }, [pin, handleVerify]);

  const handleDigit = (d: string) => {
    if (pin.length < 4 && !loading) {
      setPin(p => p + d);
    }
  };

  const handleDelete = () => {
    if (!loading) setPin(p => p.slice(0, -1));
    setError('');
  };

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #0f0f0f, #1a1a1a)',
          border: '1px solid rgba(249,115,22,0.25)',
          borderRadius: '24px',
          padding: '2rem 1.75rem',
          width: '100%', maxWidth: '320px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(249,115,22,0.1)',
          animation: shake ? 'shake 0.5s ease' : 'none',
          fontFamily: "'Inter', system-ui, sans-serif",
          color: 'white',
        }}
      >
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            15%{transform:translateX(-8px)}
            30%{transform:translateX(8px)}
            45%{transform:translateX(-6px)}
            60%{transform:translateX(6px)}
            75%{transform:translateX(-4px)}
            90%{transform:translateX(4px)}
          }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #f97316, #c2410c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(249,115,22,0.3)',
            }}>
              <Shield size={20} color="white" />
            </div>
            <div>
              <p style={{ fontWeight: '800', fontSize: '0.95rem', margin: 0 }}>Accès Restreint</p>
              {destination && (
                <p style={{ fontSize: '0.72rem', opacity: 0.5, margin: '0.1rem 0 0' }}>{destination}</p>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center', marginBottom: '1.5rem' }}>
          Entrez le code PIN à 4 chiffres pour continuer
        </p>

        {/* PIN dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: '14px', height: '14px', borderRadius: '50%',
                background: i < pin.length
                  ? (error ? '#ef4444' : '#f97316')
                  : 'rgba(255,255,255,0.15)',
                border: `2px solid ${i < pin.length ? (error ? '#ef4444' : '#f97316') : 'rgba(255,255,255,0.2)'}`,
                transition: 'all 0.15s ease',
                transform: i < pin.length ? 'scale(1.2)' : 'scale(1)',
                boxShadow: i < pin.length && !error ? '0 0 8px rgba(249,115,22,0.6)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '0.6rem 0.85rem', marginBottom: '1rem',
            textAlign: 'center', fontSize: '0.78rem', color: '#fca5a5',
          }}>
            {error}
          </div>
        )}

        {/* Hidden real input for keyboard on mobile */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            setPin(v);
            setError('');
          }}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
        />

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          {digits.map((d, i) => {
            const isEmpty = d === '';
            const isDelete = d === '⌫';
            return (
              <button
                key={i}
                onClick={() => isDelete ? handleDelete() : (!isEmpty && handleDigit(d))}
                disabled={loading || isEmpty}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  border: isEmpty ? 'none' : isDelete ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.1)',
                  background: isEmpty ? 'transparent' : isDelete ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)',
                  color: isDelete ? '#f87171' : 'white',
                  fontSize: isDelete ? '1rem' : '1.2rem',
                  fontWeight: '600',
                  cursor: isEmpty ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  opacity: loading ? 0.4 : 1,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  if (!isEmpty && !loading) {
                    (e.currentTarget as HTMLElement).style.background = isDelete ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.12)';
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isEmpty && !loading) {
                    (e.currentTarget as HTMLElement).style.background = isDelete ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }
                }}
              >
                {isDelete ? <Delete size={16} /> : d}
              </button>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.68rem', opacity: 0.25, marginTop: '1.25rem' }}>
          <Lock size={10} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
          Section Administration Avancée — Super Admin uniquement
        </p>
      </div>
    </div>
  );
}
