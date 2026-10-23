'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import CommuneSelect from '@/components/CommuneSelect';
import {
  Package, DollarSign, Users, User, ArrowRight, Truck, MapPin, Phone, Search,
  Share2, Copy, Check, Plus, X, AlertTriangle, Building2, CheckCircle2, ChevronRight,
  ChevronDown, ChevronUp, LogOut, ShieldAlert, Clock, RefreshCw, Home, Star
} from 'lucide-react';
import { dataService, ColisItem, DEFAULT_AGENCIES, DEFAULT_DROP_POINTS, DropPoint } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import CurrencyToggle from '@/components/CurrencyToggle';

// Composants du Design System Mobile
import MobileBottomNav, { MobileNavItem } from '@/components/mobile/MobileBottomNav';
import MobilePackageCard from '@/components/mobile/MobilePackageCard';
import MobilePackageDetailSheet from '@/components/mobile/MobilePackageDetailSheet';
import { MOBILE_THEME } from '@/components/mobile/MobileDesignTokens';

type Colis = ColisItem;
type Tab = 'apercu' | 'historique' | 'revenus' | 'clients' | 'profil';

export function getVendorBadge(livres: number) {
  if (livres >= 100) return { icon: '💎', label: 'Vendeur Elite', color: '#a855f7' };
  if (livres >= 40) return { icon: '⭐', label: 'Super Vendeur', color: '#eab308' };
  if (livres >= 10) return { icon: '🥉', label: 'Vendeur Actif', color: '#f97316' };
  return null;
}

export default function VendeurDashboard() {
  const { user, loading: authLoading, logout } = useAuth('vendeur');
  const { formatPrice, exchangeRate } = useCurrency();
  const [activeTab, setActiveTab] = useState<Tab>('apercu');
  const [colis, setColis] = useState<Colis[]>([]);
  const [loading, setLoading] = useState(true);

  // Panneau de détails colis au clic
  const [selectedColis, setSelectedColis] = useState<Colis | null>(null);

  // Formulaire d'expédition (Modal unique)
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Taux de conversion par agence
  const [agencyRatesMap, setAgencyRatesMap] = useState<Record<string, number>>({});

  // Champs du nouveau colis
  const [clientName, setClientName] = useState('');
  const [clientCommune, setClientCommune] = useState('');
  const [clientQuartier, setClientQuartier] = useState('');
  const [clientAvenue, setClientAvenue] = useState('');
  const [clientNumero, setClientNumero] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [prixColis, setPrixColis] = useState('');
  const [poids, setPoids] = useState('1.5');
  const [paidByClient, setPaidByClient] = useState(true);
  const [isPrepaid, setIsPrepaid] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'DIRECT' | 'DROP_POINT_FIRST_MILE'>('DIRECT');
  const [originDropPointId, setOriginDropPointId] = useState('');
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [agenciesForCommune, setAgenciesForCommune] = useState<any[]>([]);
  const [loadingAgenciesForCommune, setLoadingAgenciesForCommune] = useState(false);

  // Drop points disponibles pour le premier kilomètre
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);

  // Filtre recherche historique
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tous');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Accordéon historique revenus repliable
  const [showRevenueHistory, setShowRevenueHistory] = useState(false);

  // Paiement marchandise (séparé des frais de livraison)
  const [merchandisePrepaid, setMerchandisePrepaid] = useState(false); // false = l'agence collecte, true = déjà réglé

  // Types et état pour l'écran Virements Vendeur
  interface VendorPayoutItem {
    id: string;
    agencyId: string;
    agencyName: string;
    agencyPhone: string;
    amount: number;
    status: 'en_attente' | 'qr_genere' | 'confirme' | 'expire' | 'annule';
    rawStatus: string;
    code: string | null;
    qrPayload: string | null;
    qrImageUrl: string | null;
    expiresAt: string | null;
    rejectReason?: string | null;
    createdAt: string;
    resolvedAt?: string | null;
  }

  const [payoutRequests, setPayoutRequests] = useState<VendorPayoutItem[]>([]);
  const [revenueSubTab, setRevenueSubTab] = useState<'virements' | 'soldes'>('virements');
  const [zoomedQr, setZoomedQr] = useState<{ url: string; code: string; amount: number; agency: string } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

  // OTPs de versement en attente de confirmation (agence → vendeur)
  const [pendingPaymentOtps, setPendingPaymentOtps] = useState<Array<{
    id: string;
    agency_id: string;
    amount: number;
    expires_at: string;
    created_at: string;
    agency?: { profile?: { name: string } };
  }>>([]);
  const [otpConfirmInput, setOtpConfirmInput] = useState('');
  const [otpConfirmLoading, setOtpConfirmLoading] = useState(false);
  const [otpConfirmError, setOtpConfirmError] = useState<string | null>(null);
  const [otpConfirmSuccess, setOtpConfirmSuccess] = useState<string | null>(null);

  // Demande de versement
  const [vendorRequestModal, setVendorRequestModal] = useState<{
    agencyId: string;
    agencyName: string;
    agencyPhone: string;
    amount: number;
  } | null>(null);
  const [vendorRequestMessage, setVendorRequestMessage] = useState('');
  const [vendorRequestLoading, setVendorRequestLoading] = useState(false);
  const [vendorRequestSuccess, setVendorRequestSuccess] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Chargement des données
  const refreshColis = async () => {
    if (!user?.id) return;
    try {
      const all = await dataService.getPackagesForVendor(user.id);
      setColis(all);
    } catch (e) {
      console.warn('Erreur chargement colis:', e);
    } finally {
      setLoading(false);
    }
  };

  // Chargement des demandes de virement (ne disparaissent jamais)
  const loadPayoutRequests = async () => {
    try {
      const res = await fetch('/api/vendor/payments/request');
      if (res.ok) {
        const data = await res.json();
        setPayoutRequests(data.requests || []);
      }
    } catch {
      // silencieux
    }
  };

  // Chargement des OTPs de versement en attente (agence → vendeur)
  const loadPendingPaymentOtps = async () => {
    try {
      const res = await fetch('/api/vendor/payments/balance');
      if (res.ok) {
        const data = await res.json();
        setPendingPaymentOtps(data.pendingConfirmations ?? []);
      }
    } catch {
      // silencieux
    }
  };

  // Confirmer un versement via OTP
  const handleConfirmPaymentOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpConfirmInput.trim() || otpConfirmInput.trim().length !== 6) return;
    setOtpConfirmLoading(true);
    setOtpConfirmError(null);
    setOtpConfirmSuccess(null);
    try {
      const res = await fetch('/api/vendor/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode: otpConfirmInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpConfirmSuccess('✅ Versement confirmé avec succès ! L\'agence a bien transféré vos fonds.');
        setOtpConfirmInput('');
        await loadPendingPaymentOtps();
        await refreshColis();
        showToast('Versement confirmé !');
      } else {
        setOtpConfirmError(data.error || 'Code OTP incorrect ou expiré.');
      }
    } catch {
      setOtpConfirmError('Erreur réseau. Réessayez.');
    } finally {
      setOtpConfirmLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      refreshColis();
      loadPendingPaymentOtps();
      loadPayoutRequests();
      dataService.getAgencies().then(list => {
        const map: Record<string, number> = {};
        list.forEach(ag => { if (ag.id && ag.tauxConversionFC) map[ag.id] = ag.tauxConversionFC; });
        setAgencyRatesMap(map);
      }).catch(() => {});

      dataService.getDropPoints().then(dpList => {
        setDropPoints(dpList.filter(dp => dp.isActive));
        if (dpList.length > 0 && !originDropPointId) {
          setOriginDropPointId(dpList[0].id);
        }
      }).catch(() => {});
    }

    // Polling régulier pour détecter en temps réel la génération du QR par l'agence
    const pollInterval = setInterval(() => {
      if (user?.id) {
        loadPayoutRequests();
        loadPendingPaymentOtps();
      }
    }, 6000);

    const unsubscribe = dataService.subscribeToPackages(() => {
      refreshColis();
    });
    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [user?.id]);

  // Horloge dynamique pour le compte à rebours des demandes avec QR actif
  useEffect(() => {
    const timer = setInterval(() => {
      const updated: Record<string, string> = {};
      const now = Date.now();
      payoutRequests.forEach(req => {
        if (req.expiresAt && req.status === 'qr_genere') {
          const diff = new Date(req.expiresAt).getTime() - now;
          if (diff <= 0) {
            updated[req.id] = '00:00 (Expiré)';
          } else {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            updated[req.id] = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          }
        }
      });
      setTimeRemaining(updated);
    }, 1000);
    return () => clearInterval(timer);
  }, [payoutRequests]);

  // Synchronisation du colis sélectionné lors d'un rafraîchissement
  useEffect(() => {
    if (selectedColis) {
      const updated = colis.find(c => c.id === selectedColis.id);
      if (updated) setSelectedColis(updated);
    }
  }, [colis]);

  // Chargement des agences disponibles pour la commune de destination
  useEffect(() => {
    if (clientCommune) {
      setLoadingAgenciesForCommune(true);
      fetch(`/api/vendor/agencies?commune=${encodeURIComponent(clientCommune)}&poids=${encodeURIComponent(poids || 1)}`)
        .then(r => r.json())
        .then(data => {
          if (data.agencies) setAgenciesForCommune(data.agencies);
          else setAgenciesForCommune([]);
        })
        .catch(() => setAgenciesForCommune([]))
        .finally(() => setLoadingAgenciesForCommune(false));
    } else {
      setAgenciesForCommune([]);
    }
  }, [clientCommune, poids]);

  /* --- Calculs Statistiques (3 chiffres clés max pour l'accueil) --- */
  const colisLivres = useMemo(() => colis.filter(c => c.status === 'Livré'), [colis]);
  const colisEnCours = useMemo(() => colis.filter(c =>
    c.status === 'En transit' ||
    c.status === "En attente d'agence" ||
    c.status === 'Créé' ||
    c.status === 'Déposé en point relais' ||
    c.status === 'Disponible au point relais' ||
    c.status === 'En attente de collecte'
  ), [colis]);
  const colisIncidents = useMemo(() => colis.filter(c =>
    c.status === 'En réclamation' ||
    c.status === 'Refusé par le point relais' ||
    c.claimStatus === 'OPEN'
  ), [colis]);

  // Solde net à recevoir des agences (marchandises livrées non reversées)
  const soldeNetRecevoir = useMemo(() => {
    return colisLivres
      .filter(c => !c.isPrepaid && !c.vendorPaid)
      .reduce((s, c) => s + (c.prixColis || 0), 0);
  }, [colisLivres]);

  // Groupement par agence pour l'onglet Revenus
  const agencesFinances = useMemo(() => {
    const map = new Map<string, { agencyId: string; agencyName: string; duAuVendeur: number; phone?: string }>();
    colisLivres.forEach(c => {
      if (!c.agencyId || !c.agence) return;
      if (!map.has(c.agencyId)) {
        map.set(c.agencyId, {
          agencyId: c.agencyId,
          agencyName: c.agence,
          duAuVendeur: 0,
        });
      }
      const item = map.get(c.agencyId)!;
      if (!c.isPrepaid && !c.vendorPaid) {
        item.duAuVendeur += c.prixColis;
      }
    });
    return Array.from(map.values()).filter(a => a.duAuVendeur > 0);
  }, [colisLivres]);

  // Groupement clients uniques
  const clientsList = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; colisCount: number; lastDate: string }>();
    colis.forEach(c => {
      const key = c.clientPhone || c.clientName;
      if (!map.has(key)) {
        map.set(key, { name: c.clientName, phone: c.clientPhone, colisCount: 0, lastDate: c.date });
      }
      const cur = map.get(key)!;
      cur.colisCount += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.colisCount - a.colisCount);
  }, [colis]);

  // Filtrage des colis pour l'onglet "Colis"
  const filteredColis = useMemo(() => {
    return colis.filter(c => {
      const matchSearch =
        c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clientPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.clientCommune && c.clientCommune.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchStatus = true;
      if (statusFilter === 'En cours') matchStatus = colisEnCours.some(x => x.id === c.id);
      else if (statusFilter === 'Livrés') matchStatus = c.status === 'Livré';
      else if (statusFilter === 'Incidents') matchStatus = colisIncidents.some(x => x.id === c.id);

      return matchSearch && matchStatus;
    });
  }, [colis, searchQuery, statusFilter, colisEnCours, colisIncidents]);

  // Création d'un colis
  const handleCreateColis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const fullAddress = `${clientNumero ? 'N°' + clientNumero + ', ' : ''}${clientAvenue ? 'Av. ' + clientAvenue + ', ' : ''}${clientQuartier ? 'Q. ' + clientQuartier + ', ' : ''}${clientCommune}${clientReference ? ' (Réf: ' + clientReference + ')' : ''}`;

      const newPkg = await dataService.createPackage({
        clientName: clientName.trim(),
        clientAddress: fullAddress.trim(),
        clientPhone: clientPhone.trim(),
        clientCommune,
        prixColis: parseFloat(prixColis) || 0,
        poids: parseFloat(poids) || 1,
        vendeurId: user?.id ?? '',
        paidByClient,
        isPrepaid: merchandisePrepaid, // true = marchandise déjà réglée, false = livreur collecte
        deliveryMode,
        originDropPointId: deliveryMode === 'DROP_POINT_FIRST_MILE' ? originDropPointId : undefined,
        agencyId: selectedAgencyId || undefined,
      });

      // BUG 3 : Le devis n'est calculé qu'après le choix de l'agence
      if (newPkg?.id && selectedAgencyId) {
        try {
          await fetch(`/api/vendor/packages/${newPkg.id}/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate' }),
          });
        } catch {
          // non-bloquant
        }
      }

      await refreshColis();
      setShowModal(false);
      showToast('Colis expédié avec succès !');

      // Reset form
      setClientName('');
      setClientCommune('');
      setClientQuartier('');
      setClientAvenue('');
      setClientNumero('');
      setClientReference('');
      setClientPhone('');
      setPrixColis('');
      setIsPrepaid(false);
      setMerchandisePrepaid(false);
      setPaidByClient(true);
      setDeliveryMode('DIRECT');
      setSelectedAgencyId(null);
      setActiveTab('apercu');
    } catch {
      showToast('Erreur lors de la création du colis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Demande de versement
  const handleSendVendorRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorRequestModal) return;
    setVendorRequestLoading(true);

    try {
      const amountInCdf = Math.round(vendorRequestModal.amount * (exchangeRate || 2800));
      const res = await fetch('/api/vendor/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: vendorRequestModal.agencyId,
          agency_id: vendorRequestModal.agencyId,
          amount: amountInCdf,
          amountUsd: vendorRequestModal.amount,
          message: vendorRequestMessage.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setVendorRequestSuccess('Demande de versement transmise à l\'agence.');
        setTimeout(() => {
          setVendorRequestModal(null);
          setVendorRequestSuccess(null);
          setVendorRequestMessage('');
        }, 2000);
      } else {
        showToast(data.error || 'Impossible d\'envoyer la demande.');
      }
    } catch {
      showToast('Erreur réseau.');
    } finally {
      setVendorRequestLoading(false);
    }
  };

  const navItems: MobileNavItem[] = [
    { id: 'apercu', label: 'Accueil', icon: <Home size={20} /> },
    { id: 'historique', label: 'Colis', icon: <Package size={20} />, badge: colisEnCours.length || undefined },
    { id: 'revenus', label: 'Revenus', icon: <DollarSign size={20} /> },
    { id: 'clients', label: 'Clients', icon: <Users size={20} /> },
    { id: 'profil', label: 'Profil', icon: <User size={20} /> },
  ];

  const vendorBadge = getVendorBadge(colisLivres.length);

  return (
    <div style={{
      minHeight: '100vh',
      background: MOBILE_THEME.bg.canvas,
      color: '#fff',
      paddingBottom: '80px',
      maxWidth: '430px',
      margin: '0 auto',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Toast Alert Flottant */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: 'linear-gradient(135deg, #16a34a, #15803d)',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '12px',
          fontWeight: '700', fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'calc(100% - 2rem)', maxWidth: '400px'
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ══════════════ 1. ACCUEIL (APERCU) ══════════════ */}
      {activeTab === 'apercu' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Header Vendeur */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Espace Vendeur
              </div>
              <h1 style={{ margin: '0.1rem 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>
                Bonjour, {user?.name || 'Vendeur'}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CurrencyToggle />
              {vendorBadge && (
                <span style={{
                  padding: '0.2rem 0.5rem', borderRadius: '8px',
                  background: `${vendorBadge.color}20`, border: `1px solid ${vendorBadge.color}50`,
                  color: vendorBadge.color, fontSize: '0.72rem', fontWeight: '800'
                }}>
                  {vendorBadge.icon}
                </span>
              )}
            </div>
          </div>

          {/* ACTION PRINCIPALE UNIQUE : Expédier un colis */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: '100%',
              minHeight: '52px',
              borderRadius: MOBILE_THEME.touch.buttonRadius,
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#000',
              fontWeight: '900',
              fontSize: '1.05rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 6px 20px rgba(34, 197, 94, 0.35)',
              fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Plus size={22} strokeWidth={2.5} />
            <span>Expédier un colis</span>
          </button>

          {/* 3 CHIFFRES CLÉS MAXIMUM */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
          }}>
            {/* KPI 1 : En cours */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '14px',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: '700', display: 'block' }}>En cours</span>
              <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#60a5fa' }}>{colisEnCours.length}</span>
              <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>en acheminement</span>
            </div>

            {/* KPI 2 : Livrés */}
            <div style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '14px',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '0.7rem', color: '#86efac', fontWeight: '700', display: 'block' }}>Livrés</span>
              <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#4ade80' }}>{colisLivres.length}</span>
              <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>avec succès</span>
            </div>

            {/* KPI 3 : Reste à recevoir */}
            <div
              onClick={() => setActiveTab('revenus')}
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '14px',
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '0.7rem', color: '#fcd34d', fontWeight: '700', display: 'block' }}>À recevoir</span>
              <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {formatPrice(soldeNetRecevoir)}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8', display: 'block' }}>Voir détails →</span>
            </div>
          </div>

          {/* Alertes d'incidents (Refus relais / Réclamations en cours) */}
          {colisIncidents.length > 0 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '14px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.82rem', fontWeight: '700' }}>
                <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{colisIncidents.length} colis avec incident ou réclamation</span>
              </div>
              <button
                onClick={() => { setStatusFilter('Incidents'); setActiveTab('historique'); }}
                style={{
                  background: 'none', border: 'none', color: '#f87171',
                  fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline'
                }}
              >
                Gérer
              </button>
            </div>
          )}

          {/* SECTION : Colis en cours */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#cbd5e1', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Colis en cours ({colisEnCours.length})
              </h2>
              {colisEnCours.length > 0 && (
                <button
                  onClick={() => setActiveTab('historique')}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Tout voir
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                Chargement de vos colis...
              </div>
            ) : colisEnCours.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '2rem 1rem',
                background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                borderRadius: '16px'
              }}>
                <Package size={36} color="#475569" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ margin: '0 0 0.5rem', color: '#cbd5e1', fontWeight: '700', fontSize: '0.9rem' }}>
                  Aucun colis en acheminement
                </p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>
                  Cliquez sur « Expédier un colis » pour créer votre première livraison.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {colisEnCours.slice(0, 5).map(c => (
                  <MobilePackageCard
                    key={c.id}
                    colis={c}
                    onClick={() => setSelectedColis(c)}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ 2. TOUS LES COLIS (HISTORIQUE) ══════════════ */}
      {activeTab === 'historique' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#fff' }}>
            Mes Expéditions
          </h1>

          {/* Recherche */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Rechercher par client, téléphone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', minHeight: '44px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                padding: '0 1rem 0 2.5rem', color: '#fff', fontSize: '0.85rem'
              }}
            />
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* Filtres rapides */}
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '2px' }}>
            {['Tous', 'En cours', 'Livrés', 'Incidents'].map(filterKey => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                style={{
                  minHeight: '36px', padding: '0 0.85rem', borderRadius: '20px', border: 'none',
                  background: statusFilter === filterKey ? '#22c55e' : 'rgba(255,255,255,0.06)',
                  color: statusFilter === filterKey ? '#000' : '#cbd5e1',
                  fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {filterKey}
              </button>
            ))}
          </div>

          {/* Liste des colis */}
          {filteredColis.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              Aucun colis trouvé.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredColis.map(c => (
                <MobilePackageCard
                  key={c.id}
                  colis={c}
                  onClick={() => setSelectedColis(c)}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ 3. REVENUS & VIREMENTS (DÉDIÉ) ══════════════ */}
      {activeTab === 'revenus' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#fff' }}>
              Finance & Virements
            </h1>
            <button
              onClick={() => { loadPayoutRequests(); loadPendingPaymentOtps(); }}
              style={{
                padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', fontSize: '0.72rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <RefreshCw size={12} /> Actualiser
            </button>
          </div>

          {/* Sélecteur de sous-onglets : Virements vs Soldes */}
          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => setRevenueSubTab('virements')}
              style={{
                flex: 1, minHeight: '38px', borderRadius: '8px', border: 'none',
                background: revenueSubTab === 'virements' ? '#22c55e' : 'transparent',
                color: revenueSubTab === 'virements' ? '#000' : '#cbd5e1',
                fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <span>💸 Mes Virements</span>
              {payoutRequests.filter(r => ['en_attente', 'qr_genere'].includes(r.status)).length > 0 && (
                <span style={{
                  background: revenueSubTab === 'virements' ? '#000' : '#22c55e',
                  color: revenueSubTab === 'virements' ? '#fff' : '#000',
                  fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', fontWeight: '900'
                }}>
                  {payoutRequests.filter(r => ['en_attente', 'qr_genere'].includes(r.status)).length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setRevenueSubTab('soldes')}
              style={{
                flex: 1, minHeight: '38px', borderRadius: '8px', border: 'none',
                background: revenueSubTab === 'soldes' ? '#22c55e' : 'transparent',
                color: revenueSubTab === 'soldes' ? '#000' : '#cbd5e1',
                fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <span>📊 Soldes par agence</span>
            </button>
          </div>

          {/* ── SOUS-ONGLET 1 : ÉCRAN VIREMENTS VENDEUR ── */}
          {revenueSubTab === 'virements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Demande active la plus récente */}
              {payoutRequests.length > 0 && (() => {
                const latest = payoutRequests[0];
                const isActive = ['en_attente', 'qr_genere'].includes(latest.status);
                const isQrReady = latest.status === 'qr_genere';
                const isExpired = latest.status === 'expire';
                const isConfirmed = latest.status === 'confirme';
                const isCancelled = latest.status === 'annule';

                return (
                  <div style={{
                    background: isQrReady
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))'
                      : isExpired
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))'
                      : 'rgba(255,255,255,0.04)',
                    border: isQrReady
                      ? '2px solid rgba(34,197,94,0.5)'
                      : isExpired
                      ? '2px solid rgba(239,68,68,0.4)'
                      : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px', padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Dernière demande de virement
                      </span>
                      {/* Statuts explicites obligatoires */}
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800',
                        background: isQrReady ? 'rgba(34,197,94,0.2)' : isExpired ? 'rgba(239,68,68,0.2)' : isConfirmed ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)',
                        color: isQrReady ? '#4ade80' : isExpired ? '#f87171' : isConfirmed ? '#60a5fa' : '#fcd34d',
                        border: `1px solid ${isQrReady ? '#22c55e' : isExpired ? '#ef4444' : isConfirmed ? '#3b82f6' : '#f59e0b'}`,
                      }}>
                        {isQrReady && '📱 QR Code généré'}
                        {latest.status === 'en_attente' && '⏳ En attente de l\'agence'}
                        {isExpired && '⚠️ Expiré'}
                        {isConfirmed && '✅ Confirmé'}
                        {isCancelled && '❌ Annulé'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                          Agence : <strong style={{ color: '#fff' }}>{latest.agencyName}</strong>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff', marginTop: '2px' }}>
                          {latest.amount.toLocaleString('fr-FR')} CDF
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Demandé le {new Date(latest.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </div>

                      {/* Compte à rebours dynamique de validité */}
                      {isQrReady && (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.68rem', color: '#86efac', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                            Validité
                          </span>
                          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#4ade80', fontFamily: 'monospace' }}>
                            ⏱️ {timeRemaining[latest.id] || '15:00'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Affichage du QR code et du code de secours dès que l'agence le génère */}
                    {isQrReady && (
                      <div style={{
                        background: 'rgba(0,0,0,0.4)', borderRadius: '16px', padding: '1rem',
                        textAlign: 'center', marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.3)'
                      }}>
                        <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: '#86efac', fontWeight: '700' }}>
                          Présentez ce QR Code à l'agence pour percevoir votre virement :
                        </p>
                        {latest.qrImageUrl && (
                          <div style={{ display: 'inline-block', background: '#fff', padding: '10px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                            onClick={() => setZoomedQr({ url: latest.qrImageUrl!, code: latest.code || '', amount: latest.amount, agency: latest.agencyName })}>
                            <img src={latest.qrImageUrl} alt="QR Virement" style={{ width: '180px', height: '180px', display: 'block' }} />
                            <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', display: 'block' }}>🔍 Toucher pour agrandir</span>
                          </div>
                        )}

                        {/* Code de secours à 6 chiffres */}
                        {latest.code && (
                          <div style={{ marginTop: '0.85rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '2px' }}>
                              Code de secours à 6 chiffres
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '8px', color: '#fbbf24', fontFamily: 'monospace' }}>
                                {latest.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (latest.code) {
                                    navigator.clipboard.writeText(latest.code);
                                    showToast('Code copié !');
                                  }
                                }}
                                style={{
                                  padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(251,191,36,0.4)',
                                  background: 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700'
                                }}
                              >
                                Copier
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Si expirée : afficher « Expiré » avec « Refaire la demande » */}
                    {isExpired && (
                      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                        <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: '#f87171' }}>
                          Le délai de validité de ce versement a expiré avant confirmation. Les fonds sont restés sur votre solde.
                        </p>
                        <button
                          type="button"
                          onClick={() => setVendorRequestModal({
                            agencyId: latest.agencyId,
                            agencyName: latest.agencyName,
                            agencyPhone: latest.agencyPhone,
                            amount: latest.amount,
                          })}
                          style={{
                            width: '100%', minHeight: '44px', borderRadius: '10px', border: 'none',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
                            fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                        >
                          <RefreshCw size={15} /> Refaire la demande de versement
                        </button>
                      </div>
                    )}

                    {/* Si en attente de l'agence */}
                    {latest.status === 'en_attente' && (
                      <div style={{ textAlign: 'center', padding: '0.4rem 0', color: '#fcd34d', fontSize: '0.78rem' }}>
                        ⏳ L'agence prépare votre virement. Dès qu'elle valide, le QR Code et le code de confirmation apparaîtront ici automatiquement.
                      </div>
                    )}

                    {/* Saisie de validation manuelle si code disponible */}
                    {isQrReady && (
                      <form onSubmit={handleConfirmPaymentOtp} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {otpConfirmSuccess ? (
                          <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '0.8rem', fontWeight: '700', textAlign: 'center' }}>
                            {otpConfirmSuccess}
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (latest.code) setOtpConfirmInput(latest.code);
                              }}
                              style={{
                                background: 'transparent', border: 'none', color: '#60a5fa',
                                fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-start'
                              }}
                            >
                              Pré-remplir avec le code de secours
                            </button>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="Code reçu"
                                value={otpConfirmInput}
                                onChange={e => { setOtpConfirmInput(e.target.value.replace(/\D/g, '')); setOtpConfirmError(null); }}
                                style={{
                                  flex: 1, height: '42px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)',
                                  border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '1.2rem',
                                  textAlign: 'center', letterSpacing: '4px', fontWeight: '800'
                                }}
                              />
                              <button
                                type="submit"
                                disabled={otpConfirmLoading || otpConfirmInput.length !== 6}
                                style={{
                                  padding: '0 1rem', height: '42px', borderRadius: '8px', border: 'none',
                                  background: otpConfirmInput.length === 6 ? '#22c55e' : 'rgba(255,255,255,0.1)',
                                  color: otpConfirmInput.length === 6 ? '#000' : '#64748b', fontWeight: '800',
                                  fontSize: '0.78rem', cursor: otpConfirmInput.length === 6 ? 'pointer' : 'not-allowed'
                                }}
                              >
                                {otpConfirmLoading ? '...' : 'Valider réception'}
                              </button>
                            </div>
                            {otpConfirmError && (
                              <div style={{ color: '#f87171', fontSize: '0.72rem' }}>{otpConfirmError}</div>
                            )}
                          </>
                        )}
                      </form>
                    )}
                  </div>
                );
              })()}

              {/* Historique persistant des demandes de virement : une demande ne disparaît JAMAIS */}
              <div>
                <h2 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#cbd5e1', margin: '0 0 0.5rem', textTransform: 'uppercase' }}>
                  Historique de vos demandes ({payoutRequests.length})
                </h2>

                {payoutRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: '#64748b', fontSize: '0.8rem' }}>
                    Aucune demande de virement émise pour l'instant. Rendez-vous dans l'onglet "Soldes par agence" pour en demander une.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {payoutRequests.map(req => {
                      const isExpired = req.status === 'expire';
                      const isQr = req.status === 'qr_genere';
                      const isPending = req.status === 'en_attente';
                      const isPaid = req.status === 'confirme';

                      return (
                        <div
                          key={req.id}
                          style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '12px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#fff' }}>
                              {req.agencyName}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {new Date(req.createdAt).toLocaleDateString('fr-FR')} · {req.amount.toLocaleString('fr-FR')} CDF
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '8px',
                              background: isPaid ? 'rgba(59,130,246,0.15)' : isQr ? 'rgba(34,197,94,0.15)' : isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: isPaid ? '#60a5fa' : isQr ? '#4ade80' : isExpired ? '#f87171' : '#fcd34d',
                            }}>
                              {isPaid && 'Confirmé'}
                              {isQr && 'QR Prêt'}
                              {isPending && 'En attente'}
                              {isExpired && 'Expiré'}
                              {req.status === 'annule' && 'Annulé'}
                            </span>

                            {isExpired && (
                              <button
                                type="button"
                                onClick={() => setVendorRequestModal({
                                  agencyId: req.agencyId,
                                  agencyName: req.agencyName,
                                  agencyPhone: req.agencyPhone,
                                  amount: req.amount,
                                })}
                                style={{
                                  padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.4)',
                                  background: 'rgba(245,158,11,0.1)', color: '#fcd34d', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer'
                                }}
                              >
                                Refaire
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SOUS-ONGLET 2 : SOLDES & LIVRAISONS ── */}
          {revenueSubTab === 'soldes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Chiffre principal : Reste à recevoir */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '20px',
                padding: '1.25rem',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '0.8rem', color: '#fcd34d', fontWeight: '700', textTransform: 'uppercase' }}>
                  Reste net à recevoir
                </span>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', margin: '0.2rem 0' }}>
                  {formatPrice(soldeNetRecevoir)}
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                  Marchandises livrées par les agences en attente de versement.
                </p>
              </div>

              {/* Soldes par Agence */}
              <div>
                <h2 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#cbd5e1', margin: '0 0 0.5rem', textTransform: 'uppercase' }}>
                  Détail par Agence
                </h2>

                {agencesFinances.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px', color: '#64748b', fontSize: '0.82rem'
                  }}>
                    Aucun versement en attente. Tout est à jour !
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {agencesFinances.map(ag => (
                      <div
                        key={ag.agencyId}
                        style={{
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '14px', padding: '0.9rem', display: 'flex',
                          justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#fff' }}>
                            {ag.agencyName}
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#4ade80', marginTop: '0.2rem' }}>
                            {formatPrice(ag.duAuVendeur)}
                          </div>
                        </div>

                        <button
                          onClick={() => setVendorRequestModal({
                            agencyId: ag.agencyId,
                            agencyName: ag.agencyName,
                            agencyPhone: ag.phone || '',
                            amount: ag.duAuVendeur,
                          })}
                          style={{
                            padding: '0.5rem 0.85rem', borderRadius: '10px', border: 'none',
                            background: '#22c55e', color: '#000', fontWeight: '800',
                            fontSize: '0.78rem', cursor: 'pointer'
                          }}
                        >
                          Demander
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historique repliable */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px', overflow: 'hidden'
          }}>
            <button
              onClick={() => setShowRevenueHistory(!showRevenueHistory)}
              style={{
                width: '100%', minHeight: '48px', padding: '0.75rem 1rem', background: 'none',
                border: 'none', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', fontSize: '0.85rem'
              }}
            >
              <span>Historique complet des colis livrés ({colisLivres.length})</span>
              {showRevenueHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showRevenueHistory && (
              <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {colisLivres.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center' }}>Aucun colis livré</div>
                ) : (
                  colisLivres.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedColis(c)}
                      style={{
                        padding: '0.6rem 0.75rem', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div>
                        <strong style={{ color: '#fff' }}>{c.clientName}</strong>
                        <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{c.date} · {c.agence || 'Direct'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: '800', color: c.vendorPaid ? '#4ade80' : '#fb923c' }}>
                          {formatPrice(c.prixColis)}
                        </span>
                        <div style={{ fontSize: '0.68rem', color: c.vendorPaid ? '#4ade80' : '#fb923c' }}>
                          {c.vendorPaid ? 'Reversé' : 'À reverser'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ 4. CLIENTS ══════════════ */}
      {activeTab === 'clients' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#fff' }}>
            Mes Clients ({clientsList.length})
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {clientsList.map((client, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '14px', padding: '0.9rem', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#fff' }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {client.colisCount} commande{client.colisCount > 1 ? 's' : ''} · Dernier : {client.lastDate}
                  </div>
                </div>

                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.4rem 0.75rem', borderRadius: '20px',
                      background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80',
                      textDecoration: 'none', fontSize: '0.78rem', fontWeight: '700'
                    }}
                  >
                    <Phone size={13} /> {client.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ 5. PROFIL ══════════════ */}
      {activeTab === 'profil' && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#fff' }}>
            Mon Profil Vendeur
          </h1>

          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.2rem'
              }}>
                {(user?.name || 'V')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>{user?.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{user?.email || user?.phone}</div>
              </div>
            </div>

            {vendorBadge && (
              <div style={{
                padding: '0.5rem 0.75rem', borderRadius: '10px',
                background: `${vendorBadge.color}15`, border: `1px solid ${vendorBadge.color}40`,
                display: 'flex', alignItems: 'center', gap: '0.5rem', color: vendorBadge.color,
                fontSize: '0.82rem', fontWeight: '800'
              }}>
                {vendorBadge.icon} Rang : {vendorBadge.label} ({colisLivres.length} colis livrés)
              </div>
            )}
          </div>

          <button
            onClick={() => logout()}
            style={{
              minHeight: '48px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: '800',
              fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.5rem'
            }}
          >
            <LogOut size={18} /> Se déconnecter
          </button>
        </div>
      )}

      {/* ══════════════ MODAL FORMULAIRE UNIQUE : EXPÉDIER UN COLIS ══════════════ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: '#0d1322', borderTop: '1px solid rgba(255,255,255,0.15)',
            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
            padding: '1.25rem 1rem 2rem', color: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>
                Nouvelle Expédition
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateColis} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Nom complet du client :
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Mukendi"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  style={{
                    width: '100%', minHeight: '44px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                    padding: '0 0.85rem', color: '#fff', fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Téléphone du client (pour code OTP) :
                </label>
                <input
                  type="tel"
                  required
                  placeholder="081XXXXXXX ou +243..."
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  style={{
                    width: '100%', minHeight: '44px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                    padding: '0 0.85rem', color: '#fff', fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Commune de destination :
                </label>
                <CommuneSelect
                  value={clientCommune}
                  onChange={val => setClientCommune(val)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                    N° :
                  </label>
                  <input
                    type="text"
                    placeholder="12"
                    value={clientNumero}
                    onChange={e => setClientNumero(e.target.value)}
                    style={{
                      width: '100%', minHeight: '44px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                      padding: '0 0.6rem', color: '#fff', fontSize: '0.9rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                    Avenue / Rue :
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Av. de la Paix"
                    value={clientAvenue}
                    onChange={e => setClientAvenue(e.target.value)}
                    style={{
                      width: '100%', minHeight: '44px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                      padding: '0 0.75rem', color: '#fff', fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Valeur de la marchandise (en USD) :
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ex: 25.00"
                  value={prixColis}
                  onChange={e => setPrixColis(e.target.value)}
                  style={{
                    width: '100%', minHeight: '44px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                    padding: '0 0.85rem', color: '#fff', fontSize: '1rem', fontWeight: '700'
                  }}
                />
              </div>

              {/* ── Section Poids du colis (en kg) ── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1' }}>
                    Poids du colis (en kg) * :
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: '800' }}>
                    {poids || 1} kg
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="500"
                  required
                  placeholder="Ex: 1.5"
                  value={poids}
                  onChange={e => setPoids(e.target.value)}
                  style={{
                    width: '100%', minHeight: '44px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                    padding: '0 0.85rem', color: '#fff', fontSize: '1rem', fontWeight: '700'
                  }}
                />
                {/* Raccourcis de poids rapides */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  {['0.5', '1', '2', '5', '10', '20'].map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPoids(w)}
                      style={{
                        padding: '0.2rem 0.6rem', borderRadius: '6px',
                        border: poids === w ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                        background: poids === w ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                        color: poids === w ? '#93c5fd' : '#94a3b8',
                        fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer'
                      }}
                    >
                      {w} kg
                    </button>
                  ))}
                </div>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                  Les agences dont la capacité maximale est inférieure à ce poids seront automatiquement masquées.
                </p>
              </div>

              {/* Mode d'expédition : Direct ou Premier Kilomètre au relais */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Option de dépôt :
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('DIRECT')}
                    style={{
                      minHeight: '42px', borderRadius: '10px',
                      border: deliveryMode === 'DIRECT' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                      background: deliveryMode === 'DIRECT' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                      color: deliveryMode === 'DIRECT' ? '#4ade80' : '#94a3b8',
                      fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer'
                    }}
                  >
                    Ramassage chez moi
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('DROP_POINT_FIRST_MILE')}
                    style={{
                      minHeight: '42px', borderRadius: '10px',
                      border: deliveryMode === 'DROP_POINT_FIRST_MILE' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                      background: deliveryMode === 'DROP_POINT_FIRST_MILE' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                      color: deliveryMode === 'DROP_POINT_FIRST_MILE' ? '#4ade80' : '#94a3b8',
                      fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer'
                    }}
                  >
                    Je dépose au relais
                  </button>
                </div>
              </div>

              {deliveryMode === 'DROP_POINT_FIRST_MILE' && dropPoints.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.3rem' }}>
                    Choisir votre Point Relais de dépôt :
                  </label>
                  <select
                    value={originDropPointId}
                    onChange={e => setOriginDropPointId(e.target.value)}
                    style={{
                      width: '100%', minHeight: '44px', borderRadius: '10px',
                      background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)',
                      padding: '0 0.75rem', color: '#fff', fontSize: '0.85rem'
                    }}
                  >
                    {dropPoints.map(dp => (
                      <option key={dp.id} value={dp.id}>
                        {dp.name} ({dp.commune}) — {dp.code || dp.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Étape : Choisir une agence */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Attribuer à une agence de livraison :
                </label>

                {/* Option "Laisser les agences se positionner" */}
                <div
                  onClick={() => setSelectedAgencyId(null)}
                  style={{
                    padding: '0.65rem 0.75rem', borderRadius: '10px', marginBottom: '0.5rem',
                    background: selectedAgencyId === null ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                    border: selectedAgencyId === null ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: '700', color: selectedAgencyId === null ? '#fcd34d' : '#e2e8f0' }}>
                      Laisser les agences se positionner
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      Visible par toutes les agences agréées couvrant la zone.
                    </div>
                  </div>
                  {selectedAgencyId === null && <Check size={16} color="#fcd34d" />}
                </div>

                {/* Agences filtrées */}
                {loadingAgenciesForCommune ? (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0.3rem 0' }}>Recherche des agences...</div>
                ) : agenciesForCommune.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {agenciesForCommune.map((ag: any) => {
                      const isSelected = selectedAgencyId === ag.id;
                      return (
                        <div
                          key={ag.id}
                          onClick={() => setSelectedAgencyId(ag.id)}
                          style={{
                            padding: '0.6rem 0.75rem', borderRadius: '10px',
                            background: isSelected ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                            border: isSelected ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: isSelected ? '#4ade80' : '#fff' }}>
                              {ag.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', color: '#94a3b8' }}>
                              <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Star size={10} fill="#fbbf24" /> {ag.rating}
                              </span>
                              <span>&bull;</span>
                              <span>~{ag.avgDeliveryHours}h</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#4ade80' }}>
                              {formatPrice(ag.estimatedDeliveryPrice)}
                            </div>
                            <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Tarif estimé</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : clientCommune ? (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', padding: '0.2rem 0' }}>
                    Aucune agence dédiée pour cette commune pour le moment. L'option "Laisser se positionner" sera appliquée.
                  </div>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Sélectionnez d'abord une commune de destination pour voir les agences disponibles.
                  </div>
                )}
              </div>

              {/* ── Paiement de la marchandise ── */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  💰 Paiement de la marchandise :
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setMerchandisePrepaid(false)}
                    style={{
                      minHeight: '60px', borderRadius: '10px', padding: '0.6rem 0.4rem',
                      border: !merchandisePrepaid ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      background: !merchandisePrepaid ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      color: !merchandisePrepaid ? '#fcd34d' : '#94a3b8',
                      fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>🏦</span>
                    <span>Agence collecte</span>
                    <span style={{ fontSize: '0.62rem', opacity: 0.75, textAlign: 'center' }}>Livreur récupère le montant chez le client (COD)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMerchandisePrepaid(true)}
                    style={{
                      minHeight: '60px', borderRadius: '10px', padding: '0.6rem 0.4rem',
                      border: merchandisePrepaid ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                      background: merchandisePrepaid ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                      color: merchandisePrepaid ? '#4ade80' : '#94a3b8',
                      fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>✅</span>
                    <span>Déjà réglé</span>
                    <span style={{ fontSize: '0.62rem', opacity: 0.75, textAlign: 'center' }}>Client a déjà payé la marchandise</span>
                  </button>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 }}>
                  {!merchandisePrepaid
                    ? '🚚 Le livreur récupèrera le montant de la marchandise en espèces chez le client.'
                    : '✅ Le client a déjà réglé la marchandise. Le livreur ne collecte rien pour la marchandise.'
                  }
                </p>
              </div>

              {/* ── Qui paie les frais de livraison ? ── */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  🚚 Frais de livraison à la charge de :
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => { setPaidByClient(true); setIsPrepaid(false); }}
                    style={{
                      minHeight: '52px', borderRadius: '10px', padding: '0.5rem',
                      border: paidByClient ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                      background: paidByClient ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                      color: paidByClient ? '#93c5fd' : '#94a3b8',
                      fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>🛒</span>
                    <span>Le client paie</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>COD à la livraison</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaidByClient(false); setIsPrepaid(true); }}
                    style={{
                      minHeight: '52px', borderRadius: '10px', padding: '0.5rem',
                      border: !paidByClient ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      background: !paidByClient ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      color: !paidByClient ? '#fcd34d' : '#94a3b8',
                      fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>🏪</span>
                    <span>Le vendeur paie</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>Frais déduits du reversement</span>
                  </button>
                </div>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 }}>
                  {paidByClient
                    ? '✅ Le livreur encaisse les frais de livraison auprès du client.'
                    : '✅ L\'agence déduit les frais de livraison de votre reversement.'
                  }
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%', minHeight: '50px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#000',
                  fontWeight: '900', fontSize: '1rem', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  marginTop: '0.5rem', boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
                }}
              >
                {isSubmitting ? 'Enregistrement...' : 'Valider l\'expédition'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL DEMANDE DE VERSEMENT IN-APP ══════════════ */}
      {vendorRequestModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '20px',
            padding: '1.5rem', width: '100%', maxWidth: '380px', color: '#fff'
          }}>
            <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.15rem', fontWeight: '800' }}>
              Demander mon versement
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              À l'agence <strong>{vendorRequestModal.agencyName}</strong>
            </p>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.85rem', borderRadius: '10px', marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>MONTANT DÛ</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#4ade80' }}>
                {formatPrice(vendorRequestModal.amount)}
              </div>
            </div>

            {vendorRequestSuccess && (
              <div style={{ color: '#4ade80', fontSize: '0.82rem', marginBottom: '0.8rem', fontWeight: '700' }}>
                {vendorRequestSuccess}
              </div>
            )}

            <form onSubmit={handleSendVendorRequest}>
              <input
                type="text"
                placeholder="Message optionnel pour l'agence..."
                value={vendorRequestMessage}
                onChange={e => setVendorRequestMessage(e.target.value)}
                style={{
                  width: '100%', minHeight: '44px', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)',
                  padding: '0 0.75rem', color: '#fff', fontSize: '0.85rem', marginBottom: '1rem'
                }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setVendorRequestModal(null)}
                  style={{
                    flex: 1, height: '44px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: '#94a3b8', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={vendorRequestLoading}
                  style={{
                    flex: 1, height: '44px', borderRadius: '10px', border: 'none',
                    background: '#22c55e', color: '#000', fontWeight: '800', fontSize: '0.85rem',
                    cursor: vendorRequestLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {vendorRequestLoading ? 'Envoi...' : 'Transmettre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ PANNEAU COULISSANT DÉTAILS COLIS ══════════════ */}
      <MobilePackageDetailSheet
        colis={selectedColis}
        isOpen={Boolean(selectedColis)}
        onClose={() => setSelectedColis(null)}
        formatPrice={formatPrice}
        role="vendeur"
        onRefresh={refreshColis}
        onClaimSubmitted={() => {
          refreshColis();
          showToast('Réclamation enregistrée !');
        }}
      />

      {/* ══════════════ BARRE DE NAVIGATION BASSE (5 ONGLETS MAX) ══════════════ */}
      <MobileBottomNav
        items={navItems}
        activeId={activeTab}
        onChange={id => setActiveTab(id as Tab)}
      />
    </div>
  );
}
