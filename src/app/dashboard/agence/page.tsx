'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Bell, Truck, ClipboardList, Star, Settings, CheckCircle, XCircle, Clock, Copy, Check, KeyRound, LogOut, DollarSign, Lock, MapPin, Smartphone, Car, X, Package, User, Phone, Store, ChevronRight, AlertCircle, Navigation, QrCode, ScanLine, Camera } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import { COMMUNES_KINSHASA } from '@/lib/constants';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';

// --- Types -----------------------------------------------------------------
type KmStatus = 'idle' | 'loading' | 'calculated' | 'done' | 'error';

interface Livreur {
  id: string;
  name: string;
  phone: string;
  pinCode: string;
  vehicle: string;
  available: boolean;
  deliveries: number;
  rating: number;
  joinedDate: string;
}

interface Quotation {
  basePrice: number;
  commune: string;
  distanceTotal: number;
  distancePrice: number;
  weightTotal: number;
  weightPrice: number;
  totalFinale: number;
}

interface Colis {
  id: string;
  trackId: string;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  status: 'En attente' | 'Accepté' | 'Refusé' | 'Assigné' | 'En transit' | 'Livré' | 'Annulé';
  vendeur: string;
  vendeurName?: string;
  vendeurAddress?: string | null;
  vendeurId: string;
  driverId: string | null;
  date: string;
  otp: string;
  prixColis: number;
  prixLivraison: number | null;
  distanceKm: number;
  poids: number;
  paidByClient: boolean;
  vendorPaid: boolean;
  isPrepaid?: boolean;
  clientCommune?: string;
  quotation?: Quotation | null;
}


// --- Status colors ----------------------------------------------------------
const statusStyle: Record<string, string> = {
  'En attente': '#f59e0b',
  'Accepté':    '#3b82f6',
  'Refusé':     '#ef4444',
  'Assigné':    '#8b5cf6',
  'En transit': '#06b6d4',
  'Livré':      '#10b981',
  'Annulé':     '#6b7280',
};

// --- Sub-components ---------------------------------------------------------
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: color || 'var(--primary)', opacity: 0.08, borderRadius: '0 0 0 80px' }} />
      <p style={{ fontSize: '0.85rem', opacity: 0.65, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '2.2rem', fontWeight: '800', color: color || 'var(--primary)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '0.4rem' }}>{sub}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------------
export function getVendorBadge(livres: number) {
  if (livres >= 100) return { icon: '💎', label: 'Vendeur Elite', color: '#a855f7' };
  if (livres >= 40) return { icon: '⭐', label: 'Super Vendeur', color: '#eab308' };
  if (livres >= 10) return { icon: '🥉', label: 'Vendeur Actif', color: '#f97316' };
  return null;
}

// -----------------------------------------------------------------------------
export default function AgenceDashboard() {
  const { user, loading: authLoading, logout } = useAuth('agence');
  const { formatPrice, exchangeRate } = useCurrency();
  const [activeTab, setActiveTab] = useState<'demandes' | 'livreurs' | 'historique' | 'vendeurs' | 'parametres' | 'finances' | 'marketing_securite'>('demandes');
  const [colis, setColis]         = useState<Colis[]>([]);
  const [livreurs, setLivreurs]   = useState<Livreur[]>([]);

  // Changement de mot de passe
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Marketing & Sécurité
  const [proSettings, setProSettings] = useState({
    requireManagerApproval: true,
    enforceHours: false,
    allowedStartTime: '08:00',
    allowedEndTime: '18:30',
    volumeDiscountEnabled: false,
    volumeThreshold: 10,
    volumeDiscountPercent: 10,
  });
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', discountPercent: 10 });

  async function handleProSettingsUpdate(updates: Partial<typeof proSettings>) {
    setProSettings(prev => ({ ...prev, ...updates }));
    try {
      await fetch('/api/agency/pro-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreatePromo() {
    if (!promoForm.code) return;
    try {
      const res = await fetch('/api/agency/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoForm.code, discountPercent: promoForm.discountPercent })
      });
      if (res.ok) {
        setPromoForm({ code: '', discountPercent: 10 });
        const resCodes = await fetch('/api/agency/promo-codes');
        if (resCodes.ok) setPromoCodes((await resCodes.json()).codes || []);
      } else {
        alert((await res.json()).error);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Synchronisation avec dataService — uniquement les colis assignés à cette agence
  useEffect(() => {
    if (!user?.agencyId) return; // wait until session is loaded

    let unsubscribe: () => void;

    async function loadLiveData() {
      try {
        const { dataService } = await import('@/lib/data-service');
        const live = await dataService.getPackagesForAgency(user!.agencyId!);

        if (live && live.length > 0) {
          const mapped: Colis[] = live.map(p => ({
            id: p.id,
            trackId: p.trackingCode,
            clientName: p.clientName,
            clientAddress: p.clientAddress,
            clientPhone: p.clientPhone,
            // Only show packages that were explicitly sent to this agency
            status: (
              p.status === "En attente d'agence" ? 'En attente' :
              p.status === 'Accepté'              ? 'Accepté' :
              p.status === 'En transit'           ? 'En transit' :
              p.status === 'Livré'                ? 'Livré' :
              p.status === 'Annulé'               ? 'Annulé' :
              'En attente'
            ) as Colis['status'],
            vendeur: p.agence || 'Boutique',
            vendeurId: p.vendeurId || 'UNKNOWN',
            vendeurAddress: p.vendeurAddress || null,
            driverId: p.driverId || null,
            date: p.date,
            otp: p.otp,
            prixColis: p.prixColis,
            prixLivraison: p.prixLivraison || null,
            distanceKm: p.distance || 0,
            poids: p.poids || 1,
            paidByClient: p.paidByClient,
            vendorPaid: p.vendorPaid,
            isPrepaid: p.isPrepaid ?? false,
            clientCommune: p.clientCommune,
            vendeurName: p.vendeurName || undefined,
          }));
          setColis(mapped);
        } else {
          setColis([]); // no packages assigned yet
        }

        const liveDrivers = await dataService.getDriversForAgency(user!.agencyId!);
        if (liveDrivers && liveDrivers.length > 0) {
          const mappedDrivers: Livreur[] = liveDrivers.map(d => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            deliveries: d.deliveries || 0,
            status: d.available ? 'Actif' : 'Occupé',
            vehicle: d.vehicle || 'Moto',
            pinCode: '****',
            available: d.available || false,
            rating: 5.0,
            joinedDate: new Date().toISOString().split('T')[0],
          }));
          setLivreurs(mappedDrivers);
        } else {
          setLivreurs([]);
        }

        const cp = await dataService.getAgencyCommunePrices(user!.agencyId!);
        // Also load price_per_km and price_per_kg from the agency record directly
        const agList = await dataService.getAgencies();
        const thisAgency = agList.find(a => a.id === user!.agencyId!);

        // Store agency address for km calculation
        if (thisAgency?.address) setAgencyAddress(thisAgency.address);
        if (thisAgency) setAgencyProfile(thisAgency);

        setGlobalSettings(prev => {
          const baseCommunes = COMMUNES_KINSHASA.map(name => ({ name, base: 0 }));
          const newCommunes = baseCommunes.map(c => {
            const override = cp.find((p: any) => p.commune === c.name);
            return override ? { ...c, base: override.price } : c;
          });
          return {
            ...prev,
            communes: newCommunes,
            defaultPricePerKm: thisAgency?.pricePerKm ?? prev.defaultPricePerKm,
            defaultPricePerKg: thisAgency?.pricePerKg ?? prev.defaultPricePerKg,
            // Charger le taux propre à l'agence (s'il est défini en DB)
            tauxConversionFC: thisAgency?.tauxConversionFC ?? prev.tauxConversionFC,
          };
        });

        // Charger le plafond du super admin depuis system_settings
        try {
          const { supabase: sb } = await import('@/utils/supabase/client');
          const { data: sysSettings } = await sb
            .from('system_settings')
            .select('exchange_rate')
            .eq('id', 'global')
            .single();
          if (sysSettings?.exchange_rate) {
            setPlafondAdmin(sysSettings.exchange_rate);
          }
        } catch {
          // Garde la valeur par défaut 2900
        }

        unsubscribe = dataService.subscribeToPackages(() => {
          loadLiveData();
        });
      } catch (err) {
        console.error('Error loading live data:', err);
      }
    }

    async function loadProSettings() {
      try {
        const res = await fetch('/api/agency/pro-settings');
        if (res.ok) {
          const json = await res.json();
          if (json.settings) {
            setProSettings({
              requireManagerApproval: json.settings.require_manager_approval,
              enforceHours: json.settings.enforce_hours,
              allowedStartTime: json.settings.allowed_start_time,
              allowedEndTime: json.settings.allowed_end_time,
              volumeDiscountEnabled: json.settings.volume_discount_enabled,
              volumeThreshold: json.settings.volume_threshold,
              volumeDiscountPercent: json.settings.volume_discount_percent,
            });
          }
        }
        const resCodes = await fetch('/api/agency/promo-codes');
        if (resCodes.ok) {
          const jsonCodes = await resCodes.json();
          if (jsonCodes.codes) setPromoCodes(jsonCodes.codes);
        }
      } catch (e) {}
    }

    loadLiveData();
    loadDriverCashRequests();
    loadVendorPaymentRequests();
    loadProSettings();


    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.agencyId]);



  // Livreur modal
  const [showAddLivreur, setShowAddLivreur] = useState(false);
  const [newName, setNewName]     = useState('');
  const [newPhone, setNewPhone]   = useState('');
  const [newVehicle, setNewVehicle] = useState('Moto');
  const [newPin, setNewPin]       = useState('');
  const [createdDriver, setCreatedDriver] = useState<{ name: string; pin: string; phone: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [resetPinDriver, setResetPinDriver] = useState<{ id: string; name: string } | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');
  const [resetPinLoading, setResetPinLoading] = useState(false);
  const [resetPinResult, setResetPinResult] = useState<{ pin: string; name: string } | null>(null);

  // Formulaire de calcul tarifaire (Devis / Quotation)
  const [quotations, setQuotations] = useState<Record<string, Quotation>>({});

  // Paramètres de prix modifiables par l'agence (pour un colis spécifique en cours d'édition)
  const [pricingParams, setPricingParams] = useState<Record<string, { commune: string, basePrice: number, pricePerKm: number, pricePerKg: number }>>({});

  // Adresse de l'agence (pour calcul kilométrique)
  const [agencyAddress, setAgencyAddress] = useState<string>('');
  const [agencyProfile, setAgencyProfile] = useState<any>(null);

  // Calcul kilométrique automatique par colis
  const [distanceCalc, setDistanceCalc] = useState<Record<string, { status: KmStatus; km?: number; error?: string }>>({});

  // Modal de confirmation de paiement sécurisée
  const [paymentConfirmationModal, setPaymentConfirmationModal] = useState<{
    type: 'bulk' | 'single';
    vendorId?: string;
    vendorName?: string;
    colisId?: string;
    amount: number;
    inputText: string;
  } | null>(null);

  // Système OTP de paiement vendeur
  const [otpPaymentModal, setOtpPaymentModal] = useState<{
    vendorId: string;
    vendorName: string;
    amount: number;
    requestId?: string;
  } | null>(null);
  const [otpPaymentLoading, setOtpPaymentLoading] = useState(false);
  const [otpPaymentResult, setOtpPaymentResult] = useState<{
    otp: string;
    amount: number;
    vendorName: string;
    expiresAt: string;
  } | null>(null);

  // Demandes de versement livreurs
  const [driverCashRequests, setDriverCashRequests] = useState<Array<{
    id: string;
    driver_id: string;
    amount: number;
    status: string;
    note: string | null;
    created_at: string;
    driver: { phone: string; profile: { name: string } | null } | null;
  }>>([]);

  const loadDriverCashRequests = async () => {
    try {
      const res = await fetch('/api/agency/cash-requests');
      const json = await res.json();
      if (res.ok) setDriverCashRequests(json.requests || []);
    } catch (e) { console.error('Failed to load driver cash requests', e); }
  };

  // QR Deposit confirmation state
  const [qrDepositToken, setQrDepositToken] = useState('');
  const [showQRCamera, setShowQRCamera] = useState(false);
  const [qrDepositLoading, setQrDepositLoading] = useState(false);
  const [qrDepositPreview, setQrDepositPreview] = useState<{
    requestId: string;
    amount: number;
    driverName: string;
    driverPhone: string;
    isExpired: boolean;
    status: string;
  } | null>(null);
  const [qrDepositPreviewError, setQrDepositPreviewError] = useState('');
  const [qrDepositConfirmResult, setQrDepositConfirmResult] = useState<{
    driverName: string;
    amount: number;
  } | null>(null);

  const handlePreviewQrDeposit = async (token: string) => {
    if (token.length < 10) return;
    setQrDepositPreviewError('');
    setQrDepositPreview(null);
    setQrDepositConfirmResult(null);
    setQrDepositLoading(true);
    try {
      const res = await fetch(`/api/agency/confirm-deposit-qr?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (res.ok) {
        setQrDepositPreview(json);
      } else {
        setQrDepositPreviewError(json.error || 'QR invalide.');
      }
    } catch {
      setQrDepositPreviewError('Erreur réseau.');
    } finally {
      setQrDepositLoading(false);
    }
  };

  const handleConfirmQrDeposit = async () => {
    if (!qrDepositToken || !qrDepositPreview) return;
    setQrDepositLoading(true);
    try {
      const res = await fetch('/api/agency/confirm-deposit-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: qrDepositToken }),
      });
      const json = await res.json();
      if (res.ok) {
        setQrDepositConfirmResult({ driverName: json.driverName, amount: json.amount });
        setQrDepositPreview(null);
        setQrDepositToken('');
        loadDriverCashRequests();
      } else {
        setQrDepositPreviewError(json.error || 'Erreur lors de la confirmation.');
      }
    } catch {
      setQrDepositPreviewError('Erreur réseau.');
    } finally {
      setQrDepositLoading(false);
    }
  };

  // Demandes de versement vendeurs
  const [vendorPaymentRequests, setVendorPaymentRequests] = useState<Array<{
    id: string;
    vendor_id: string;
    amount: number;
    status: string;
    message: string | null;
    created_at: string;
    vendor: { name: string; phone: string } | null;
    activeOtp?: { id: string; amount: number; expires_at: string; created_at: string } | null;
  }>>([]);

  const loadVendorPaymentRequests = async () => {
    try {
      const res = await fetch('/api/agency/vendor-requests');
      const json = await res.json();
      if (res.ok) setVendorPaymentRequests(json.requests || []);
    } catch (e) { console.error('Failed to load vendor payment requests', e); }
  };


  // Drawer: colis sélectionné pour le panneau latéral de détails
  const [selectedColis, setSelectedColis] = useState<Colis | null>(null);

  const calcDistance = async (colisId: string, vendeurAddress: string | null | undefined, clientAddress: string, clientCommune: string = '') => {
    const fromAddress = vendeurAddress || agencyAddress;
    if (!fromAddress) {
      setDistanceCalc(prev => ({
        ...prev,
        [colisId]: { status: 'error', error: "L'adresse du vendeur n'est pas renseignée. Contactez le vendeur ou l'administrateur." },
      }));
      return;
    }
    setDistanceCalc(prev => ({ ...prev, [colisId]: { status: 'loading' } }));
    try {
      const fullDestAddress = `${clientCommune ? clientCommune + ', ' : ''}${clientAddress}, kinshasa republique democratique du congo`;
      const fullFromAddress = fromAddress.toLowerCase().includes('kinshasa') ? fromAddress : `${fromAddress}, kinshasa republique democratique du congo`;
      const res = await fetch(
        `/api/distance?from=${encodeURIComponent(fullFromAddress)}&to=${encodeURIComponent(fullDestAddress)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setDistanceCalc(prev => ({ ...prev, [colisId]: { status: 'error', error: data.error || 'Erreur de calcul.' } }));
        return;
      }
      setDistanceCalc(prev => ({ ...prev, [colisId]: { status: 'done', km: data.distanceKm } }));
      setColis(prev => prev.map(c => c.id === colisId ? { ...c, distanceKm: data.distanceKm } : c));
    } catch (e) {
      setDistanceCalc(prev => ({ ...prev, [colisId]: { status: 'error', error: 'Erreur réseau.' } }));
    }
  };


  const [globalSettings, setGlobalSettings] = useState({
    defaultPricePerKm: 1400,   // FC par km (défaut ≈ 0.5$ × 2800)
    defaultPricePerKg: 500,    // FC par kg (défaut ≈ 0.18$ × 2800)
    tauxConversionFC: 2800,
    communes: COMMUNES_KINSHASA.map(name => ({ name, base: 0 }))
  });

  // Plafond du taux fixé par le super admin (chargé depuis system_settings)
  const [plafondAdmin, setPlafondAdmin] = useState<number>(2900);

  // Historique filters
  const [filterStatus, setFilterStatus]   = useState('Tous');
  const [filterVendeur, setFilterVendeur] = useState('Tous');

  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'CDF'>('USD');

  // -- Derived data ----------------------------------------------------------
  const demandes   = colis.filter(c => c.status === 'En attente' || c.status === 'Accepté');
  const historique = colis.filter(c => !['En attente', 'Accepté'].includes(c.status));

  const filteredHistorique = useMemo(() => {
    return historique.filter(c => {
      const matchStatus  = filterStatus  === 'Tous' || c.status  === filterStatus;
      const matchVendeur = filterVendeur === 'Tous' || c.vendeurName === filterVendeur;
      return matchStatus && matchVendeur;
    });
  }, [historique, filterStatus, filterVendeur]);

  const uniqueVendeurs = useMemo(() => [...new Set(colis.map(c => c.vendeurName || 'Vendeur Inconnu'))], [colis]);

  const vendeurStats = useMemo(() => {
    const map: Record<string, { id: string; name: string; total: number; livres: number; lastDate: string; revenu: number; duAuVendeur: number; dettesVendeur: number; soldeNet: number }> = {};
    colis.forEach(c => {
      const vId = c.vendeurId || 'unknown';
      if (!map[vId]) {
        map[vId] = { id: vId, name: c.vendeurName || 'Vendeur Inconnu', total: 0, livres: 0, lastDate: c.date, revenu: 0, duAuVendeur: 0, dettesVendeur: 0, soldeNet: 0 };
      }
      map[vId].total++;
      if (c.status === 'Livré') {
        map[vId].livres++;
        map[vId].revenu += c.prixLivraison ?? 0;
        
        if (!c.isPrepaid && !c.vendorPaid) {
          map[vId].duAuVendeur += c.prixColis;
        }
        if (!c.paidByClient && !c.vendorPaid) {
          map[vId].dettesVendeur += (c.prixLivraison || 0);
        }
      }
      map[vId].soldeNet = map[vId].duAuVendeur - map[vId].dettesVendeur;
      
      if (c.date > map[vId].lastDate) map[vId].lastDate = c.date;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [colis]);

  const totalLivres   = colis.filter(c => c.status === 'Livré').length;
  const totalEnCours  = colis.filter(c => ['Assigné', 'En transit', 'Accepté', 'En attente'].includes(c.status)).length;
  const tauxLivraison = colis.length > 0 ? Math.round((totalLivres / colis.length) * 100) : 0;
  const revenuAgence  = colis.filter(c => c.status === 'Livré').reduce((s, c) => s + (c.prixLivraison ?? 0), 0);

  // -- Handlers -------------------------------------------------------------
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
      return;
    }
    if (pwForm.next.length < 8) {
      setPwMsg({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/agency/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPwMsg({ type: 'success', text: 'Mot de passe modifié avec succès !' });
        setPwForm({ current: '', next: '', confirm: '' });
      } else {
        setPwMsg({ type: 'error', text: json.error || 'Erreur lors du changement de mot de passe.' });
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Erreur réseau.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSaveParams = async () => {
    if (!user?.agencyId) return;
    try {
      const communePrices = globalSettings.communes.map(c => ({ commune: c.name, price: c.base }));
      const res = await fetch('/api/agency/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communePrices,
          pricePerKm: globalSettings.defaultPricePerKm,
          pricePerKg: globalSettings.defaultPricePerKg,
          tauxConversionFC: globalSettings.tauxConversionFC,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('Paramètres sauvegardés avec succès.');
      } else {
        alert(json.error || 'Erreur lors de la sauvegarde des paramètres.');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur inattendue.');
    }
  };

  
  const initPricing = (id: string, communeName: string, distanceKm: number, poids: number) => {
    const commune = globalSettings.communes.find(c => c.name === communeName) || globalSettings.communes[0];
    const basePrice = commune.base;
    const pricePerKm = globalSettings.defaultPricePerKm; 
    const pricePerKg = globalSettings.defaultPricePerKg; 
    
    setPricingParams(prev => ({
      ...prev,
      [id]: { commune: commune.name, basePrice, pricePerKm, pricePerKg }
    }));
    
    updateQuotation(id, basePrice, pricePerKm, distanceKm, pricePerKg, poids, commune.name);
  };
  
  const updateQuotation = (id: string, basePriceFc: number, pricePerKmFc: number, distanceKm: number, pricePerKgFc: number, poids: number, communeName: string) => {
    const rate = globalSettings.tauxConversionFC || exchangeRate || 2800;
    // Tout en FC
    const distancePriceFc = distanceKm * pricePerKmFc;
    const weightPriceFc = poids * pricePerKgFc;
    const totalFc = basePriceFc + distancePriceFc + weightPriceFc;
    // Conversion en USD pour le stockage et l'affichage
    const totalUsd = totalFc / rate;
    const basePriceUsd = basePriceFc / rate;
    const distancePriceUsd = distancePriceFc / rate;
    const weightPriceUsd = weightPriceFc / rate;

    setQuotations(prev => ({
      ...prev,
      [id]: {
        basePrice: basePriceUsd, commune: communeName,
        distanceTotal: distanceKm, distancePrice: distancePriceUsd,
        weightTotal: poids, weightPrice: weightPriceUsd,
        totalFinale: totalUsd
      }
    }));
  };

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const handleAction = async (c: Colis, action: 'accept' | 'reject') => {
    if (processingIds.has(c.id)) return; // anti double-clic
    setProcessingIds(prev => new Set(prev).add(c.id));
    try {
      const { dataService } = await import('@/lib/data-service');
      if (action === 'accept') {
        let finalPrice = 0;
        let q = null;
        if (c.paidByClient !== false) {
          q = quotations[c.id];
          if (!q) {
            alert("Veuillez générer la cotation avant d'accepter.");
            return;
          }
          finalPrice = q.totalFinale;
        }

        await dataService.acceptPackage(c.id, finalPrice);
        setColis(prev => prev.map(colis => colis.id === c.id
          ? { ...colis, status: 'Accepté', prixLivraison: finalPrice, quotation: q || undefined }
          : colis
        ));
      } else {
        await dataService.rejectPackage(c.id);
        setColis(prev => prev.map(colis => colis.id === c.id ? { ...colis, status: 'Refusé' } : colis));
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(c.id); return s; });
    }
  };

  const assignDriver = async (colisId: string, driverId: string) => {
    if (processingIds.has(colisId)) return; // anti double-clic
    setProcessingIds(prev => new Set(prev).add(colisId));
    try {
      const { dataService } = await import('@/lib/data-service');
      await dataService.assignDriver(colisId, driverId);
      setColis(prev => prev.map(c => c.id === colisId ? { ...c, status: 'Assigné', driverId } : c));
    } catch (e) {
      console.error(e);
      alert("Impossible d'assigner le livreur.");
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(colisId); return s; });
    }
  };

  const toggleAvailable = (id: string) => {
    setLivreurs(prev => prev.map(l => l.id === id ? { ...l, available: !l.available } : l));
  };

  const handleAddLivreur = async (e: React.FormEvent) => {
    e.preventDefault();
    // Generate a 4-digit PIN if not provided
    const pin = newPin.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    
    // Register driver via secure API
    try {
      const res = await fetch('/api/agency/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, phone: newPhone, vehicle: newVehicle || 'Moto', pinCode: pin }),
      });
      const json = await res.json();
      
      if (res.ok && json.driver) {
        const newL: Livreur = {
          id: json.driver.id,
          name: newName,
          phone: newPhone,
          pinCode: pin, // We show it once in the UI success modal, then it's gone
          vehicle: newVehicle || 'Moto',
          available: true,
          deliveries: 0,
          rating: 5.0,
          joinedDate: new Date().toISOString().split('T')[0],
        };
        setLivreurs(prev => [newL, ...prev]);
        setCreatedDriver({ name: newName, pin, phone: newPhone });
        setNewName(''); setNewPhone(''); setNewVehicle('Moto'); setNewPin('');
        setShowAddLivreur(false);
      } else {
        alert(json.error || 'Erreur lors de la création du livreur.');
      }
    } catch (e) {
      console.error('Failed to save driver to DB:', e);
      alert('Erreur réseau.');
    }
  };

  const removeLivreur = (id: string) => setLivreurs(prev => prev.filter(l => l.id !== id));

  const handleResetPin = async () => {
    if (!resetPinDriver) return;
    const pin = resetPinValue.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    setResetPinLoading(true);
    try {
      const res = await fetch(`/api/agency/drivers/${resetPinDriver.id}/reset-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin: pin }),
      });
      const json = await res.json();
      if (res.ok) {
        setResetPinResult({ pin: json.newPin, name: resetPinDriver.name });
        setResetPinDriver(null);
      } else {
        alert(json.error || 'Erreur lors de la réinitialisation.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setResetPinLoading(false);
    }
  };


  const getDriverName = (driverId: string | null) =>
    driverId ? livreurs.find(l => l.id === driverId)?.name ?? '—' : '—';

  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'demandes',   icon: <Bell size={20} />, label: 'Demandes', badge: demandes.length },
    { key: 'livreurs',   icon: <Truck size={20} />, label: 'Flotte', badge: livreurs.length },
    { key: 'historique', icon: <ClipboardList size={20} />, label: 'Historique' },
    { key: 'finances',   icon: <DollarSign size={20} />, label: 'Finances', badge: (driverCashRequests.filter(r => r.status === 'PENDING').length + vendorPaymentRequests.filter(r => ['PENDING','SEEN'].includes(r.status)).length) || undefined },
    { key: 'vendeurs',   icon: <Star size={20} />, label: 'Fidélité' },
    { key: 'marketing_securite', icon: <Shield size={20} />, label: 'Marketing & Sécurité' },
    { key: 'parametres', icon: <Settings size={20} />, label: 'Paramètres' },
  ];

  // -- Garde : session en cours de vérification
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><Lock size={40} color="#94a3b8" /></div>
          <p>Vérification de la session...</p>
        </div>
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
    
      {/* ══ SIDEBAR GAUCHE ══ */}
      <aside style={{
        width: '260px',
        minWidth: '260px',
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid var(--card-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid var(--card-border)' }}>
          <h1 style={{
            fontSize: '1.5rem', fontWeight: '900',
            background: 'linear-gradient(135deg, var(--accent), var(--primary))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '0.1rem',
          }}>Moncolis</h1>
          <p style={{ fontSize: '0.72rem', opacity: 0.4, margin: 0 }}>Espace Agence Delivery</p>
        </div>

        {/* Profil mini */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--primary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '900', fontSize: '1rem', color: '#000',
          }}>
            E
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontWeight: '700', fontSize: '0.88rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Express Delivery</p>
            <p style={{ fontSize: '0.72rem', opacity: 0.45, margin: 0 }}>Agence Vérifiée</p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.7rem 1rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.88rem',
                fontWeight: activeTab === t.key ? '700' : '500',
                textAlign: 'left',
                background: activeTab === t.key ? 'color-mix(in srgb, var(--accent) 80%, black)' : 'transparent',
                color: activeTab === t.key ? 'white' : 'var(--foreground)',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { if (activeTab !== t.key) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (activeTab !== t.key) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '1.2rem', flexShrink: 0, filter: activeTab === t.key ? 'brightness(1)' : 'grayscale(0.6)' }}>{t.icon}</span>
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span style={{
                  background: activeTab === t.key ? 'rgba(255,255,255,0.2)' : 'var(--accent)',
                  color: activeTab === t.key ? '#fff' : '#000', 
                  padding: '0.1rem 0.5rem',
                  borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Actions bas de sidebar */}
        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            onClick={logout} 
            className="btn btn-outline" 
            style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', cursor: 'pointer' }}
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ══ CONTENU PRINCIPAL ══ */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', minWidth: 0 }}>
        
        {/* En-tête de section */}
        <div style={{ marginBottom: '2.5rem' }}>
           <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 0.5rem 0' }}>
             {tabs.find(t => t.key === activeTab)?.label}
           </h2>
           <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
             {activeTab === 'demandes' && 'Traitez les nouvelles demandes de livraison'}
             {activeTab === 'livreurs' && 'Gérez votre flotte et vos disponibilités'}
             {activeTab === 'historique' && 'Retrouvez toutes vos courses terminées'}
             {activeTab === 'vendeurs' && 'Classement de vos meilleurs partenaires'}
             {activeTab === 'parametres' && 'Configurez vos tarifs par défaut'}
           </p>
        </div>

        {/* KPI Cards (Uniquement visible sur certaines sections) */}
        {(activeTab === 'demandes' || activeTab === 'historique') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
            <StatCard label="Total Colis"      value={colis.length}    sub="depuis le début"          color="var(--accent)" />
            <StatCard label="Livrés"           value={totalLivres}     sub={`${tauxLivraison}% de taux`} color="#10b981" />
            <StatCard label="En cours"         value={totalEnCours}    sub="à traiter / en route"     color="#3b82f6" />
            <StatCard label="Livreurs actifs"  value={livreurs.filter(l => l.available).length} sub={`sur ${livreurs.length} total`} color="#8b5cf6" />
            <StatCard label="Revenu livraison" value={`${revenuAgence.toLocaleString('fr-FR')} USD`} sub={`(${Math.round(revenuAgence * globalSettings.tauxConversionFC).toLocaleString('fr-FR')} FC)`} color="#f59e0b" />
          </div>
        )}

      {/* -- TAB: Demandes --------------------------------------------------- */}
      {activeTab === 'demandes' && (
        <div className="animate-fade-in" style={{ position: 'relative' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Demandes <span style={{ fontSize: '0.8rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: '700', verticalAlign: 'middle', marginLeft: '0.5rem' }}>{demandes.length} en cours</span></h2>
            <span style={{ fontSize: '0.82rem', opacity: 0.5 }}>Cliquez sur une ligne pour gérer le colis</span>
          </div>

          {demandes.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', opacity: 0.6 }}>
              <Package size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
              <p>Aucune demande en cours. En attente de nouvelles livraisons.</p>
            </div>
          ) : (
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Colis', 'Boutique / Vendeur', 'Client', 'Adresse', 'Valeur', 'Poids', 'Statut', ''].map(h => (
                      <th key={h} style={{ padding: '0.9rem 1.1rem', textAlign: 'left', opacity: 0.55, fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((c, i) => {
                    const dc = distanceCalc[c.id];
                    const hasQuotation = !!quotations[c.id];
                    const isSelected = selectedColis?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedColis(isSelected ? null : c)}
                        style={{
                          borderBottom: i < demandes.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(var(--accent-rgb, 234,179,8), 0.08)' : 'transparent',
                          transition: 'background 0.15s',
                          borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                      >
                        {/* ID Colis */}
                        <td style={{ padding: '1rem 1.1rem' }}>
                          <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '0.82rem', display: 'block' }}>{c.trackId || c.id}</span>
                          <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>{new Date(c.date).toLocaleDateString('fr-FR')}</span>
                        </td>

                        {/* Boutique / Vendeur */}
                        <td style={{ padding: '1rem 1.1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.75rem', flexShrink: 0 }}>
                              {(c.vendeurName || c.vendeur || 'V').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span style={{ fontWeight: '600', display: 'block', fontSize: '0.88rem' }}>{c.vendeurName || c.vendeur || 'Non renseigné'}</span>
                              {c.vendeurName && c.vendeur && c.vendeurName !== c.vendeur && <span style={{ fontSize: '0.72rem', opacity: 0.55 }}>{c.vendeur}</span>}
                            </div>
                          </div>
                        </td>

                        {/* Client */}
                        <td style={{ padding: '1rem 1.1rem' }}>
                          <span style={{ fontWeight: '600', display: 'block', fontSize: '0.88rem' }}>{c.clientName}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{c.clientPhone}</span>
                        </td>

                        {/* Adresse */}
                        <td style={{ padding: '1rem 1.1rem', maxWidth: '160px' }}>
                          {c.clientCommune && <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#06b6d4', background: 'rgba(6,182,212,0.12)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginBottom: '0.2rem' }}>{c.clientCommune}</span>}
                          <span style={{ opacity: 0.65, fontSize: '0.8rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.clientAddress}</span>
                        </td>

                        {/* Valeur */}
                        <td style={{ padding: '1rem 1.1rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '700', color: '#22c55e', fontSize: '0.9rem' }}>{c.prixColis.toLocaleString('fr-FR')} $</span>
                        </td>

                        {/* Poids + Distance */}
                        <td style={{ padding: '1rem 1.1rem', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'block', fontSize: '0.85rem' }}>{c.poids} kg</span>
                          {dc?.status === 'done' && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>📍 {dc.km} km</span>}
                          {dc?.status === 'loading' && <span style={{ fontSize: '0.72rem', color: '#3b82f6' }}>⟳ calcul...</span>}
                          {(!dc || dc.status === 'idle') && <span style={{ fontSize: '0.72rem', opacity: 0.45 }}>dist. inconnue</span>}
                        </td>

                        {/* Statut */}
                        <td style={{ padding: '1rem 1.1rem' }}>
                          <span style={{
                            background: `${statusStyle[c.status]}22`,
                            color: statusStyle[c.status],
                            border: `1px solid ${statusStyle[c.status]}55`,
                            padding: '0.25rem 0.65rem',
                            borderRadius: '20px',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}>
                            {c.status === 'En attente' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
                            {c.status}
                          </span>
                          {hasQuotation && <span style={{ display: 'block', fontSize: '0.7rem', color: '#10b981', marginTop: '0.2rem' }}>✓ Devis établi</span>}
                        </td>

                        {/* Flèche */}
                        <td style={{ padding: '1rem 0.75rem 1rem 0' }}>
                          <ChevronRight size={16} style={{ opacity: 0.4, transition: 'all 0.2s', transform: isSelected ? 'rotate(90deg)' : 'none' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════ SLIDE-OUT DRAWER ═══════════ */}
          {selectedColis && (() => {
            const c = selectedColis;
            const qParams = pricingParams[c.id];
            const q = quotations[c.id];
            const dc = distanceCalc[c.id];

            return (
              <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '100%',
                maxWidth: '520px',
                height: '100vh',
                background: 'rgba(10,14,28,0.97)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                zIndex: 300,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideInRight 0.25s ease',
                overflowY: 'auto',
              }}>
                {/* Drawer Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                      <Package size={18} color="var(--accent)" />
                      <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--accent)', letterSpacing: '-0.02em' }}>{c.trackId || c.id}</span>
                      <span style={{
                        background: `${statusStyle[c.status]}22`,
                        color: statusStyle[c.status],
                        border: `1px solid ${statusStyle[c.status]}55`,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '20px',
                        fontWeight: '700',
                        fontSize: '0.72rem',
                      }}>{c.status}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>Reçu le {new Date(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <button
                    onClick={() => setSelectedColis(null)}
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* Boutique / Vendeur */}
                  <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem', flexShrink: 0 }}>
                        {(c.vendeurName || c.vendeur || 'V').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <Store size={13} color="#8b5cf6" />
                          <span style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Boutique / Vendeur</span>
                        </div>
                        <strong style={{ fontSize: '1rem', display: 'block', color: '#fff' }}>{c.vendeurName || 'Non renseigné'}</strong>
                        {c.vendeur && c.vendeur !== c.vendeurName && <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>{c.vendeur}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Infos Client */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem' }}>
                    <p style={{ fontSize: '0.72rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', marginBottom: '0.85rem' }}>Informations Client</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={15} color="#3b82f6" />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', opacity: 0.5, display: 'block' }}>Nom</span>
                          <strong style={{ fontSize: '0.95rem' }}>{c.clientName}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Phone size={15} color="#10b981" />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', opacity: 0.5, display: 'block' }}>Téléphone</span>
                          <strong style={{ fontSize: '0.95rem' }}>{c.clientPhone}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.1rem' }}>
                          <Navigation size={15} color="#f59e0b" />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', opacity: 0.5, display: 'block' }}>Adresse de livraison</span>
                          {c.clientCommune && <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#06b6d4', background: 'rgba(6,182,212,0.12)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginBottom: '0.2rem' }}>📍 {c.clientCommune}</span>}
                          <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>{c.clientAddress}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Informations colis */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '0.85rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', opacity: 0.5, display: 'block', marginBottom: '0.3rem' }}>Poids</span>
                      <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{c.poids}</strong>
                      <span style={{ fontSize: '0.75rem', opacity: 0.5 }}> kg</span>
                    </div>
                    <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '0.85rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#22c55e', display: 'block', marginBottom: '0.3rem', fontWeight: '600' }}>Valeur</span>
                      <strong style={{ fontSize: '1.1rem', color: '#22c55e' }}>{c.prixColis} $</strong>
                    </div>
                    <div style={{ background: dc?.status === 'done' ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)', border: dc?.status === 'done' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '0.85rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', opacity: 0.5, display: 'block', marginBottom: '0.3rem' }}>Distance</span>
                      {dc?.status === 'done' ? <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{dc.km} km</strong> : <span style={{ fontSize: '0.82rem', opacity: 0.4 }}>—</span>}
                    </div>
                  </div>

                  {/* Paiement info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '10px', background: c.paidByClient ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)', border: c.paidByClient ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(16,185,129,0.2)' }}>
                    <DollarSign size={15} color={c.paidByClient ? '#3b82f6' : '#10b981'} />
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: c.paidByClient ? '#93c5fd' : '#6ee7b7' }}>
                      {c.paidByClient ? 'Frais payés par le client à la livraison' : 'Frais à la charge du vendeur'}
                    </span>
                  </div>

                  {/* SECTION: Devis / Actions */}
                  {c.status === 'En attente' && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                      <p style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={15} /> Établir le Devis
                      </p>

                      {c.paidByClient === false ? (
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '1rem', color: '#10b981', opacity: 0.85 }}>Frais à la charge du vendeur — aucun devis requis.</p>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                              className="btn btn-primary"
                              disabled={processingIds.has(c.id)}
                              style={{ flex: 1, padding: '0.7rem', opacity: processingIds.has(c.id) ? 0.6 : 1, cursor: processingIds.has(c.id) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                              onClick={() => handleAction(c, 'accept')}
                            >
                              {processingIds.has(c.id)
                                ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} /> En cours...</>
                                : 'Accepter'
                              }
                            </button>
                            <button className="btn btn-outline" style={{ flex: 1, padding: '0.7rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleAction(c, 'reject')}>Refuser</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Distance step */}
                          {(() => {
                            if (!dc || dc.status === 'idle' || !dc.status) {
                              return (
                                <div style={{ marginBottom: '1rem' }}>
                                  <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>Étape 1 : Calculez la distance vendeur → client</p>
                                  <button className="btn btn-primary" style={{ width: '100%', padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => calcDistance(c.id, c.vendeurAddress, c.clientAddress, c.clientCommune)}>
                                    <MapPin size={15} /> Calculer la Distance
                                  </button>
                                </div>
                              );
                            }
                            if (dc.status === 'loading') {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem', background: 'rgba(59,130,246,0.08)', borderRadius: '10px', marginBottom: '1rem' }}>
                                  <div style={{ width: '16px', height: '16px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                                  <span style={{ color: '#3b82f6', fontWeight: '600', fontSize: '0.85rem' }}>Calcul via OpenStreetMap...</span>
                                </div>
                              );
                            }
                            if (dc.status === 'error') {
                              return (
                                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem' }}>
                                  <p style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{dc.error}</p>
                                  <button className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem', borderColor: '#ef4444', color: '#ef4444', width: '100%' }} onClick={() => calcDistance(c.id, c.vendeurAddress, c.clientAddress, c.clientCommune)}>Réessayer</button>
                                </div>
                              );
                            }
                            if (dc.status === 'done') {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', marginBottom: '1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin size={15} color="#10b981" />
                                    <span style={{ fontWeight: '600', color: '#10b981', fontSize: '0.85rem' }}>Distance confirmée</span>
                                  </div>
                                  <strong style={{ color: '#10b981', fontSize: '1.2rem' }}>{dc.km} km</strong>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Pricing form */}
                          {dc?.status === 'done' && !qParams && (
                            <button className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }} onClick={() => initPricing(c.id, c.clientCommune || 'Gombe', dc.km!, c.poids)}>
                              Étape 2 : Établir le Devis →
                            </button>
                          )}

                          {qParams && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', opacity: 0.7, marginBottom: '0.3rem' }}>Commune</label>
                                <select className="input-field" value={qParams.commune} onChange={e => {
                                  const commune = globalSettings.communes.find(co => co.name === e.target.value) || globalSettings.communes[0];
                                  setPricingParams(prev => ({...prev, [c.id]: { ...qParams, commune: commune.name, basePrice: commune.base }}));
                                  updateQuotation(c.id, commune.base, qParams.pricePerKm, c.distanceKm, qParams.pricePerKg, c.poids, commune.name);
                                }}>
                                  {globalSettings.communes.map(co => <option key={co.name} value={co.name}>{co.name} — Base: {co.base} FC</option>)}
                                </select>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.78rem', opacity: 0.7, marginBottom: '0.3rem' }}>Tarif / Km (FC)</label>
                                  <input type="number" step="50" className="input-field" value={qParams.pricePerKm} onChange={e => { const val = parseFloat(e.target.value) || 0; setPricingParams(prev => ({...prev, [c.id]: { ...qParams, pricePerKm: val }})); updateQuotation(c.id, qParams.basePrice, val, c.distanceKm, qParams.pricePerKg, c.poids, qParams.commune); }} />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.78rem', opacity: 0.7, marginBottom: '0.3rem' }}>Tarif / Kg (FC)</label>
                                  <input type="number" step="50" className="input-field" value={qParams.pricePerKg} onChange={e => { const val = parseFloat(e.target.value) || 0; setPricingParams(prev => ({...prev, [c.id]: { ...qParams, pricePerKg: val }})); updateQuotation(c.id, qParams.basePrice, qParams.pricePerKm, c.distanceKm, val, c.poids, qParams.commune); }} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Quotation result */}
                          {q && (
                            <div style={{ marginTop: '0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '1rem' }}>
                              <p style={{ fontWeight: '700', marginBottom: '0.75rem', fontSize: '0.88rem', color: '#f59e0b' }}>📋 Récapitulatif du Devis</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.75 }}>Base ({q.commune})</span><strong>{Math.round(q.basePrice * (globalSettings.tauxConversionFC || exchangeRate)).toLocaleString('fr-FR')} FC</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.75 }}>Distance ({q.distanceTotal} km × {qParams?.pricePerKm} FC)</span><strong>{Math.round(q.distancePrice * (globalSettings.tauxConversionFC || exchangeRate)).toLocaleString('fr-FR')} FC</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.75 }}>Poids ({q.weightTotal} kg × {qParams?.pricePerKg} FC)</span><strong>{Math.round(q.weightPrice * (globalSettings.tauxConversionFC || exchangeRate)).toLocaleString('fr-FR')} FC</strong></div>
                                <div style={{ height: '1px', background: 'rgba(245,158,11,0.25)', margin: '0.25rem 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b', fontWeight: '800', fontSize: '1rem' }}>
                                  <span>TOTAL</span>
                                  <span>
                                    {Math.round(q.totalFinale * (globalSettings.tauxConversionFC || exchangeRate)).toLocaleString('fr-FR')} FC
                                    <span style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '0.4rem' }}>({formatPrice(q.totalFinale)})</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          {q && (
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                              <button
                                className="btn btn-primary"
                                disabled={processingIds.has(c.id)}
                                style={{ flex: 1, padding: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: processingIds.has(c.id) ? 0.6 : 1, cursor: processingIds.has(c.id) ? 'not-allowed' : 'pointer' }}
                                onClick={() => { if (!processingIds.has(c.id)) { handleAction(c, 'accept'); setSelectedColis(null); } }}
                              >
                                {processingIds.has(c.id)
                                  ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} /> Traitement...</>
                                  : <><CheckCircle size={15} /> Accepter</>
                                }
                              </button>
                              <button className="btn btn-outline" style={{ flex: 1, padding: '0.7rem', borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }} onClick={() => { handleAction(c, 'reject'); setSelectedColis(null); }}>
                                <XCircle size={15} /> Refuser
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Assignation livreur si Accepté */}
                  {c.status === 'Accepté' && (
                    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px', padding: '1.25rem' }}>
                      <p style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.85rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Truck size={15} /> Assigner un Livreur
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {livreurs.filter(l => l.available).map(l => (
                          <button key={l.id}
                            onClick={() => { if (!processingIds.has(c.id)) { assignDriver(c.id, l.id); setSelectedColis(null); } }}
                            disabled={processingIds.has(c.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: processingIds.has(c.id) ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', cursor: processingIds.has(c.id) ? 'not-allowed' : 'pointer', color: processingIds.has(c.id) ? '#475569' : '#fff', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left', opacity: processingIds.has(c.id) ? 0.6 : 1 }}
                            onMouseEnter={e => { if (!processingIds.has(c.id)) e.currentTarget.style.background = 'rgba(59,130,246,0.18)'; }}
                            onMouseLeave={e => { if (!processingIds.has(c.id)) e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                          >
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>{l.name.charAt(0)}</div>
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.9rem' }}>{l.name}</strong>
                              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{l.vehicle} · {l.phone}</span>
                            </div>
                            <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                          </button>
                        ))}
                        {livreurs.filter(l => l.available).length === 0 && (
                          <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', padding: '1rem' }}>Aucun livreur disponible actuellement.</p>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })()}

          {/* Overlay backdrop pour fermer le drawer */}
          {selectedColis && (
            <div
              onClick={() => setSelectedColis(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 299, backdropFilter: 'blur(2px)' }}
            />
          )}
        </div>
      )}

      {/* -- TAB: Livreurs --------------------------------------------------- */}
      {activeTab === 'livreurs' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Gestion des Livreurs</h2>
            <button className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }} onClick={() => setShowAddLivreur(true)}>
              + Ajouter un Livreur
            </button>
          </div>

          {/* Created Driver PIN Notification */}
          {createdDriver && (
            <div style={{
              padding: '1.25rem 1.5rem',
              borderRadius: '16px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <p style={{ fontWeight: '800', color: '#4ade80', margin: '0 0 0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> Livreur {createdDriver.name} ajouté !</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                  Transmettez ces identifiants de connexion à votre livreur :
                </p>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Smartphone size={14} /> <strong style={{ color: '#fff' }}>{createdDriver.phone}</strong></span>
                  <span style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Lock size={14} /> Code PIN : <strong style={{ color: '#fbbf24', fontSize: '1.1rem', letterSpacing: '3px' }}>{createdDriver.pin}</strong></span>
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Téléphone: ${createdDriver.phone} | Code PIN: ${createdDriver.pin}`);
                  setCopiedPin(true);
                  setTimeout(() => setCopiedPin(false), 2000);
                }}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: '#22c55e', border: 'none', color: '#000', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {copiedPin ? <Check size={14} /> : <Copy size={14} />}
                {copiedPin ? 'Copié !' : 'Copier les identifiants'}
              </button>
              <button onClick={() => setCreatedDriver(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {livreurs.map(l => (
              <div key={l.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1.2rem', right: '1.2rem', width: '10px', height: '10px', borderRadius: '50%', background: l.available ? '#10b981' : '#6b7280', boxShadow: l.available ? '0 0 6px #10b981' : 'none' }} />

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.2rem', flexShrink: 0 }}>
                    {l.name.charAt(0)}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{l.name}</strong>
                    <span style={{ fontSize: '0.82rem', opacity: 0.65 }}>{l.phone}</span>
                    {l.vehicle && <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Car size={12} /> {l.vehicle}</span>}
                  </div>
                </div>

                {/* PIN Code Box — visible only for agence manager */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px dashed rgba(245, 158, 11, 0.35)',
                  borderRadius: '10px',
                  marginBottom: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <KeyRound size={14} color="#fbbf24" />
                    <span style={{ fontSize: '0.75rem', color: '#fcd34d', fontWeight: '700' }}>Code de connexion livreur :</span>
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '3px', color: '#fbbf24' }}>
                    {l.pinCode || '????'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>{l.deliveries}</p>
                    <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: 0 }}>Livraisons</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f59e0b', margin: 0 }}>{l.rating > 0 ? l.rating : '—'}</p>
                    <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: 0 }}>Note</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: l.available ? '#10b981' : '#6b7280', margin: 0 }}>{l.available ? 'Disponible' : 'Indispo'}</p>
                    <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: 0 }}>Statut</p>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', opacity: 0.55, marginBottom: '1rem' }}>
                  Rejoint le {new Date(l.joinedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => toggleAvailable(l.id)} className="btn btn-outline" style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', borderColor: l.available ? '#6b7280' : '#10b981', color: l.available ? '#6b7280' : '#10b981' }}>
                      {l.available ? 'Marquer indispo' : 'Marquer dispo'}
                    </button>
                    <button onClick={() => removeLivreur(l.id)} style={{ padding: '0.45rem 0.75rem', borderRadius: '9999px', border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', transition: 'all 0.2s' }}>
                      Retirer
                    </button>
                  </div>
                  <button
                    onClick={() => { setResetPinDriver({ id: l.id, name: l.name }); setResetPinValue(''); setResetPinResult(null); }}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '9999px', border: '1px solid rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)', color: '#fbbf24', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                  >
                    <KeyRound size={13} /> Réinitialiser le PIN
                  </button>
                </div>
              </div>
            ))}

            <div className="glass-panel" onClick={() => setShowAddLivreur(true)} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', cursor: 'pointer', border: '2px dashed var(--card-border)', minHeight: '200px', opacity: 0.6, transition: 'opacity 0.2s' }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.6'; }}>
              <span style={{ fontSize: '2rem', fontWeight: '300', lineHeight: 1 }}>+</span>
              <span style={{ fontWeight: '600' }}>Ajouter un livreur</span>
            </div>
          </div>
        </div>
      )}

      {/* -- TAB: Historique ------------------------------------------------- */}
      {activeTab === 'historique' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Historique des Colis</h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field" style={{ padding: '0.5rem 0.9rem', width: 'auto', fontSize: '0.875rem' }}>
                {['Tous', 'Livré', 'En transit', 'Refusé', 'Annulé', 'Assigné'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={filterVendeur} onChange={e => setFilterVendeur(e.target.value)} className="input-field" style={{ padding: '0.5rem 0.9rem', width: 'auto', fontSize: '0.875rem' }}>
                <option value="Tous">Tous les vendeurs</option>
                {uniqueVendeurs.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {filteredHistorique.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>
              Aucun colis ne correspond a vos filtres.
            </div>
          ) : (
            <div className="glass-panel" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                    {['ID Colis', 'Client', 'Adresse', 'Vendeur', 'Valeur colis', 'Prix livraison', 'Distance', 'Livreur', 'Date', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '1rem 1.25rem', textAlign: 'left', opacity: 0.6, fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistorique.map((c, i) => (
                    <tr
                      key={c.id}
                      style={{ borderBottom: i < filteredHistorique.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{c.id}</td>
                      <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>{c.clientName}</td>
                      <td style={{ padding: '1rem 1.25rem', opacity: 0.7, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.clientAddress}</td>
                      <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>{c.vendeur}</td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: '700', color: '#22c55e', whiteSpace: 'nowrap' }}>{c.prixColis.toLocaleString('fr-FR')} USD</td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: '700', color: c.prixLivraison ? '#f59e0b' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                        {c.prixLivraison ? `${c.prixLivraison.toLocaleString('fr-FR')} USD` : '—'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', opacity: 0.6, whiteSpace: 'nowrap' }}>
                        {c.distanceKm} km <br />
                        <span style={{ fontSize: '0.75rem' }}>{c.poids} kg</span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>{getDriverName(c.driverId)}</td>
                      <td style={{ padding: '1rem 1.25rem', opacity: 0.7, whiteSpace: 'nowrap' }}>{new Date(c.date).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ background: statusStyle[c.status], color: 'white', padding: '0.25rem 0.7rem', borderRadius: '20px', fontWeight: '700', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: '0.75rem', opacity: 0.5, fontSize: '0.8rem' }}>{filteredHistorique.length} colis affiches</p>
        </div>
      )}

      {/* -- TAB: Vendeurs Fidèles ------------------------------------------- */}
      {activeTab === 'vendeurs' && (
        <div className="animate-fade-in">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Vendeurs Fidèles</h2>
          <p style={{ opacity: 0.6, marginBottom: '1.5rem', fontSize: '0.9rem' }}>Classement par volume de colis confie a votre agence.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {vendeurStats.map((v, i) => {
              const tx = v.total > 0 ? Math.round((v.livres / v.total) * 100) : 0;
              const medalColors = ['#f59e0b', '#9ca3af', '#cd7f32'];
              return (
                <div key={`${v.name}-${i}`} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: i < 3 ? medalColors[i] : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem', flexShrink: 0, color: i < 3 ? '#000' : 'rgba(255,255,255,0.5)' }}>
                    #{i + 1}
                  </div>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.2rem', flexShrink: 0 }}>
                    {v.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <strong style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {v.name}
                      {(() => {
                        const badge = getVendorBadge(v.livres);
                        return badge ? (
                          <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '6px', background: `${badge.color}15`, color: badge.color, border: `1px solid ${badge.color}40`, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {badge.icon} {badge.label}
                          </span>
                        ) : null;
                      })()}
                    </strong>
                    <span style={{ fontSize: '0.82rem', opacity: 0.6 }}>Dernier colis : {new Date(v.lastDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent)', margin: 0 }}>{v.total}</p>
                      <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>Colis total</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981', margin: 0 }}>{v.livres}</p>
                      <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>Livres</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: '800', color: tx >= 80 ? '#10b981' : tx >= 60 ? '#f59e0b' : '#ef4444', margin: 0 }}>{tx}%</p>
                      <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>Taux reussite</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f59e0b', margin: 0 }}>{v.revenu.toFixed(2)}</p>
                      <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>EUR gagnes</p>
                    </div>
                  </div>
                  <div style={{ width: '120px', flexShrink: 0 }}>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${tx}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent))', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                    <p style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: '0.3rem', textAlign: 'right' }}>Fidelite</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -- TAB: Finances ----------------------------------------------- */}
      {activeTab === 'finances' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Portefeuille & Reversements</h2>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.3rem', borderRadius: '8px' }}>
              <button 
                onClick={() => setDisplayCurrency('USD')}
                style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', background: displayCurrency === 'USD' ? 'var(--primary)' : 'transparent', color: displayCurrency === 'USD' ? '#fff' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}
              >
                USD
              </button>
              <button 
                onClick={() => setDisplayCurrency('CDF')}
                style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', background: displayCurrency === 'CDF' ? 'var(--primary)' : 'transparent', color: displayCurrency === 'CDF' ? '#fff' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}
              >
                CDF
              </button>
            </div>
          </div>

          {(() => {
            const formatVal = (val: number) => {
              if (displayCurrency === 'USD') return `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
              return `${Math.round(val * globalSettings.tauxConversionFC).toLocaleString('fr-FR')} FC`;
            };
            return (
              <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {(() => {
              const colisLivres = colis.filter(c => c.status === 'Livré');
              const revenuNet = colisLivres.reduce((acc, c) => acc + (c.prixLivraison || 0), 0);
              const detteVendeur = colisLivres.filter(c => c.paidByClient && !c.vendorPaid).reduce((acc, c) => acc + c.prixColis, 0);
              const caisseLivreur = colisLivres.filter(c => c.paidByClient && !c.vendorPaid).reduce((acc, c) => acc + c.prixColis + (c.prixLivraison || 0), 0); // Assuming drivers haven't given cash yet if vendor isn't paid, or we can just show total cash collected today. Let's simplify: Cash to collect from drivers for pending vendor payments.

              return (
                <>
                  <StatCard 
                    label="Revenu Net Agence" 
                    value={formatVal(revenuNet)}
                    sub="Frais de livraison générés"
                    color="#3b82f6"
                  />
                  <StatCard 
                    label="Dettes Vendeurs" 
                    value={formatVal(detteVendeur)}
                    sub="Argent marchandise à reverser"
                    color="#f59e0b"
                  />
                  <StatCard 
                    label="Créances Livreurs" 
                    value={formatVal(caisseLivreur)}
                    sub="Cash à récupérer chez les livreurs"
                    color="#10b981"
                  />
                </>
              );
            })()}
          </div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', marginTop: '2rem' }}>Soldes par Vendeur (Comptabilité globale)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {vendeurStats.filter(v => Math.abs(v.soldeNet) > 0 || v.duAuVendeur > 0 || v.dettesVendeur > 0).length === 0 ? (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                Aucun solde en cours avec vos vendeurs.
              </div>
            ) : (
              vendeurStats.filter(v => Math.abs(v.soldeNet) > 0 || v.duAuVendeur > 0 || v.dettesVendeur > 0).map(v => (
                <div key={v.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem', display: 'block', color: 'var(--accent)' }}>{v.name}</strong>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.85rem' }}>
                      <span style={{ color: '#f59e0b' }}>Dû au vendeur (Marchandises): {formatVal(v.duAuVendeur)}</span>
                      <span style={{ color: '#10b981' }}>Dû par le vendeur (Livraisons): {formatVal(v.dettesVendeur)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7 }}>Solde Net à reverser</span>
                      <strong style={{ fontSize: '1.3rem', color: v.soldeNet > 0 ? '#f59e0b' : (v.soldeNet < 0 ? '#10b981' : '#94a3b8') }}>
                        {formatVal(v.soldeNet)}
                      </strong>
                    </div>
                    {v.soldeNet > 0 && (
                      <button
                        className="btn btn-primary"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700' }}
                        onClick={() => setOtpPaymentModal({ vendorId: v.id, vendorName: v.name, amount: Math.round(v.soldeNet * globalSettings.tauxConversionFC) })}
                      >
                        <KeyRound size={14} /> Payer via OTP
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Détail des Colis Livrés (Non Reversés)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {colis.filter(c => c.status === 'Livré' && c.paidByClient).length === 0 ? (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                Aucun colis livré où le client a payé à la livraison.
              </div>
            ) : (
              colis.filter(c => c.status === 'Livré' && c.paidByClient).map(c => (
                <div key={c.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <strong style={{ fontSize: '1.05rem', display: 'block', color: 'var(--accent)' }}>{c.id} — {c.vendeur}</strong>
                    <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>Client: {c.clientName} | Livré le {c.date}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7 }}>Montant collecté</span>
                      <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>{c.prixColis + (c.prixLivraison || 0)} $</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7 }}>À reverser</span>
                      <strong style={{ fontSize: '1.2rem', color: c.vendorPaid ? '#6b7280' : '#f59e0b' }}>{c.prixColis} $</strong>
                    </div>
                    
                    <div>
                      {c.vendorPaid ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          [OK] Reversé
                        </span>
                      ) : (
                        <button 
                          className="btn btn-primary"
                          onClick={() => {
                            setPaymentConfirmationModal({
                              type: 'single',
                              colisId: c.id,
                              vendorName: c.vendeur,
                              amount: c.prixColis,
                              inputText: ''
                            });
                          }}
                        >
                          Marquer comme reversé
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
              </>
            );
          })()}
        </div>
      )}


      {/* -- Section : Scanner/Confirmer QR dépôt livreur (Finances) ---------- */}
      {activeTab === 'finances' && (
        <div style={{ margin: '0 2rem 2rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '16px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '700', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <QrCode size={16} /> Confirmer le dépôt QR d'un livreur
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 1rem' }}>
            Entrez le code QR présenté par le livreur pour confirmer la réception de son cash.
          </p>

          {/* Success message */}
          {qrDepositConfirmResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', marginBottom: '1rem' }}>
              <CheckCircle size={22} color="#22c55e" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: '700', color: '#4ade80', fontSize: '0.95rem' }}>Dépôt confirmé !</div>
                <div style={{ fontSize: '0.82rem', color: '#86efac' }}>
                  {qrDepositConfirmResult.driverName} — {qrDepositConfirmResult.amount.toLocaleString('fr-FR')} CDF reçu. Solde livreur remis à zéro.
                </div>
              </div>
              <button onClick={() => setQrDepositConfirmResult(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16} /></button>
            </div>
          )}

          {/* Token input */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: qrDepositPreview || qrDepositPreviewError ? '1rem' : '0' }}>
            <button
              onClick={() => setShowQRCamera(!showQRCamera)}
              style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}
            >
              <Camera size={18} /> {showQRCamera ? 'Fermer Caméra' : 'Scanner Caméra'}
            </button>
            <input
              type="text"
              placeholder="Coller le token QR du livreur..."
              value={qrDepositToken}
              onChange={e => {
                setQrDepositToken(e.target.value);
                setQrDepositPreviewError('');
                setQrDepositPreview(null);
              }}
              style={{
                flex: 1, minWidth: '200px',
                padding: '0.75rem 1rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${qrDepositPreviewError ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.35)'}`,
                color: '#fff', fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handlePreviewQrDeposit(qrDepositToken)}
              id="btn-verify-qr"
              disabled={qrDepositToken.length < 10 || qrDepositLoading}
              style={{
                padding: '0.75rem 1.25rem', borderRadius: '10px', border: 'none',
                background: qrDepositToken.length >= 10 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                color: qrDepositToken.length >= 10 ? '#fbbf24' : '#475569',
                fontWeight: '700', fontSize: '0.85rem', cursor: qrDepositToken.length >= 10 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}
            >
              <ScanLine size={16} /> {qrDepositLoading ? 'Vérification...' : 'Vérifier'}
            </button>
          </div>

          {showQRCamera && (
            <div style={{ margin: '1rem 0', background: '#000', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(245,158,11,0.3)' }}>
              <QRScanner
                onScanSuccess={(text) => {
                  setQrDepositToken(text);
                  setShowQRCamera(false);
                  setTimeout(() => {
                    const btn = document.getElementById('btn-verify-qr');
                    if (btn) btn.click();
                  }, 100);
                }}
              />
            </div>
          )}

          {/* Error */}
          {qrDepositPreviewError && (
            <div style={{ fontSize: '0.82rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.75rem', background: 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>
              <AlertCircle size={14} /> {qrDepositPreviewError}
            </div>
          )}

          {/* Preview card */}
          {qrDepositPreview && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#fff', fontSize: '1rem' }}>{qrDepositPreview.driverName}</div>
                  {qrDepositPreview.driverPhone && (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.1rem' }}>Tél : {qrDepositPreview.driverPhone}</div>
                  )}
                  {qrDepositPreview.isExpired && (
                    <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <AlertCircle size={12} /> QR expiré — demandez au livreur d'en générer un nouveau
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Montant à recevoir</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fbbf24' }}>{qrDepositPreview.amount.toLocaleString('fr-FR')} CDF</div>
                </div>
              </div>
              {!qrDepositPreview.isExpired && (
                <button
                  onClick={handleConfirmQrDeposit}
                  disabled={qrDepositLoading}
                  style={{
                    marginTop: '1rem', width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.85rem', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#000', fontWeight: '800', fontSize: '0.95rem',
                    cursor: qrDepositLoading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 4px 16px rgba(34,197,94,0.35)',
                  }}
                >
                  <CheckCircle size={18} />
                  {qrDepositLoading ? 'Confirmation...' : `Confirmer réception de ${qrDepositPreview.amount.toLocaleString('fr-FR')} CDF`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* -- Section : Demandes de versement Livreurs (dans Finances) ---------- */}
      {activeTab === 'finances' && driverCashRequests.filter(r => r.status === 'PENDING').length > 0 && (
        <div style={{ margin: '0 2rem 1.5rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '16px', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '700', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={16} /> Demandes de versement Livreurs ({driverCashRequests.filter(r => r.status === 'PENDING').length} en attente)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {driverCashRequests.filter(r => r.status === 'PENDING').map(req => {
              const driverName = req.driver?.profile?.name || 'Livreur inconnu';
              const driverPhone = req.driver?.phone || '';
              const waMsg = encodeURIComponent(`Bonjour ${driverName}, votre demande de versement de ${req.amount.toLocaleString('fr-FR')} CDF a été traitée.`);
              return (
                <div key={req.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem' }}>{driverName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      {new Date(req.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {req.note && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>"{req.note}"</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#fbbf24' }}>{req.amount.toLocaleString('fr-FR')} CDF</span>
                    {driverPhone && (
                      <a href={`https://wa.me/${driverPhone.replace(/[^0-9]/g, '')}?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.8rem', borderRadius: '8px', border: '1px solid #25D366', color: '#25D366', fontSize: '0.78rem', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        <Phone size={12} /> WhatsApp
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/agency/cash-requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'PAID' }) });
                        if (res.ok) loadDriverCashRequests();
                        else alert('Erreur lors de la mise à jour.');
                      }}
                      style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✓ Versé
                    </button>
                    <button
                      onClick={async () => {
                        const reason = prompt('Motif du refus (optionnel) :');
                        const res = await fetch(`/api/agency/cash-requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'REJECTED', rejectReason: reason || undefined }) });
                        if (res.ok) loadDriverCashRequests();
                        else alert('Erreur lors de la mise à jour.');
                      }}
                      style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#f87171', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✗ Refuser
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -- Section: Demandes de versement Vendeurs (Finances) ------------- */}
      {activeTab === 'finances' && (
        <div style={{ margin: '0 2rem 1.5rem', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '16px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={16} /> Demandes versement Vendeurs
              {vendorPaymentRequests.filter(r => ['PENDING','SEEN'].includes(r.status)).length > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '20px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: '800' }}>
                  {vendorPaymentRequests.filter(r => ['PENDING','SEEN'].includes(r.status)).length}
                </span>
              )}
            </h3>
            <button onClick={loadVendorPaymentRequests} style={{ background: 'transparent', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '0.3rem 0.65rem', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>↻ Actualiser</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {vendorPaymentRequests.filter(r => ['PENDING','SEEN'].includes(r.status)).map(req => {
              const vendorName = req.vendor?.name || 'Vendeur inconnu';
              const vendorPhone = req.vendor?.phone || '';
              const waMsg = encodeURIComponent(`Bonjour ${vendorName}, votre demande de versement de ${req.amount.toLocaleString('fr-FR')} CDF est en cours de traitement.`);
              return (
                <div key={req.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {vendorName}
                      {req.status === 'PENDING' && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(239,68,68,0.2)', color: '#f87171', fontWeight: '800' }}>NOUVEAU</span>}
                      {req.activeOtp && (
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <KeyRound size={11} /> OTP actif (En attente du vendeur)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      {new Date(req.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {req.message && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>"{req.message}"</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#60a5fa' }}>{req.amount.toLocaleString('fr-FR')} CDF</span>
                    {vendorPhone && (
                      <a href={`https://wa.me/${vendorPhone.replace(/[^0-9]/g, '')}?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.7rem', borderRadius: '8px', border: '1px solid #25D366', color: '#25D366', fontSize: '0.75rem', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        <Phone size={12} /> WhatsApp
                      </a>
                    )}
                    <button
                      title="Générer un code OTP sécurisé que le vendeur validera dans son espace"
                      onClick={() => {
                        setOtpPaymentModal({
                          vendorId: req.vendor_id,
                          vendorName: vendorName,
                          amount: req.amount,
                          requestId: req.id,
                        });
                      }}
                      style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <KeyRound size={13} /> {req.activeOtp ? 'Régénérer OTP' : 'Générer OTP'}
                    </button>
                    <button
                      title="Confirmer un versement en espèces déjà remis en main propre (sans OTP)"
                      onClick={async () => {
                        if (!confirm(`Confirmer le versement direct de ${req.amount.toLocaleString('fr-FR')} CDF en espèces à ${vendorName} (sans code OTP) ?`)) return;
                        const res = await fetch(`/api/agency/vendor-requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'PAID' }) });
                        if (res.ok) {
                          loadVendorPaymentRequests();
                        } else alert('Erreur lors de la confirmation.');
                      }}
                      style={{ padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      Espèces
                    </button>
                    <button
                      onClick={async () => {
                        const reason = prompt('Motif du refus (optionnel) :');
                        if (reason === null) return;
                        const res = await fetch(`/api/agency/vendor-requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'REJECTED', rejectReason: reason || undefined }) });
                        if (res.ok) loadVendorPaymentRequests();
                        else alert('Erreur.');
                      }}
                      style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#f87171', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      ✗ Refuser
                    </button>
                  </div>
                </div>
              );
            })}
            {vendorPaymentRequests.filter(r => ['PENDING','SEEN'].includes(r.status)).length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#475569', fontSize: '0.85rem' }}>
                <DollarSign size={28} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.3 }} />
                Aucune demande de versement en attente des vendeurs.
                <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: '0.3rem' }}>Les vendeurs peuvent demander le versement depuis leur tableau de bord.</div>
              </div>
            )}
          </div>
          {vendorPaymentRequests.filter(r => !['PENDING','SEEN'].includes(r.status)).length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
              <p style={{ fontSize: '0.72rem', color: '#475569', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historique récent</p>
              {vendorPaymentRequests.filter(r => !['PENDING','SEEN'].includes(r.status)).slice(0, 5).map(req => (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>{req.vendor?.name || 'Vendeur'} — {new Date(req.created_at).toLocaleDateString('fr-FR')}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: '#60a5fa', fontWeight: '600' }}>{req.amount.toLocaleString('fr-FR')} CDF</span>
                    <span style={{ padding: '0.1rem 0.45rem', borderRadius: '5px', fontWeight: '700', fontSize: '0.68rem', background: req.status === 'PAID' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: req.status === 'PAID' ? '#4ade80' : '#f87171' }}>
                      {req.status === 'PAID' ? '✓ Versé' : '✗ Refusé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -- TAB: Marketing & Sécurité --------------------------------------- */}
      {activeTab === 'marketing_securite' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* SECTION SÉCURITÉ */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={20} /> Paramètres de Sécurité (Anti-Fraude)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* Double Validation */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontWeight: '600', display: 'block' }}>Double validation des virements</span>
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Processus Maker/Checker</span>
                  </div>
                  <div className="toggle-switch">
                    <input type="checkbox" id="toggle-2fa" checked={proSettings.requireManagerApproval} onChange={e => handleProSettingsUpdate({ requireManagerApproval: e.target.checked })} />
                    <label htmlFor="toggle-2fa"></label>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', lineHeight: '1.4' }}>
                  Un manager doit approuver tout virement initié par un agent (employé) avant que le code OTP ne soit généré et envoyé au vendeur.
                </p>
              </div>

              {/* Verrouillage Horaires */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontWeight: '600', display: 'block' }}>Verrouillage Horaires & IP</span>
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Contrôle d'accès employés</span>
                  </div>
                  <div className="toggle-switch">
                    <input type="checkbox" id="toggle-hours" checked={proSettings.enforceHours} onChange={e => handleProSettingsUpdate({ enforceHours: e.target.checked })} />
                    <label htmlFor="toggle-hours"></label>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1rem', lineHeight: '1.4' }}>
                  Bloquer la connexion des employés de l'agence en dehors des heures définies.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="time" className="input-field" value={proSettings.allowedStartTime} onChange={e => handleProSettingsUpdate({ allowedStartTime: e.target.value })} style={{ padding: '0.5rem', flex: 1, background: 'rgba(0,0,0,0.2)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>à</span>
                  <input type="time" className="input-field" value={proSettings.allowedEndTime} onChange={e => handleProSettingsUpdate({ allowedEndTime: e.target.value })} style={{ padding: '0.5rem', flex: 1, background: 'rgba(0,0,0,0.2)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION MARKETING */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Star size={20} /> Marketing & Fidélisation
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* Promo Codes */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <span style={{ fontWeight: '600' }}>Générateur de Codes Promo</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input type="text" placeholder="Ex: NOEL10" className="input-field" style={{ flex: 1 }} value={promoForm.code} onChange={e => setPromoForm(p => ({...p, code: e.target.value.toUpperCase()}))} />
                  <input type="number" className="input-field" style={{ width: '80px' }} value={promoForm.discountPercent} onChange={e => setPromoForm(p => ({...p, discountPercent: Number(e.target.value)}))} />
                  <span style={{ alignSelf: 'center', color: '#fff' }}>%</span>
                  <button onClick={handleCreatePromo} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>+ Créer</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {promoCodes.length === 0 ? <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Aucun code promo créé.</p> : promoCodes.map(pc => (
                    <div key={pc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px dashed rgba(59, 130, 246, 0.5)' }}>
                      <span style={{ fontWeight: '800', color: '#60a5fa', letterSpacing: '1px' }}>{pc.code}</span>
                      <span style={{ fontWeight: '600', color: '#fff' }}>-{pc.discount_percent}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Volume Discount */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: '600' }}>Réduction au volume</span>
                  <div className="toggle-switch">
                    <input type="checkbox" id="toggle-vol" checked={proSettings.volumeDiscountEnabled} onChange={e => handleProSettingsUpdate({ volumeDiscountEnabled: e.target.checked })} />
                    <label htmlFor="toggle-vol"></label>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                  Applique automatiquement une remise sur les frais de livraison aux vendeurs très actifs de votre agence.
                </p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Si &gt; </span>
                  <input type="number" value={proSettings.volumeThreshold} onChange={e => handleProSettingsUpdate({ volumeThreshold: Number(e.target.value) })} className="input-field" style={{ width: '60px', padding: '0.4rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>colis/sem., remise de</span>
                  <input type="number" value={proSettings.volumeDiscountPercent} onChange={e => handleProSettingsUpdate({ volumeDiscountPercent: Number(e.target.value) })} className="input-field" style={{ width: '60px', padding: '0.4rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- TAB: Paramètres ----------------------------------------------- */}
      {activeTab === 'parametres' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
          
          {/* Section: Informations du compte */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Store size={20} /> Informations du compte Agence
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.4rem' }}>Nom de l'agence</label>
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '8px', fontWeight: '600' }}>
                  {agencyProfile?.profile?.name || 'Non renseigné'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.4rem' }}>Email de contact</label>
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                  {agencyProfile?.profile?.email || 'Non renseigné'}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.4rem' }}>Adresse physique / d'expédition</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px' }}>
                  <MapPin size={18} color="#3b82f6" />
                  <span style={{ fontSize: '0.95rem' }}>{agencyAddress || 'Aucune adresse enregistrée'}</span>
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertCircle size={12} /> Cette adresse est utilisée comme point de départ pour le calcul kilométrique. En cas de déménagement, contactez l'administrateur.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Changer le mot de passe */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <KeyRound size={20} /> Changer le mot de passe
            </h3>
            <p style={{ opacity: 0.65, fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Mettez à jour votre mot de passe de connexion. Choisissez un mot de passe fort d'au moins 8 caractères.
            </p>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '420px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', opacity: 0.75, marginBottom: '0.4rem' }}>Mot de passe actuel</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', opacity: 0.75, marginBottom: '0.4rem' }}>Nouveau mot de passe</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Minimum 8 caractères"
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', opacity: 0.75, marginBottom: '0.4rem' }}>Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Répétez le nouveau mot de passe"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  required
                />
              </div>
              {pwMsg && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  background: pwMsg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: pwMsg.type === 'success' ? '#10b981' : '#f87171',
                  border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {pwMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={pwLoading}
                  style={{ padding: '0.65rem 1.75rem', opacity: pwLoading ? 0.6 : 1 }}
                >
                  {pwLoading ? 'Enregistrement...' : 'Changer le mot de passe'}
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>Tarification par Commune</h3>
            <p style={{ opacity: 0.7, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Définissez le prix de livraison fixe (en FC) pour chaque commune de Kinshasa que vous desservez. 
              Laissez à <strong style={{ color: '#f59e0b' }}>0</strong> pour les communes où vous n'opérez pas — elles seront marquées comme <em>"non disponible"</em> pour les vendeurs.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {globalSettings.communes.map((commune, index) => (
                <div key={commune.name} style={{
                  background: commune.base > 0 ? 'rgba(34, 197, 94, 0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${commune.base > 0 ? 'rgba(34, 197, 94, 0.25)' : 'var(--card-border)'}`,
                  borderRadius: '10px',
                  padding: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: commune.base > 0 ? '#4ade80' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={13} /> {commune.name}
                    </label>
                    {commune.base > 0 && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '700' }}>
                        Actif
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <input 
                      type="number"
                      min="0"
                      step="0.5"
                      className="input-field"
                      style={{ border: 'none', background: 'transparent', width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                      placeholder="0"
                      value={commune.base || ''} 
                      onChange={e => {
                        const newCommunes = [...globalSettings.communes];
                        newCommunes[index] = { ...newCommunes[index], base: parseFloat(e.target.value) || 0 };
                        setGlobalSettings(prev => ({ ...prev, communes: newCommunes }));
                      }}
                    />
                    <span style={{ padding: '0 0.75rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>FC</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>Suppléments (Km / Poids)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', opacity: 0.8 }}>Tarif Standard Poids (FC par Kg)</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <input 
                      type="number" step="50" className="input-field" style={{ border: 'none', background: 'transparent', width: '100%' }}
                      value={globalSettings.defaultPricePerKg} 
                      onChange={e => setGlobalSettings(prev => ({ ...prev, defaultPricePerKg: parseFloat(e.target.value) || 0 }))}
                    />
                    <span style={{ padding: '0 1rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold' }}>FC / kg</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', opacity: 0.8 }}>Tarif Standard Distance (FC par Km)</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <input 
                      type="number" step="50" className="input-field" style={{ border: 'none', background: 'transparent', width: '100%' }}
                      value={globalSettings.defaultPricePerKm} 
                      onChange={e => setGlobalSettings(prev => ({ ...prev, defaultPricePerKm: parseFloat(e.target.value) || 0 }))}
                    />
                    <span style={{ padding: '0 1rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold' }}>FC / km</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>Taux de change</h3>
            <p style={{ opacity: 0.7, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Définissez le taux de change applicable par votre agence. Ce montant ne peut pas dépasser le plafond défini par l'administrateur de Moncolis.
            </p>
            <div style={{ maxWidth: '360px' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', opacity: 0.8 }}>
                Taux Franc Congolais (FC pour 1 USD)
                <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#f59e0b', fontWeight: '600' }}>
                  — Plafond admin : {plafondAdmin.toLocaleString('fr-FR')} FC
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${globalSettings.tauxConversionFC > plafondAdmin ? '#ef4444' : 'var(--card-border)'}` }}>
                  <input 
                    type="number" className="input-field" style={{ border: 'none', background: 'transparent', width: '100%' }}
                    value={globalSettings.tauxConversionFC}
                    min={1}
                    max={plafondAdmin}
                    onChange={e => {
                      let val = parseInt(e.target.value) || 0;
                      if (val > plafondAdmin) {
                        val = plafondAdmin;
                      }
                      setGlobalSettings(prev => ({ ...prev, tauxConversionFC: val }));
                    }}
                  />
                  <span style={{ padding: '0 1rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold' }}>FC</span>
              </div>
              {globalSettings.tauxConversionFC >= plafondAdmin && (
                <p style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertCircle size={13} /> Vous avez atteint le plafond maximum fixé par l'administrateur ({plafondAdmin.toLocaleString('fr-FR')} FC).
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} onClick={handleSaveParams}>
              Sauvegarder les paramètres
            </button>
          </div>
        </div>
      )}

      </main>

      {/* -- Modal: Payer un vendeur via OTP --------------------------------- */}
      {otpPaymentModal && !otpPaymentResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} color="#fbbf24" /> Paiement Sécurisé OTP
              </h2>
              <button onClick={() => setOtpPaymentModal(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              Génération d'un code de paiement pour <strong style={{ color: '#fff' }}>{otpPaymentModal.vendorName}</strong>.<br />
              Le code sera valable <strong style={{ color: '#fbbf24' }}>15 minutes</strong>. Transmettez-le en main propre.
            </p>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>Montant à verser</p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '1.8rem', fontWeight: '900', color: '#fbbf24' }}>
                {otpPaymentModal.amount.toLocaleString('fr-FR')} CDF
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setOtpPaymentModal(null)}>Annuler</button>
              <button
                onClick={async () => {
                  setOtpPaymentLoading(true);
                  try {
                    const res = await fetch('/api/agency/payments/initiate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        vendorId: otpPaymentModal!.vendorId,
                        amount: otpPaymentModal!.amount,
                        requestId: otpPaymentModal!.requestId,
                      }),
                    });
                    const json = await res.json();
                    if (res.ok) {
                      setOtpPaymentResult({ otp: json.otp, amount: json.amount, vendorName: otpPaymentModal!.vendorName, expiresAt: json.expiresAt });
                      setOtpPaymentModal(null);
                      loadVendorPaymentRequests();
                    } else {
                      alert(json.error || 'Erreur lors de la génération du code.');
                    }
                  } catch { alert('Erreur réseau.'); }
                  finally { setOtpPaymentLoading(false); }
                }}
                disabled={otpPaymentLoading}
                style={{ flex: 1, padding: '0.65rem', borderRadius: '9999px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', fontWeight: '700', cursor: otpPaymentLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: otpPaymentLoading ? 0.7 : 1 }}
              >
                <KeyRound size={14} /> {otpPaymentLoading ? 'Génération...' : 'Générer le code OTP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Modal: Code OTP généré à montrer à l'agence -------------------- */}
      {otpPaymentResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center', border: '1px solid rgba(245,158,11,0.4)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
            <h3 style={{ margin: '0 0 0.3rem', color: '#fbbf24' }}>Code OTP généré !</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Transmettez ce code à <strong style={{ color: '#fff' }}>{otpPaymentResult.vendorName}</strong> maintenant.<br />
              Il expire dans <strong style={{ color: '#fbbf24' }}>15 minutes</strong>.
            </p>
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '2px dashed rgba(245,158,11,0.5)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code de confirmation</p>
              <span style={{ fontSize: '3rem', fontWeight: '900', letterSpacing: '10px', color: '#fbbf24', display: 'block' }}>
                {otpPaymentResult.otp}
              </span>
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Montant : {otpPaymentResult.amount.toLocaleString('fr-FR')} CDF
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => navigator.clipboard.writeText(otpPaymentResult!.otp)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '9999px', border: '1px solid #fbbf24', background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Copy size={14} /> Copier
              </button>
              <button
                onClick={() => setOtpPaymentResult(null)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '9999px', border: 'none', background: '#fbbf24', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', fontSize: '0.85rem' }}
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Modal: Réinitialiser le PIN -------------------------------------- */}
      {resetPinDriver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} color="#fbbf24" /> Réinitialiser le PIN
              </h2>
              <button onClick={() => setResetPinDriver(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              Nouveau code PIN pour <strong style={{ color: '#fff' }}>{resetPinDriver.name}</strong>.<br />
              Laissez vide pour en générer un automatiquement.
            </p>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Nouveau PIN (4 chiffres) — optionnel"
              className="input-field"
              value={resetPinValue}
              onChange={e => setResetPinValue(e.target.value.slice(0, 4))}
              style={{ letterSpacing: '4px', fontWeight: '700', marginBottom: '1.25rem', textAlign: 'center', fontSize: '1.4rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setResetPinDriver(null)}>Annuler</button>
              <button
                type="button"
                onClick={handleResetPin}
                disabled={resetPinLoading}
                style={{ flex: 1, padding: '0.65rem', borderRadius: '9999px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', fontWeight: '700', cursor: resetPinLoading ? 'not-allowed' : 'pointer', opacity: resetPinLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontFamily: 'inherit' }}
              >
                <KeyRound size={14} /> {resetPinLoading ? 'En cours...' : 'Générer et enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Notification: Nouveau PIN affiché après reset ------------------- */}
      {resetPinResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '380px', padding: '2rem', textAlign: 'center', border: '1px solid rgba(245,158,11,0.4)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔑</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#fbbf24' }}>PIN réinitialisé !</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Transmettez ce nouveau code à <strong style={{ color: '#fff' }}>{resetPinResult.name}</strong> :
            </p>
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '8px', color: '#fbbf24' }}>
                {resetPinResult.pin}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { navigator.clipboard.writeText(resetPinResult!.pin); }}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '9999px', border: '1px solid #fbbf24', background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Copy size={14} /> Copier
              </button>
              <button
                onClick={() => setResetPinResult(null)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '9999px', border: 'none', background: '#fbbf24', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', fontSize: '0.85rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Modal: Ajouter un livreur -------------------------------------- */}

      {showAddLivreur && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Nouveau Livreur</h2>
              <button onClick={() => setShowAddLivreur(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <form onSubmit={handleAddLivreur} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', opacity: 0.8 }}>Nom complet du livreur *</label>
                <input required placeholder="Ex : Patrick Makiese" className="input-field" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', opacity: 0.8 }}>Numéro de téléphone *</label>
                <input required type="tel" placeholder="Ex : +243 81 44 55 660" className="input-field" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.9rem', opacity: 0.8 }}>Type de véhicule</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {[
                    { value: 'Moto', label: 'Moto', icon: '🏍️' },
                    { value: 'Voiture', label: 'Voiture', icon: '🚗' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewVehicle(opt.value)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '0.6rem',
                        border: newVehicle === opt.value
                          ? '2px solid #6366f1'
                          : '2px solid rgba(255,255,255,0.1)',
                        background: newVehicle === opt.value
                          ? 'rgba(99,102,241,0.2)'
                          : 'rgba(255,255,255,0.05)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.85rem',
                        fontWeight: newVehicle === opt.value ? '600' : '400',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '1.6rem' }}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.9rem', opacity: 0.8 }}>
                  <Lock size={15} /> Code PIN de connexion (4 chiffres)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Laissez vide pour génération automatique"
                  className="input-field"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.slice(0, 6))}
                  style={{ letterSpacing: '4px', fontWeight: '700' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>
                  Si vide, un code PIN sera généré automatiquement et affiché après la création.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '0.65rem' }} onClick={() => setShowAddLivreur(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.65rem' }}>Créer et Générer le PIN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -- Modal: Confirmation Paiement Sécurisée ------------------------ */}
      {paymentConfirmationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem', backdropFilter: 'blur(5px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '2rem', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(15,23,42,0.95)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={24} color="#ef4444" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f87171' }}>Confirmation de Règlement</h2>
            </div>
            
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', opacity: 0.9, marginBottom: '1.5rem' }}>
              Vous êtes sur le point de marquer un règlement de <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{paymentConfirmationModal.amount.toLocaleString('fr-FR')} $</strong> pour le vendeur <strong>{paymentConfirmationModal.vendorName}</strong>.
            </p>

            <div style={{ background: 'rgba(239,68,68,0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem', margin: 0, color: '#fca5a5' }}>
                <strong>Attention :</strong> Cette action est irréversible. Assurez-vous d'avoir <u>déjà effectué le transfert d'argent</u> (Mobile Money, Espèces, Banque) avant de confirmer.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
                Tapez <strong>PAYE</strong> pour confirmer l'action :
              </label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="PAYE" 
                style={{ textTransform: 'uppercase', borderColor: paymentConfirmationModal.inputText.toUpperCase() === 'PAYE' ? '#10b981' : 'var(--card-border)' }}
                value={paymentConfirmationModal.inputText}
                onChange={e => setPaymentConfirmationModal(prev => prev ? { ...prev, inputText: e.target.value } : null)}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-outline" 
                style={{ flex: 1, padding: '0.75rem' }} 
                onClick={() => setPaymentConfirmationModal(null)}
              >
                Annuler
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.75rem', background: '#ef4444', borderColor: '#ef4444' }} 
                disabled={paymentConfirmationModal.inputText.toUpperCase() !== 'PAYE'}
                onClick={async () => {
                  if (paymentConfirmationModal.inputText.toUpperCase() !== 'PAYE') return;
                  
                  try {
                    const { dataService } = await import('@/lib/data-service');
                    
                    if (paymentConfirmationModal.type === 'bulk' && paymentConfirmationModal.vendorId) {
                      await dataService.markVendorDebtsAsPaid(user?.agencyId || '', paymentConfirmationModal.vendorId);
                      setColis(prev => prev.map(col => col.vendeurId === paymentConfirmationModal.vendorId && col.status === 'Livré' && !col.isPrepaid ? { ...col, vendorPaid: true } : col));
                    } 
                    else if (paymentConfirmationModal.type === 'single' && paymentConfirmationModal.colisId) {
                      await dataService.payVendor(paymentConfirmationModal.colisId);
                      setColis(prev => prev.map(col => col.id === paymentConfirmationModal.colisId ? { ...col, vendorPaid: true } : col));
                    }
                    
                    setPaymentConfirmationModal(null);
                  } catch (e) {
                    console.error(e);
                    alert("Erreur lors du paiement");
                  }
                }}
              >
                Confirmer le règlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
