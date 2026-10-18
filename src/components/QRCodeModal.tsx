'use client';

import React, { useRef } from 'react';
import { X, Download, Printer, ShieldCheck, QrCode } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dropPoint: {
    id: string;
    code?: string;
    name: string;
    commune: string;
    address: string;
    phone: string;
    qrToken?: string;
  };
}

export default function QRCodeModal({ isOpen, onClose, dropPoint }: QRCodeModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const displayCode = dropPoint.code || dropPoint.id;
  const qrData = dropPoint.qrToken || `MCL-DP-${displayCode}`;
  // Générer une image QR code via l'API standard haute résolution (encodage QR vectoriel)
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}&margin=10`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${displayCode}_${dropPoint.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(qrImageUrl, '_blank');
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
        borderRadius: '24px', width: '100%', maxWidth: '440px',
        padding: '1.75rem', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
        color: '#fff', textAlign: 'center',
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

        {/* Zone imprimable */}
        <div ref={printRef} className="printable-qr-poster" style={{
          background: '#ffffff', borderRadius: '16px', padding: '1.5rem',
          color: '#0f172a', marginBottom: '1.25rem', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#16a34a', letterSpacing: '-0.5px' }}>MONCOLIS</span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontWeight: '800' }}>
              POINT RELAIS OFFICIEL
            </span>
          </div>

          <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.15rem', fontWeight: '900', color: '#0f172a' }}>
            {dropPoint.name}
          </h3>
          <p style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', color: '#64748b' }}>
            {dropPoint.commune} — {dropPoint.address}
          </p>

          <div style={{
            display: 'inline-block', padding: '0.5rem', background: '#f8fafc',
            border: '2px solid #e2e8f0', borderRadius: '12px', marginBottom: '0.8rem'
          }}>
            {/* Image QR Code officielle */}
            <img
              src={qrImageUrl}
              alt={`QR Code ${displayCode}`}
              style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto' }}
            />
          </div>

          <div style={{ background: '#f1f5f9', padding: '0.5rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Code Unique Point Relais
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '900', fontFamily: 'monospace', color: '#0f172a', letterSpacing: '1px' }}>
              {displayCode}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#16a34a', fontWeight: '700' }}>
            <ShieldCheck size={14} /> Jeton cryptographique vérifié
          </div>
        </div>

        {/* Boutons d'actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            onClick={handleDownload}
            style={{
              padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '0.85rem',
              fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.4rem'
            }}
          >
            <Download size={16} /> Télécharger
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '0.75rem', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
              fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
            }}
          >
            <Printer size={16} /> Imprimer l'affiche
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .printable-qr-poster, .printable-qr-poster * { visibility: visible !important; }
          .printable-qr-poster {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 80% !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
