'use client';

import React, { useEffect, useRef, useState, useId } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, AlertTriangle, Image as ImageIcon, CheckCircle, ShieldAlert } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
  fps?: number;
  qrboxSize?: number;
}

export default function QRScanner({
  onScanSuccess,
  onScanFailure,
  fps = 10,
  qrboxSize = 250,
}: QRScannerProps) {
  const uniqueId = useId().replace(/:/g, '_');
  const containerId = `qr-reader-${uniqueId}`;

  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [isInsecureHttp, setIsInsecureHttp] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vérifier le contexte sécurisé (HTTPS ou localhost)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isSecure) {
        setIsInsecureHttp(true);
      }
    }
  }, []);

  const startCamera = async () => {
    setLoading(true);
    setErrorMessage(null);
    setIsPermissionDenied(false);

    try {
      // Nettoyer toute instance précédente
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
        } catch {}
      }

      const qrCodeInstance = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
        verbose: false,
      });
      html5QrCodeRef.current = qrCodeInstance;

      // Configuration de la caméra (priorité à la caméra arrière sur smartphone)
      const qrConfig = {
        fps: fps || 10,
        qrbox: { width: qrboxSize || 250, height: qrboxSize || 250 },
        aspectRatio: 1.0,
      };

      const handleSuccess = (decodedText: string) => {
        // Arrêter proprement après détection
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {});
        }
        setCameraActive(false);
        onScanSuccess(decodedText);
      };

      const handleError = (err: any) => {
        if (onScanFailure) onScanFailure(err);
      };

      // Pre-flight permission request si supporté par le navigateur
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const preStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
          });
          preStream.getTracks().forEach(t => t.stop());
        } catch (permErr: any) {
          console.warn("Vérification permission caméra:", permErr);
          const pName = permErr?.name || '';
          if (pName === 'NotAllowedError' || pName === 'PermissionDeniedError') {
            setIsPermissionDenied(true);
            setLoading(false);
            setErrorMessage("Autorisation caméra refusée. Veuillez autoriser l'appareil photo dans les paramètres de votre navigateur ou utilisez le bouton 'Prendre une photo' ci-dessous.");
            return;
          }
        }
      }

      // Tenter d'abord la caméra arrière (environnement)
      try {
        await qrCodeInstance.start(
          { facingMode: 'environment' },
          qrConfig,
          handleSuccess,
          handleError
        );
        setCameraActive(true);
        setLoading(false);
        return;
      } catch (backCamError: any) {
        console.warn('Caméra arrière directe non disponible, tentative énumération...', backCamError);
      }

      // Fallback 1 : Énumérer et sélectionner la caméra arrière ou la dernière caméra disponible
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCam = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('arrière')) || cameras[cameras.length - 1];
          await qrCodeInstance.start(
            backCam.id,
            qrConfig,
            handleSuccess,
            handleError
          );
          setCameraActive(true);
          setLoading(false);
          return;
        }
      } catch (camListErr) {
        console.warn('Échec énumération caméras:', camListErr);
      }

      // Fallback 2 : Caméra utilisateur / standard
      await qrCodeInstance.start(
        { facingMode: 'user' },
        qrConfig,
        handleSuccess,
        handleError
      );
      setCameraActive(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Erreur lancement caméra:', err);
      setLoading(false);
      setCameraActive(false);

      const errStr = String(err?.name || err?.message || err).toLowerCase();
      if (errStr.includes('permission') || errStr.includes('notallowed') || errStr.includes('denied')) {
        setIsPermissionDenied(true);
        setErrorMessage("L'accès à la caméra a été refusé. Veuillez autoriser la caméra dans les réglages de votre navigateur (icône cadenas/paramètres de site) ou utilisez le bouton photo ci-dessous.");
      } else if (errStr.includes('notfound') || errStr.includes('devicesnotfound')) {
        setErrorMessage("Aucun appareil photo détecté sur cet appareil.");
      } else if (errStr.includes('secure') || !window.isSecureContext) {
        setIsInsecureHttp(true);
        setErrorMessage("Le navigateur bloque le flux vidéo en direct hors HTTPS. Utilisez le bouton 'Prendre une photo' ci-dessous : il fonctionne immédiatement et sans restriction.");
      } else {
        setErrorMessage("Impossible d'activer le flux vidéo direct. Utilisez le bouton photo ci-dessous pour scanner facilement.");
      }
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
        } catch {}
      }
    };
  }, []);

  // Scan via capture photo ou sélection de fichier image (100% compatible même sans permission live stream)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanning(true);
    setErrorMessage(null);

    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId);
        html5QrCodeRef.current = scanner;
      }
      const decodedText = await scanner.scanFile(file, true);
      setFileScanning(false);
      onScanSuccess(decodedText);
    } catch (err: any) {
      console.warn('Échec scan image:', err);
      setFileScanning(false);
      setErrorMessage("Aucun QR Code valide détecté sur cette photo. Essayez de reprendre une photo plus nette et plus près du code.");
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Conteneur DOM requis par Html5Qrcode - Toujours visible pour éviter l'erreur de dimensions nulles */}
      <div style={{ position: 'relative', width: '100%', minHeight: '260px', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
        <div
          id={containerId}
          style={{
            width: '100%',
            minHeight: '260px',
            background: '#000',
          }}
        />

        {/* État de chargement caméra */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            padding: '2rem 1rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8'
          }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 8px', color: '#60a5fa' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>Initialisation de la caméra...</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Veuillez autoriser l'accès si votre navigateur le demande.</p>
          </div>
        )}
      </div>

      {/* Alerte si permission refusée ou erreur */}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '14px', padding: '12px 14px', color: '#fca5a5', fontSize: '0.8rem',
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ lineHeight: 1.4 }}>{errorMessage}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={startCamera}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none',
                background: '#ef4444', color: '#fff', fontSize: '0.75rem', fontWeight: '700',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
              }}
            >
              <RefreshCw size={12} /> Réessayer la caméra
            </button>
          </div>
        </div>
      )}

      {/* AVERTISSEMENT HTTP (Insecure Context) */}
      {isInsecureHttp && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px', padding: '10px 12px', color: '#fbbf24', fontSize: '0.75rem',
          display: 'flex', alignItems: 'flex-start', gap: '8px'
        }}>
          <ShieldAlert size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            <strong>Info réseau local :</strong> Si vous testez via une adresse IP locale (ex: <code>http://192.168...</code>), les navigateurs bloquent la caméra en direct. Utilisez le bouton photo ci-dessous : il fonctionne immédiatement.
          </span>
        </div>
      )}

      {/* BOUTON DE SECOURS IMMANQUABLE : Prendre une photo / Importer (100% de réussite) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={fileScanning}
          style={{
            width: '100%', minHeight: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none',
            color: '#fff', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
          }}
        >
          {fileScanning ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Analyse de la photo en cours...</span>
            </>
          ) : (
            <>
              <Camera size={18} />
              <span>Prendre une photo du QR Code (Garanti)</span>
            </>
          )}
        </button>

        <span style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center' }}>
          Fonctionne sur tous les téléphones même si l'autorisation de flux direct est bloquée.
        </span>
      </div>
    </div>
  );
}
