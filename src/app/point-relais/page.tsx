'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin, LogOut, Package, CheckCircle2,
  Clock, AlertCircle, RefreshCw, QrCode, Truck,
  Building2, X, Copy, Check, Lock, Search, AlertTriangle,
  Phone, Share2, ArrowRight, ShieldCheck, ShieldAlert,
  ChevronRight, Calendar, User, CheckCircle, Camera
} from 'lucide-react';
import Link from 'next/link';
import { ColisItem, dataService } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import QRScanner from '@/components/QRScanner';

// Types navigation
type NavTab = 'accueil' | 'stock' | 'scanner' | 'plus';
type StockFilter = 'all' | 'collecte_livreur' | 'retrait_client';
type ScannerMode = 'vendor_reception' | 'driver_handover' | 'client_otp';

interface AgentSession {
  id: string;
  agentNumber: string;
  name: string;
  dropPointId: string;
  dropPointName: string;
  dropPointCommune: string;
}

// Helper audio & vibration synthétique pour feedback immédiat
function playHapticFeedback(type: 'success' | 'error') {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
        osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.12); // C6
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.22);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    }
    if (navigator?.vibrate) {
      if (type === 'success') {
        navigator.vibrate([80]);
      } else {
        navigator.vibrate([120, 60, 120, 60, 200]);
      }
    }
  } catch {
    // Non bloquant si audio non initialisé
  }
}

export default function PointRelaisPage() {
  const { user, loading: authLoading, sessionChecked, logout } = useAuth();
  const { formatPrice } = useCurrency();

  const [agent, setAgent] = useState<AgentSession | null>(null);

  // Navigation
  const [currentTab, setCurrentTab] = useState<NavTab>('accueil');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [stockSearch, setStockSearch] = useState('');

  // Données des colis
  const [incomingVendor, setIncomingVendor] = useState<ColisItem[]>([]);
  const [incomingDriver, setIncomingDriver] = useState<ColisItem[]>([]);
  const [available, setAvailable] = useState<ColisItem[]>([]);
  const [vendorDeposits, setVendorDeposits] = useState<ColisItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dropPointCredits, setDropPointCredits] = useState<number | null>(null);
  const [dropPointInfo, setDropPointInfo] = useState<{ address?: string; managerName?: string; phone?: string; qrToken?: string } | null>(null);

  // Modals
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedColisDetail, setSelectedColisDetail] = useState<ColisItem | null>(null);

  // Scanner state
  const [scannerMode, setScannerMode] = useState<ScannerMode>('vendor_reception');
  const [cameraActive, setCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResultToast, setScanResultToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);

  // Modal Retrait Client (OTP)
  const [otpModalColis, setOtpModalColis] = useState<ColisItem | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Modal Remise Livreur
  const [handoverModalColis, setHandoverModalColis] = useState<ColisItem | null>(null);
  const [driverIdentifierInput, setDriverIdentifierInput] = useState('');
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);

  // Modal Clôture & Inventaire fin de journée
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryScannedCodes, setInventoryScannedCodes] = useState<string[]>([]);
  const [inventoryInput, setInventoryInput] = useState('');

  // Toast notification
  const triggerToast = (message: string, type: 'success' | 'error') => {
    playHapticFeedback(type);
    setScanResultToast({ message, type });
    setTimeout(() => setScanResultToast(null), 4000);
  };

  // Chargement des données
  const loadPackages = async (dpId: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/drop-points/${dpId}/dashboard`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setIncomingVendor(data.incomingVendor ?? []);
        setIncomingDriver(data.incomingDriver ?? []);
        setAvailable(data.available ?? []);
        setVendorDeposits(data.vendorDeposits ?? []);
        if (data.dropPoint) {
          setDropPointCredits(data.dropPoint.credits);
          setDropPointInfo({
            address: data.dropPoint.address,
            managerName: data.dropPoint.managerName,
            phone: data.dropPoint.phone,
            qrToken: data.dropPoint.id,
          });
        }
      }
    } catch (e) {
      console.error('Erreur chargement dashboard:', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Initialisation session
  useEffect(() => {
    if (sessionChecked && user?.role === 'point_relais') {
      const a: AgentSession = {
        id: user.id,
        agentNumber: user.agentNumber || '000000',
        name: user.name,
        dropPointId: user.dropPointId || user.agencyId || 'dp-1',
        dropPointName: user.dropPointName || 'Point Relais',
        dropPointCommune: user.dropPointCommune || 'Kinshasa',
      };
      setAgent(a);
      loadPackages(a.dropPointId);
    }
  }, [user, sessionChecked]);

  // Colis unifiés en stock
  const allStockColis = useMemo(() => {
    const list: ColisItem[] = [];
    // 1. Dépôts vendeurs à collecter
    vendorDeposits.forEach(p => {
      if (!list.some(x => x.id === p.id)) list.push(p);
    });
    // 2. Colis disponibles pour retrait client
    available.forEach(p => {
      if (!list.some(x => x.id === p.id)) list.push(p);
    });
    return list;
  }, [vendorDeposits, available]);

  // Filtrage du stock
  const filteredStock = useMemo(() => {
    return allStockColis.filter(c => {
      const isCollecte = vendorDeposits.some(p => p.id === c.id);
      const isRetrait = available.some(p => p.id === c.id);

      let matchType = true;
      if (stockFilter === 'collecte_livreur') matchType = isCollecte;
      if (stockFilter === 'retrait_client') matchType = isRetrait;

      const q = stockSearch.toLowerCase().trim();
      const matchQuery = !q ||
        c.trackingCode.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        (c.vendeurName && c.vendeurName.toLowerCase().includes(q)) ||
        (c.pickupCode && c.pickupCode.toLowerCase().includes(q));

      return matchType && matchQuery;
    });
  }, [allStockColis, stockFilter, stockSearch, vendorDeposits, available]);

  // Actions Scanner
  const handleProcessScanCode = async (code: string) => {
    if (!agent) return;
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setScannerLoading(true);

    try {
      if (scannerMode === 'vendor_reception') {
        // Mode Réception Dépôt Vendeur
        if (dropPointCredits !== null && dropPointCredits <= 0) {
          triggerToast('Réception impossible : votre solde de crédits est épuisé (0 crédit). Rechargez votre compte.', 'error');
          return;
        }

        // 1. Vérification scan-handover
        const verifyRes = await fetch(`/api/drop-points/scan-handover?code=${encodeURIComponent(cleanCode)}&dropPointId=${encodeURIComponent(agent.dropPointId)}`);
        const verifyJson = await verifyRes.json();

        if (!verifyRes.ok || !verifyJson.found) {
          triggerToast(verifyJson.error || 'Colis introuvable ou déjà réceptionné.', 'error');
          return;
        }

        // 2. Validation de la prise en charge
        const acceptRes = await fetch('/api/drop-points/scan-handover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: verifyJson.package.id,
            dropPointId: agent.dropPointId,
            agentId: agent.id,
            agentName: agent.name,
            action: 'ACCEPT',
          }),
        });

        const acceptJson = await acceptRes.json();
        if (acceptRes.ok) {
          triggerToast(`✅ Dépôt réceptionné ! Colis ${verifyJson.package.trackingCode} prêt pour l'agence.`, 'success');
          setManualCode('');
          setCameraActive(false);
          await loadPackages(agent.dropPointId);
        } else {
          triggerToast(acceptJson.error || 'Erreur lors de la prise en charge.', 'error');
        }
      } else if (scannerMode === 'driver_handover') {
        // Mode Remise au Livreur : le code peut être le tracking du colis ou le code livreur
        // Si on a déjà un colis en cours, c'est l'identifiant livreur
        if (handoverModalColis) {
          await submitHandoverToDriver(handoverModalColis.id, cleanCode);
        } else {
          // Trouver le colis correspondant dans le stock
          const found = vendorDeposits.find(p =>
            p.trackingCode.toLowerCase() === cleanCode.toLowerCase() ||
            p.id.toLowerCase() === cleanCode.toLowerCase() ||
            (p.pickupCode && p.pickupCode.toLowerCase() === cleanCode.toLowerCase())
          );
          if (found) {
            setHandoverModalColis(found);
            setDriverIdentifierInput('');
            triggerToast('Colis identifié. Scannez maintenant le QR dynamique du livreur.', 'success');
          } else {
            triggerToast('Aucun colis à remettre au livreur ne correspond à ce code.', 'error');
          }
        }
      } else if (scannerMode === 'client_otp') {
        // Mode Retrait Client
        const found = available.find(p =>
          p.trackingCode.toLowerCase() === cleanCode.toLowerCase() ||
          p.id.toLowerCase() === cleanCode.toLowerCase() ||
          (p.pickupCode && p.pickupCode.toLowerCase() === cleanCode.toLowerCase())
        );
        if (found) {
          setOtpModalColis(found);
          setOtpInput('');
          setOtpError(null);
        } else {
          triggerToast('Colis pour retrait client introuvable avec ce code.', 'error');
        }
      }
    } catch (e) {
      console.error(e);
      triggerToast('Erreur de connexion au serveur.', 'error');
    } finally {
      setScannerLoading(false);
    }
  };

  // Soumission de la remise au livreur sécurisée (Vérification stricte de l'agence)
  const submitHandoverToDriver = async (packageId: string, driverIdentifier: string) => {
    if (!agent) return;
    setHandoverLoading(true);
    setHandoverError(null);

    try {
      const res = await fetch('/api/drop-points/handover-to-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          dropPointId: agent.dropPointId,
          driverIdentifier: driverIdentifier.trim(),
          agentId: agent.id,
          agentName: agent.name,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`🎉 ${data.message || 'Colis remis avec succès au livreur.'}`, 'success');
        setHandoverModalColis(null);
        setDriverIdentifierInput('');
        setCameraActive(false);
        await loadPackages(agent.dropPointId);
      } else {
        // En cas de mauvaise agence : message d'erreur très explicite
        const errMsg = data.error || 'Erreur lors de la remise au livreur.';
        setHandoverError(errMsg);
        triggerToast(`⛔ ${errMsg}`, 'error');
      }
    } catch {
      setHandoverError('Erreur de communication réseau.');
      triggerToast('Erreur réseau.', 'error');
    } finally {
      setHandoverLoading(false);
    }
  };

  // Validation Retrait Client (Code OTP)
  const submitClientOtp = async (packageId: string, otp: string) => {
    if (!agent) return;
    if (!otp || otp.trim().length < 6) {
      setOtpError('Veuillez saisir le code à 6 chiffres fourni par le client.');
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    try {
      const res = await fetch(`/api/packages/${packageId}/validate-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otp.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast('🎉 Colis remis avec succès au client destinataire !', 'success');
        setOtpModalColis(null);
        setOtpInput('');
        await loadPackages(agent.dropPointId);
      } else {
        const msg = data.error || 'Code OTP incorrect ou retrait bloqué.';
        setOtpError(msg);
        triggerToast(`⛔ ${msg}`, 'error');
      }
    } catch {
      setOtpError('Erreur de validation réseau.');
      triggerToast('Erreur réseau.', 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  if (authLoading && !sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <Lock size={40} color="#3b82f6" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>Vérification de la session Point Relais...</p>
        </div>
      </div>
    );
  }

  const isCreditsEmpty = dropPointCredits !== null && dropPointCredits <= 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#07090e',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: '80px',
      maxWidth: '480px',
      margin: '0 auto',
      position: 'relative',
      boxShadow: '0 0 30px rgba(0,0,0,0.8)'
    }}>

      {/* ── TOPBAR MOBILE ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7, 9, 14, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <MapPin size={20} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#fff',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {agent?.dropPointName || 'Point Relais'}
            </h1>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
              <span>{agent?.dropPointCommune}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  if (agent?.agentNumber) {
                    navigator.clipboard.writeText(agent.agentNumber);
                    triggerToast(`Numéro relais #${agent.agentNumber} copié !`, 'success');
                  }
                }}
                title="Cliquer pour copier le code du point relais"
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  color: '#93c5fd',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontWeight: '800',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>N° Relais : {agent?.agentNumber || '000000'}</span>
                <Copy size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Crédits & Action QR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setCurrentTab('plus')}
            style={{
              padding: '6px 10px', borderRadius: '8px',
              background: isCreditsEmpty ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              border: `1px solid ${isCreditsEmpty ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
              color: isCreditsEmpty ? '#f87171' : '#60a5fa',
              fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <span>{dropPointCredits !== null ? dropPointCredits : '—'}</span>
            <span style={{ fontSize: '0.65rem' }}>crédits</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            aria-label="Mon QR Code Relais"
            style={{
              padding: '8px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <QrCode size={18} />
          </button>
        </div>
      </header>

      {/* ── ALERTE SOLDE ÉPUISÉ ── */}
      {isCreditsEmpty && (
        <div style={{
          margin: '12px 16px 0',
          padding: '12px 14px', borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.78rem', color: '#fca5a5' }}>
            <strong style={{ display: 'block', color: '#fff' }}>Solde de crédits épuisé (0 crédit)</strong>
            Réceptions bloquées. Rechargez votre compte pour continuer à accueillir des colis.
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION FLOTTANT ── */}
      {scanResultToast && (
        <div style={{
          position: 'fixed', top: '70px', left: '16px', right: '16px', zIndex: 100,
          maxWidth: '448px', margin: '0 auto',
          padding: '12px 16px', borderRadius: '12px',
          background: scanResultToast.type === 'success' ? '#064e3b' : '#7f1d1d',
          border: `1px solid ${scanResultToast.type === 'success' ? '#059669' : '#dc2626'}`,
          color: '#fff', fontSize: '0.85rem', fontWeight: '700',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
        }}>
          <span>{scanResultToast.message}</span>
          <button onClick={() => setScanResultToast(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── CONTENU SELON ONGLET ── */}
      <main style={{ padding: '16px' }}>

        {/* ══════════════════════════════════════════
            ONGLET 1 : ACCUEIL
           ══════════════════════════════════════════ */}
        {currentTab === 'accueil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Gros Bouton d'action central : SCANNER */}
            <button
              onClick={() => {
                setCurrentTab('scanner');
                setCameraActive(true);
              }}
              style={{
                width: '100%', minHeight: '64px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
                fontWeight: '900', fontSize: '1.05rem', letterSpacing: '0.02em'
              }}
            >
              <Camera size={26} />
              <span>SCANNER UN COLIS / LIVREUR</span>
            </button>

            {/* Compteurs Tactiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Dépôts Vendeurs à collecter */}
              <div
                onClick={() => {
                  setCurrentTab('stock');
                  setStockFilter('collecte_livreur');
                }}
                style={{
                  background: 'rgba(249, 115, 22, 0.08)',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                  borderRadius: '14px', padding: '14px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Truck size={18} color="#fb923c" />
                  <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fb923c' }}>
                    {vendorDeposits.length}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#f8fafc' }}>
                  À collecter
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  Dépôts pour agence
                </div>
              </div>

              {/* Colis Retrait Client */}
              <div
                onClick={() => {
                  setCurrentTab('stock');
                  setStockFilter('retrait_client');
                }}
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '14px', padding: '14px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CheckCircle2 size={18} color="#4ade80" />
                  <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#4ade80' }}>
                    {available.length}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#f8fafc' }}>
                  Retraits clients
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  En attente de retrait
                </div>
              </div>
            </div>

            {/* Bannière Règle Métier Vendeur */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px', padding: '14px',
              display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}>
              <ShieldCheck size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                <strong style={{ color: '#fff', display: 'block' }}>Attribution Agence</strong>
                Le choix de l'agence est validé par le vendeur lors de la commande. Vous remettez le colis uniquement au livreur de cette agence.
              </div>
            </div>

            {/* Liste rapide des 5 derniers colis en attente */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Activité récente
                </span>
                <button
                  onClick={() => setCurrentTab('stock')}
                  style={{
                    background: 'none', border: 'none', color: '#60a5fa',
                    fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center'
                  }}
                >
                  Tout voir ({allStockColis.length}) <ChevronRight size={14} />
                </button>
              </div>

              {allStockColis.length === 0 ? (
                <div style={{
                  padding: '2rem 1rem', textAlign: 'center', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                  color: '#64748b', fontSize: '0.82rem'
                }}>
                  Aucun colis stocké actuellement au relais.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allStockColis.slice(0, 5).map(c => {
                    const isCollecte = vendorDeposits.some(p => p.id === c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedColisDetail(c)}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '12px', padding: '12px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: isCollecte ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isCollecte ? <Truck size={16} color="#fb923c" /> : <CheckCircle2 size={16} color="#4ade80" />}
                          </div>
                          <div>
                            <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#fff', fontFamily: 'monospace' }}>
                              {c.trackingCode}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {isCollecte ? `Agence: ${c.agence || 'Assignée'}` : `Client: ${c.clientName}`}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px',
                            background: isCollecte ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: isCollecte ? '#fb923c' : '#4ade80'
                          }}>
                            {isCollecte ? 'À collecter' : 'Retrait'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            ONGLET 2 : STOCK & COLIS
           ══════════════════════════════════════════ */}
        {currentTab === 'stock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Barre de Recherche */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Rechercher code, client, vendeur..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                style={{
                  width: '100%', height: '44px', borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingLeft: '38px', paddingRight: '12px', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filtres en pilules */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
              <button
                onClick={() => setStockFilter('all')}
                style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  background: stockFilter === 'all' ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  color: '#fff'
                }}
              >
                Tous ({allStockColis.length})
              </button>
              <button
                onClick={() => setStockFilter('collecte_livreur')}
                style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  background: stockFilter === 'collecte_livreur' ? '#ea580c' : 'rgba(255,255,255,0.06)',
                  color: '#fff'
                }}
              >
                À collecter livreur ({vendorDeposits.length})
              </button>
              <button
                onClick={() => setStockFilter('retrait_client')}
                style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  background: stockFilter === 'retrait_client' ? '#16a34a' : 'rgba(255,255,255,0.06)',
                  color: '#fff'
                }}
              >
                Retraits clients ({available.length})
              </button>
            </div>

            {/* Liste des Colis */}
            {filteredStock.length === 0 ? (
              <div style={{
                padding: '3rem 1rem', textAlign: 'center', borderRadius: '16px',
                background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                color: '#64748b', fontSize: '0.85rem'
              }}>
                Aucun colis trouvé correspondant à votre recherche.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredStock.map(c => {
                  const isCollecte = vendorDeposits.some(p => p.id === c.id);
                  const isDispute = c.status === 'En réclamation' || c.claimStatus === 'OPEN';

                  return (
                    <div
                      key={c.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isDispute ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '16px', padding: '14px',
                        display: 'flex', flexDirection: 'column', gap: '10px'
                      }}
                    >
                      {/* Ligne En-tête colis */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#60a5fa', fontSize: '0.95rem' }}>
                            {c.trackingCode}
                          </span>
                          {c.pickupCode && (
                            <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
                              (Code: {c.pickupCode})
                            </span>
                          )}
                        </div>

                        <span style={{
                          fontSize: '0.72rem', fontWeight: '800', padding: '3px 8px', borderRadius: '6px',
                          background: isDispute ? 'rgba(239, 68, 68, 0.2)' : (isCollecte ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)'),
                          color: isDispute ? '#f87171' : (isCollecte ? '#fb923c' : '#4ade80')
                        }}>
                          {isDispute ? '🚨 Litige Vendeur' : (isCollecte ? 'Collecte Agence' : 'Retrait Client')}
                        </span>
                      </div>

                      {/* Infos Client & Vendeur */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Destinataire :</span>
                          <strong style={{ color: '#fff' }}>{c.clientName}</strong>
                          <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{c.clientPhone}</div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Expéditeur :</span>
                          <strong style={{ color: '#fff' }}>{c.vendeurName || 'Vendeur'}</strong>
                          <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{c.vendeurPhone || '—'}</div>
                        </div>
                      </div>

                      {/* Bloc Agence Choisie & Livreur Attendu */}
                      <div style={{
                        background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '8px 10px',
                        display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                          <Building2 size={13} color="#60a5fa" />
                          <span>Agence assignée par vendeur : <strong>{c.agence || 'Assignée'}</strong></span>
                        </div>

                        {isCollecte && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: c.livreur ? '#4ade80' : '#fb923c' }}>
                            <Truck size={13} />
                            {c.livreur ? (
                              <span>Livreur attendu : <strong>{c.livreur}</strong> {c.livreurPhone ? `(${c.livreurPhone})` : ''}</span>
                            ) : (
                              <span>En attente d'affectation d'un livreur par l'agence</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bouton d'action */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                        {isCollecte ? (
                          <button
                            onClick={() => {
                              setHandoverModalColis(c);
                              setDriverIdentifierInput('');
                              setHandoverError(null);
                            }}
                            style={{
                              flex: 1, height: '42px', borderRadius: '10px', border: 'none',
                              background: '#ea580c', color: '#fff', fontWeight: '800', fontSize: '0.82rem',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                          >
                            <Truck size={15} /> Remettre au livreur
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (isDispute) {
                                triggerToast('Retrait formellement bloqué : réclamation vendeur en cours.', 'error');
                                return;
                              }
                              setOtpModalColis(c);
                              setOtpInput('');
                              setOtpError(null);
                            }}
                            style={{
                              flex: 1, height: '42px', borderRadius: '10px', border: 'none',
                              background: isDispute ? '#334155' : '#16a34a',
                              color: isDispute ? '#94a3b8' : '#fff',
                              fontWeight: '800', fontSize: '0.82rem',
                              cursor: isDispute ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                          >
                            <CheckCircle2 size={15} /> {isDispute ? 'Retrait bloqué' : 'Remise au client (OTP)'}
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedColisDetail(c)}
                          style={{
                            height: '42px', padding: '0 12px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          Détails
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            ONGLET 3 : SCANNER CAMERA & SAISIE
           ══════════════════════════════════════════ */}
        {currentTab === 'scanner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Sélecteur de Mode de Scan */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px',
              background: 'rgba(255, 255, 255, 0.04)', padding: '4px', borderRadius: '12px'
            }}>
              <button
                onClick={() => setScannerMode('vendor_reception')}
                style={{
                  padding: '8px 4px', borderRadius: '8px', border: 'none',
                  background: scannerMode === 'vendor_reception' ? '#2563eb' : 'transparent',
                  color: scannerMode === 'vendor_reception' ? '#fff' : '#94a3b8',
                  fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', textAlign: 'center'
                }}
              >
                1. Dépôt Vendeur
              </button>
              <button
                onClick={() => setScannerMode('driver_handover')}
                style={{
                  padding: '8px 4px', borderRadius: '8px', border: 'none',
                  background: scannerMode === 'driver_handover' ? '#ea580c' : 'transparent',
                  color: scannerMode === 'driver_handover' ? '#fff' : '#94a3b8',
                  fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', textAlign: 'center'
                }}
              >
                2. Remise Livreur
              </button>
              <button
                onClick={() => setScannerMode('client_otp')}
                style={{
                  padding: '8px 4px', borderRadius: '8px', border: 'none',
                  background: scannerMode === 'client_otp' ? '#16a34a' : 'transparent',
                  color: scannerMode === 'client_otp' ? '#fff' : '#94a3b8',
                  fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', textAlign: 'center'
                }}
              >
                3. Retrait Client
              </button>
            </div>

            {/* Consigne selon le mode */}
            <div style={{
              padding: '10px 14px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.78rem', color: '#cbd5e1'
            }}>
              {scannerMode === 'vendor_reception' && (
                <div>
                  <strong style={{ color: '#60a5fa', display: 'block' }}>Réception Dépôt Vendeur :</strong>
                  Scannez le QR du colis ou le code de confirmation du vendeur. Vérifie le devis agence et décompte 1 crédit.
                </div>
              )}
              {scannerMode === 'driver_handover' && (
                <div>
                  <strong style={{ color: '#fb923c', display: 'block' }}>Remise au Livreur de l'Agence :</strong>
                  Scannez le QR dynamique du livreur. Le système vérifie strictement que le livreur appartient à l'agence du colis.
                </div>
              )}
              {scannerMode === 'client_otp' && (
                <div>
                  <strong style={{ color: '#4ade80', display: 'block' }}>Retrait Client Destinataire :</strong>
                  Scannez le colis puis saisissez le code OTP à 6 chiffres. Bloqué si réclamation vendeur en cours.
                </div>
              )}
            </div>

            {/* Zone Caméra HTML5 QR Scanner */}
            <div style={{
              background: '#000', borderRadius: '16px', overflow: 'hidden',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              minHeight: '260px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', position: 'relative'
            }}>
              {cameraActive ? (
                <div style={{ width: '100%' }}>
                  <QRScanner
                    onScanSuccess={(decodedText) => {
                      handleProcessScanCode(decodedText);
                    }}
                  />
                  <button
                    onClick={() => setCameraActive(false)}
                    style={{
                      position: 'absolute', top: '10px', right: '10px',
                      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff', borderRadius: '20px', padding: '4px 10px',
                      fontSize: '0.72rem', cursor: 'pointer', zIndex: 10
                    }}
                  >
                    Fermer caméra
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <QrCode size={56} color="#60a5fa" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                  <button
                    onClick={() => setCameraActive(true)}
                    style={{
                      padding: '10px 20px', borderRadius: '12px',
                      background: '#2563eb', border: 'none', color: '#fff',
                      fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
                    }}
                  >
                    Activer la caméra
                  </button>
                </div>
              )}
            </div>

            {/* Saisie Manuelle de Secours */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleProcessScanCode(manualCode);
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                placeholder="Ou saisir code manuel (ex: MC-123456)..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                style={{
                  flex: 1, height: '46px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', padding: '0 12px', fontSize: '0.88rem'
                }}
              />
              <button
                type="submit"
                disabled={scannerLoading || !manualCode.trim()}
                style={{
                  height: '46px', padding: '0 18px', borderRadius: '12px',
                  background: '#2563eb', border: 'none', color: '#fff',
                  fontWeight: '800', fontSize: '0.85rem',
                  cursor: scannerLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {scannerLoading ? '...' : 'Valider'}
              </button>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════
            ONGLET 4 : PLUS & GESTION
           ══════════════════════════════════════════ */}
        {currentTab === 'plus' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Carte Relais Info */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MapPin size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                    {agent?.dropPointName}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    {dropPointInfo?.address} ({agent?.dropPointCommune})
                  </p>
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Solde de crédits disponibles :</span>
                <strong style={{ fontSize: '1.1rem', color: isCreditsEmpty ? '#ef4444' : '#60a5fa' }}>
                  {dropPointCredits !== null ? dropPointCredits : '—'} crédits
                </strong>
              </div>
            </div>

            {/* Menu d'actions secondaires */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Inventaire fin de journée */}
              <button
                onClick={() => setShowInventoryModal(true)}
                style={{
                  width: '100%', minHeight: '52px', borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff', cursor: 'pointer', padding: '0 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calendar size={18} color="#60a5fa" />
                  <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>Clôture & Inventaire fin de journée</span>
                </div>
                <ChevronRight size={16} color="#64748b" />
              </button>

              {/* Afficher QR Code du Point Relais */}
              <button
                onClick={() => setShowQrModal(true)}
                style={{
                  width: '100%', minHeight: '52px', borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff', cursor: 'pointer', padding: '0 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <QrCode size={18} color="#4ade80" />
                  <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>Afficher le QR Code du Relais</span>
                </div>
                <ChevronRight size={16} color="#64748b" />
              </button>

              {/* Rafraîchir les données */}
              <button
                onClick={() => agent && loadPackages(agent.dropPointId)}
                style={{
                  width: '100%', minHeight: '52px', borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff', cursor: 'pointer', padding: '0 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <RefreshCw size={18} color="#fb923c" className={loadingData ? 'animate-spin' : ''} />
                  <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>Actualiser le stock</span>
                </div>
                <ChevronRight size={16} color="#64748b" />
              </button>
            </div>

            {/* Déconnexion */}
            <button
              onClick={async () => {
                await logout();
                window.location.href = '/auth/point-relais/login';
              }}
              style={{
                width: '100%', minHeight: '48px', borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444', fontWeight: '800', fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginTop: '12px'
              }}
            >
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        )}
      </main>

      {/* ── MODAL : REMISE AU LIVREUR DE L'AGENCE ── */}
      {handoverModalColis && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(249, 115, 22, 0.3)',
            borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '400px',
            display: 'flex', flexDirection: 'column', gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                Remise au Livreur
              </h3>
              <button onClick={() => setHandoverModalColis(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px',
              fontSize: '0.8rem', color: '#cbd5e1'
            }}>
              <div>Colis : <strong style={{ color: '#60a5fa' }}>{handoverModalColis.trackingCode}</strong></div>
              <div>Agence assignée : <strong style={{ color: '#fff' }}>{handoverModalColis.agence || 'Agence du vendeur'}</strong></div>
              {handoverModalColis.livreur && (
                <div>Livreur attendu : <strong style={{ color: '#4ade80' }}>{handoverModalColis.livreur}</strong></div>
              )}
            </div>

            {handoverError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px', padding: '10px', color: '#fca5a5', fontSize: '0.78rem', fontWeight: '700'
              }}>
                ⛔ {handoverError}
              </div>
            )}

            <form
              onSubmit={e => {
                e.preventDefault();
                submitHandoverToDriver(handoverModalColis.id, driverIdentifierInput);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8' }}>
                Identifiant ou QR dynamique du livreur :
              </label>
              <input
                type="text"
                placeholder="Scannez ou saisissez l'identifiant livreur..."
                value={driverIdentifierInput}
                onChange={e => setDriverIdentifierInput(e.target.value)}
                autoFocus
                style={{
                  height: '46px', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', padding: '0 12px', fontSize: '0.9rem'
                }}
              />

              <button
                type="submit"
                disabled={handoverLoading || !driverIdentifierInput.trim()}
                style={{
                  height: '46px', borderRadius: '10px', border: 'none',
                  background: '#ea580c', color: '#fff', fontWeight: '800', fontSize: '0.88rem',
                  cursor: handoverLoading ? 'not-allowed' : 'pointer', marginTop: '4px'
                }}
              >
                {handoverLoading ? 'Vérification...' : 'Valider la remise au livreur'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL : VALIDATION OTP RETRAIT CLIENT ── */}
      {otpModalColis && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '400px',
            display: 'flex', flexDirection: 'column', gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                Remise au Client (OTP)
              </h3>
              <button onClick={() => setOtpModalColis(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px',
              fontSize: '0.8rem', color: '#cbd5e1'
            }}>
              <div>Colis : <strong style={{ color: '#4ade80' }}>{otpModalColis.trackingCode}</strong></div>
              <div>Destinataire : <strong style={{ color: '#fff' }}>{otpModalColis.clientName}</strong> ({otpModalColis.clientPhone})</div>
              <div>Montant marchandise : <strong style={{ color: '#fff' }}>{formatPrice(otpModalColis.prixColis)}</strong></div>
            </div>

            {otpError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px', padding: '10px', color: '#fca5a5', fontSize: '0.78rem', fontWeight: '700'
              }}>
                ⛔ {otpError}
              </div>
            )}

            <form
              onSubmit={e => {
                e.preventDefault();
                submitClientOtp(otpModalColis.id, otpInput);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8' }}>
                Code OTP fourni par le client (6 chiffres) :
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                autoFocus
                style={{
                  height: '52px', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', textAlign: 'center', fontSize: '1.4rem', letterSpacing: '6px', fontWeight: '900'
                }}
              />

              <button
                type="submit"
                disabled={otpLoading || otpInput.length < 6}
                style={{
                  height: '46px', borderRadius: '10px', border: 'none',
                  background: '#16a34a', color: '#fff', fontWeight: '800', fontSize: '0.88rem',
                  cursor: otpLoading ? 'not-allowed' : 'pointer', marginTop: '4px'
                }}
              >
                {otpLoading ? 'Validation...' : 'Valider le retrait'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL : INVENTAIRE FIN DE JOURNÉE ── */}
      {showInventoryModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '420px',
            maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                Inventaire Fin de Journée
              </h3>
              <button onClick={() => setShowInventoryModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
              Scannez chaque colis présent en rayon pour clôturer la journée et détecter les écarts de stock.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#60a5fa' }}>{allStockColis.length}</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Stock théorique</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#4ade80' }}>{inventoryScannedCodes.length}</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Scannés en rayon</div>
              </div>
            </div>

            {/* Saisie pour inventaire */}
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!inventoryInput.trim()) return;
                const clean = inventoryInput.trim().toUpperCase();
                if (!inventoryScannedCodes.includes(clean)) {
                  setInventoryScannedCodes(prev => [...prev, clean]);
                  playHapticFeedback('success');
                }
                setInventoryInput('');
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                placeholder="Code tracking ou scan..."
                value={inventoryInput}
                onChange={e => setInventoryInput(e.target.value)}
                style={{
                  flex: 1, height: '42px', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', padding: '0 12px', fontSize: '0.85rem'
                }}
              />
              <button
                type="submit"
                style={{
                  height: '42px', padding: '0 14px', borderRadius: '10px',
                  background: '#2563eb', border: 'none', color: '#fff', fontWeight: '800', cursor: 'pointer'
                }}
              >
                Pointer
              </button>
            </form>

            <button
              onClick={() => {
                const ecart = allStockColis.length - inventoryScannedCodes.length;
                if (ecart === 0) {
                  triggerToast('✅ Inventaire parfait : aucun écart détecté !', 'success');
                } else {
                  triggerToast(`⚠️ Attention : écart de ${Math.abs(ecart)} colis non scanné(s).`, 'error');
                }
                setShowInventoryModal(false);
              }}
              style={{
                height: '44px', borderRadius: '10px', border: 'none',
                background: '#16a34a', color: '#fff', fontWeight: '800', fontSize: '0.85rem',
                cursor: 'pointer', marginTop: '6px'
              }}
            >
              Clôturer l'inventaire
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL : QR CODE DU POINT RELAIS (POUR AFFICHAGE COMPTOIR) ── */}
      {showQrModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 120,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px',
            textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#60a5fa', textTransform: 'uppercase' }}>
                QR Code du Point Relais
              </span>
              <button onClick={() => setShowQrModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: '#fff', borderRadius: '16px', padding: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto'
            }}>
              {/* Image QR Code dynamique encodant directement le numéro agent à 9 chiffres */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(agent?.agentNumber || agent?.dropPointId || 'dp-1')}`}
                alt="QR Code Point Relais"
                style={{ width: '180px', height: '180px', display: 'block' }}
              />
            </div>

            {/* BLOC MIS EN ÉVIDENCE : NUMÉRO DU POINT RELAIS (9 CHIFFRES) */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.12)',
              border: '2px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '16px', padding: '14px',
              display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Numéro du Point Relais (9 chiffres) :
              </span>
              <div style={{
                fontSize: '1.9rem', fontWeight: '900', letterSpacing: '4px',
                color: '#fff', fontFamily: 'monospace'
              }}>
                {agent?.agentNumber || '000000000'}
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                Communiquez ce numéro à 9 chiffres au livreur s'il ne parvient pas à scanner le QR code.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (agent?.agentNumber) {
                    navigator.clipboard.writeText(agent.agentNumber);
                    triggerToast(`Numéro relais #${agent.agentNumber} copié !`, 'success');
                  }
                }}
                style={{
                  padding: '7px 16px', borderRadius: '8px', border: 'none',
                  background: '#2563eb', color: '#fff', fontWeight: '800', fontSize: '0.8rem',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Copy size={13} /> Copier le numéro (9 chiffres)
              </button>
            </div>

            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                {agent?.dropPointName}
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Présentez ce QR Code ou votre numéro à 9 chiffres aux livreurs et clients.
              </p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              style={{
                height: '44px', borderRadius: '12px', border: 'none',
                background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: '700',
                cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL : FICHE DÉTAILLÉE DU COLIS ── */}
      {selectedColisDetail && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '420px',
            maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Fiche Colis</span>
                <div style={{ fontFamily: 'monospace', fontWeight: '900', color: '#60a5fa', fontSize: '1.1rem' }}>
                  {selectedColisDetail.trackingCode}
                </div>
              </div>
              <button onClick={() => setSelectedColisDetail(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Agence sélectionnée par le vendeur */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#60a5fa', textTransform: 'uppercase' }}>
                Attribution Agence (Choix Vendeur)
              </span>
              <div style={{ fontWeight: '800', color: '#fff', fontSize: '0.95rem' }}>
                {selectedColisDetail.agence || 'Agence Assignée'}
              </div>
              {selectedColisDetail.livreur && (
                <div style={{ fontSize: '0.78rem', color: '#4ade80', marginTop: '2px' }}>
                  Livreur attendu : <strong>{selectedColisDetail.livreur}</strong> ({selectedColisDetail.livreurPhone || ''})
                </div>
              )}
            </div>

            {/* Destinataire */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px',
              display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
                Destinataire Client
              </span>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{selectedColisDetail.clientName}</strong>
              <div style={{ color: '#cbd5e1' }}>{selectedColisDetail.clientCommune} — {selectedColisDetail.clientAddress}</div>
              {selectedColisDetail.clientPhone && (
                <a href={`tel:${selectedColisDetail.clientPhone}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '700', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} /> Appeler {selectedColisDetail.clientPhone}
                </a>
              )}
            </div>

            {/* Expéditeur */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px',
              display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
                Expéditeur Vendeur
              </span>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{selectedColisDetail.vendeurName || 'Vendeur'}</strong>
              {selectedColisDetail.vendeurPhone && (
                <a href={`tel:${selectedColisDetail.vendeurPhone}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '700', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} /> Appeler {selectedColisDetail.vendeurPhone}
                </a>
              )}
            </div>

            <button
              onClick={() => setSelectedColisDetail(null)}
              style={{
                height: '44px', borderRadius: '10px', border: 'none',
                background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: '700',
                cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── BARRE DE NAVIGATION BASSE (BOTTOM NAV MOBILE) ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        maxWidth: '480px', margin: '0 auto',
        height: '66px',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        alignItems: 'center', padding: '0 8px'
      }}>
        {/* Onglet Accueil */}
        <button
          onClick={() => setCurrentTab('accueil')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            color: currentTab === 'accueil' ? '#3b82f6' : '#64748b'
          }}
        >
          <Package size={20} />
          <span style={{ fontSize: '0.68rem', fontWeight: currentTab === 'accueil' ? '800' : '600' }}>Accueil</span>
        </button>

        {/* Onglet Stock */}
        <button
          onClick={() => setCurrentTab('stock')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            color: currentTab === 'stock' ? '#3b82f6' : '#64748b',
            position: 'relative'
          }}
        >
          <Truck size={20} />
          <span style={{ fontSize: '0.68rem', fontWeight: currentTab === 'stock' ? '800' : '600' }}>Stock</span>
          {allStockColis.length > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '22%',
              background: '#ef4444', color: '#fff', borderRadius: '10px',
              fontSize: '0.6rem', fontWeight: '900', padding: '1px 5px'
            }}>
              {allStockColis.length}
            </span>
          )}
        </button>

        {/* Onglet Scanner (Central) */}
        <button
          onClick={() => {
            setCurrentTab('scanner');
            setCameraActive(true);
          }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            color: currentTab === 'scanner' ? '#3b82f6' : '#64748b'
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: currentTab === 'scanner' ? '#2563eb' : 'rgba(59, 130, 246, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', marginTop: '-12px', boxShadow: '0 4px 12px rgba(37,99,235,0.4)'
          }}>
            <Camera size={18} />
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: currentTab === 'scanner' ? '800' : '600' }}>Scanner</span>
        </button>

        {/* Onglet Plus */}
        <button
          onClick={() => setCurrentTab('plus')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            color: currentTab === 'plus' ? '#3b82f6' : '#64748b'
          }}
        >
          <Calendar size={20} />
          <span style={{ fontSize: '0.68rem', fontWeight: currentTab === 'plus' ? '800' : '600' }}>Plus</span>
        </button>
      </nav>

    </div>
  );
}
