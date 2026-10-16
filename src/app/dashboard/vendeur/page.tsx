'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import CommuneSelect from '@/components/CommuneSelect';
import {
  Package,
  History,
  DollarSign,
  Users,
  User,
  ArrowRight,
  Truck,
  MapPin,
  Phone,
  Search,
  Share2,
  Copy,
  Check,
  Plus,
  X,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  ShieldCheck,
  LogOut,
  Star,
  Lock,
  KeyRound,
  CheckCircle
} from 'lucide-react';
import { dataService, ColisItem, DEFAULT_AGENCIES, DEFAULT_DROP_POINTS, DropPoint } from '@/lib/data-service';
import { useAuth } from '@/lib/use-auth';
import { COMMUNES_KINSHASA } from '@/lib/constants';
import { useCurrency } from '@/components/CurrencyContext';
import CurrencyToggle from '@/components/CurrencyToggle';

type Colis = ColisItem;
type Tab = 'apercu' | 'historique' | 'revenus' | 'clients' | 'profil';

const STATUS_COLOR: Record<string, string> = {
  'Livré': '#22c55e',
  'En transit': '#3b82f6',
  "En attente d'agence": '#f59e0b',
  'Créé': '#a855f7',
  'Déposé en point relais': '#06b6d4',
  'Disponible au point relais': '#10b981',
  'Annulé': '#ef4444',
};

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
  const [showModal, setShowModal] = useState(false);
  const [createdPackage, setCreatedPackage] = useState<Colis | null>(null);
  const [agencyModalColisId, setAgencyModalColisId] = useState<string | null>(null);
  const [qrScanColisId, setQrScanColisId] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<import('@/lib/data-service').AgencyInfo[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResult, setOtpResult] = useState<{ success: boolean; message: string; amount?: number } | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<Array<{ id: string; amount: number; agency: string; expires_at: string }>>([]);

  // Demande de versement in-app
  const [vendorRequestModal, setVendorRequestModal] = useState<{
    agencyId: string;
    agencyName: string;
    agencyPhone: string;
    amount: number; // en USD
    amountCDF: number; // converti
  } | null>(null);
  const [vendorRequestMessage, setVendorRequestMessage] = useState('');
  const [vendorRequestLoading, setVendorRequestLoading] = useState(false);
  const [vendorRequestSuccess, setVendorRequestSuccess] = useState<string | null>(null);
  const [vendorRequests, setVendorRequests] = useState<Array<{
    id: string;
    agency_id: string;
    amount: number;
    status: string;
    message: string | null;
    reject_reason: string | null;
    created_at: string;
    activeOtp?: { id: string; amount: number; expires_at: string; created_at: string } | null;
  }>>([]); 

  // Compte à rebours — verrou de 1h sur le bouton "Demander mon argent"
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  /** Renvoie { locked: boolean, remainingSec: number } pour une demande en cours */
  const getLockInfo = (req: { status: string; created_at: string } | undefined) => {
    if (!req) return { locked: false, remainingSec: 0 };
    // OTP actif → bouton reste bloqué (l'agence a généré le code, on attend la validation)
    if ((req as any).activeOtp) return { locked: true, remainingSec: 0, otpMode: true };
    const LOCK_MS = 60 * 60 * 1000; // 1 heure
    const elapsed = now - new Date(req.created_at).getTime();
    const remaining = LOCK_MS - elapsed;
    return { locked: remaining > 0, remainingSec: Math.max(0, Math.ceil(remaining / 1000)), otpMode: false };
  };

  /** Formate mm:ss */
  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const loadVendorRequests = async () => {
    try {
      const res = await fetch('/api/vendor/payments/request');
      const json = await res.json();
      if (res.ok) setVendorRequests(json.requests || []);
    } catch { /* ignore */ }
  };


  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tous');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Formulaire nouveau colis
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
  const [originDropPointId, setOriginDropPointId] = useState('DP-GOM-01');
  const [agentNumberInput, setAgentNumberInput] = useState('');
  const [selectedDropPointAgencyId, setSelectedDropPointAgencyId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profil Vendeur — initialisé depuis la session
  const [profil, setProfil] = useState({
    nom: user?.name || 'Ma Boutique',
    email: user?.email || '',
    telephone: user?.phone || '',
    adresse: '',
    description: '',
  });
  const [editProfil, setEditProfil] = useState(false);
  const [profilDraft, setProfilDraft] = useState(profil);

  // Mettre à jour le profil quand la session est chargée
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      const dbProfile = await dataService.getProfile(user.id);
      const metadata = dbProfile?.metadata || {};
      const p = {
        nom: dbProfile?.name || user.name || 'Ma Boutique',
        email: user.email || '',
        telephone: dbProfile?.phone || user.phone || '',
        adresse: metadata.adresse || '',
        description: metadata.description || '',
      };
      setProfil(p);
      setProfilDraft(p);
    }
    loadProfile();
  }, [user?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const res = await dataService.updateProfile(user.id, {
      name: profilDraft.nom,
      phone: profilDraft.telephone,
      metadata: { adresse: profilDraft.adresse, description: profilDraft.description }
    });
    if (res.success) {
      setProfil(profilDraft);
      setEditProfil(false);
      showToast('Profil enregistré avec succès');
    } else {
      showToast(res.message || 'Erreur');
    }
  };

  // Charger uniquement les colis de ce vendeur
  const refreshColis = async () => {
    if (!user?.id) return;
    setLoading(true);
    const vendorPkgs = await dataService.getPackagesForVendor(user.id);
    setColis(vendorPkgs);
    setLoading(false);
  };

  // Taux de conversion propre à chaque agence (chargé au démarrage)
  const [agencyRatesMap, setAgencyRatesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user?.id) return;
    refreshColis();
    // Charger les taux de conversion de toutes les agences
    dataService.getAgencies().then(list => {
      const map: Record<string, number> = {};
      list.forEach(ag => { if (ag.id && ag.tauxConversionFC) map[ag.id] = ag.tauxConversionFC; });
      setAgencyRatesMap(map);
    }).catch(() => {});
    const unsubscribe = dataService.subscribeToPackages(() => {
      refreshColis();
    });
    return () => unsubscribe();
  }, [user?.id]);



  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  /* --- Calculs Statistiques --- */
  const colisLivres = colis.filter(c => c.status === 'Livré');
  const colisEnCours = colis.filter(c => c.status === 'En transit' || c.status === "En attente d'agence" || c.status === 'Créé');

  // Argent de marchandise que l'agence doit reverser (colis livrés, non prépayés, pas encore reversés)
  const soldeEnAttenteAgence = colisLivres
    .filter(c => !c.isPrepaid && !c.vendorPaid)
    .reduce((s, c) => s + c.prixColis, 0);

  // Frais de livraison à la charge du vendeur (dettes envers l'agence)
  const dettesLivraison = colisLivres
    .filter(c => !c.paidByClient)
    .reduce((s, c) => s + (c.prixLivraison ?? 0), 0);

  // Montant total de marchandises livrées
  const totalRevenu = colisLivres.reduce((s, c) => s + c.prixColis, 0);

  // Frais de livraison total (tous)
  const totalLivraison = colisLivres.reduce((s, c) => s + (c.prixLivraison ?? 0), 0);

  // Revenu net = marchandises - frais de livraison vendeur
  const revenuNet = totalRevenu - dettesLivraison;

  // Finances par agence — le type inclut maintenant le taux propre de l'agence
  const agencesFinancesMap = new Map<string, { agencyId: string; agencyName: string; duAuVendeur: number; dettesVendeur: number; soldeNet: number; phone?: string; tauxConversionFC: number }>();
  
  colisLivres.forEach(c => {
    if (!c.agencyId || !c.agence) return;
    if (!agencesFinancesMap.has(c.agencyId)) {
      agencesFinancesMap.set(c.agencyId, {
        agencyId: c.agencyId,
        agencyName: c.agence,
        duAuVendeur: 0,
        dettesVendeur: 0,
        soldeNet: 0,
        phone: '',
        // Taux propre à l'agence pour conversion USD→CDF correcte
        tauxConversionFC: agencyRatesMap[c.agencyId] || exchangeRate || 2800,
      });
    }
    const stats = agencesFinancesMap.get(c.agencyId)!;
    
    if (!c.isPrepaid && !c.vendorPaid) {
      stats.duAuVendeur += c.prixColis;
    }
    if (!c.paidByClient && !c.vendorPaid) { // We assume the debt is settled when vendor_paid is true for simplicity, or we just track overall. Wait, if vendorPaid is true, the net balance for this package is settled.
      stats.dettesVendeur += (c.prixLivraison || 0);
    }
    stats.soldeNet = stats.duAuVendeur - stats.dettesVendeur;
  });
  const agencesFinances = Array.from(agencesFinancesMap.values()).filter(a => Math.abs(a.soldeNet) > 0 || a.duAuVendeur > 0 || a.dettesVendeur > 0);

  // Clients uniques
  const clientsMap = new Map<string, { name: string; phone: string; colis: Colis[] }>();
  colis.forEach(c => {
    const key = c.clientPhone || c.clientName;
    if (!clientsMap.has(key)) {
      clientsMap.set(key, { name: c.clientName, phone: c.clientPhone, colis: [] });
    }
    clientsMap.get(key)!.colis.push(c);
  });
  const clients = Array.from(clientsMap.values());

  // Filtrage des colis pour l'historique
  const filteredColis = useMemo(() => {
    return colis.filter(c => {
      const matchSearch =
        c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clientPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clientAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.agence && c.agence.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === 'Tous' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [colis, searchQuery, statusFilter]);

  /* --- Handlers --- */
  const handleCreateColis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const fullAddress = `${clientNumero ? 'N°' + clientNumero + ', ' : ''}${clientAvenue ? 'Av. ' + clientAvenue + ', ' : ''}${clientQuartier ? 'Q. ' + clientQuartier + ', ' : ''}${clientCommune}${clientReference ? ' (Réf: ' + clientReference + ')' : ''}`;
      const newPkg = await dataService.createPackage({
        clientName,
        clientAddress: fullAddress,
        clientPhone,
        clientCommune,
        prixColis: parseFloat(prixColis) || 0,
        poids: parseFloat(poids) || 1,
        vendeurId: user?.id ?? '',
        paidByClient,
        isPrepaid,
        deliveryMode,
        originDropPointId: deliveryMode === 'DROP_POINT_FIRST_MILE' ? originDropPointId : undefined,
      });
      await refreshColis();
      setShowModal(false);
      setCreatedPackage(newPkg);
      setClientName('');
      setClientCommune('');
      setClientQuartier('');
      setClientAvenue('');
      setClientNumero('');
      setClientReference('');
      setClientPhone('');
      setPrixColis('');
      setIsPrepaid(false);
      setDeliveryMode('DIRECT');
      setActiveTab('historique');
    } catch (error) {
      showToast('Erreur lors de la création du colis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAgencyModal = async (colisId: string) => {
    setAgencyModalColisId(colisId);
    setLoadingAgencies(true);
    const list = await dataService.getAgencies();
    setAgencies(list);
    setLoadingAgencies(false);
  };

  const handleSelectAgency = async (colisId: string, agencyId: string, agencyName: string, deliveryPrice: number) => {
    try {
      await dataService.assignAgencyById(colisId, agencyId, deliveryPrice);
      showToast(`Colis confié à l'agence ${agencyName}`);
      refreshColis();
      setAgencyModalColisId(null);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l\'assignation à l\'agence.');
    }
  };

  const handleAssignToDropPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrScanColisId || !agentNumberInput || !selectedDropPointAgencyId) {
      showToast("Veuillez renseigner le numéro d'agent et choisir une agence.");
      return;
    }

    // Verify agent number
    const agent = await dataService.verifyAgentNumber(agentNumberInput);
    if (!agent) {
      showToast("Numéro agent invalide ou introuvable.");
      return;
    }

    const res = await dataService.assignPackageToDropPointByVendor(
      qrScanColisId,
      agent.dropPointId,
      selectedDropPointAgencyId,
      profil.nom,
      profil.telephone
    );

    showToast(res.message);
    if (res.success) {
      setQrScanColisId(null);
      setAgentNumberInput('');
      setSelectedDropPointAgencyId('');
      refreshColis();
    } else {
      showToast(res.message);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copié dans le presse-papier !`);
  };

  const shareOnWhatsApp = (c: Colis) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://moncolis.cd';
    const trackUrl = `${origin}/track/${c.id}`;
    const text = `Bonjour ${c.clientName}, votre commande de chez *${profil.nom}* a été enregistrée !\n\nColis: *Colis N°* : #${c.id}\nSuivi: *Suivre mon colis en direct* : ${trackUrl}\nCode Secret: *Code Secret de Livraison (OTP)* : *${c.otp}*\n\n_Veuillez communiquer ce code au livreur UNIQUEMENT lors de la réception en main propre de votre colis._`;
    window.open(`https://wa.me/${c.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const tabs: { key: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: 'apercu', icon: <Package size={18} />, label: 'Accueil' },
    { key: 'historique', icon: <History size={18} />, label: 'Mes Colis', badge: colisEnCours.length },
    { key: 'revenus', icon: <DollarSign size={18} />, label: 'Revenus' },
    { key: 'clients', icon: <Users size={18} />, label: 'Clients' },
    { key: 'profil', icon: <User size={18} />, label: 'Boutique' },
  ];

  // -- Garde : session en cours de vérification (déplacé après tous les hooks)
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <ShieldCheck size={40} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
          <p>Vérification de la session...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07090e', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 200,
          background: '#22c55e',
          color: '#000',
          padding: '0.75rem 1.25rem',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '0.9rem',
          boxShadow: '0 10px 30px rgba(34, 197, 94, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <Check size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ---------------------------------------------
          1. HEADER
      --------------------------------------------- */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: 'blur(16px)',
        background: 'rgba(7, 9, 14, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.75rem 1rem',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          {/* Brand & Boutique */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #22c55e, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
              }}>
                <Package size={20} />
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>Moncolis</span>
            </div>

            <div style={{ height: '18px', width: '1px', background: 'rgba(255,255,255,0.15)' }} className="desktop-divider" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#e2e8f0', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profil.nom}
              </span>
              <span style={{
                fontSize: '0.65rem',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                padding: '0.15rem 0.45rem',
                borderRadius: '999px',
                fontWeight: '700',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}>
                Vendeur
              </span>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.35)'
              }}
            >
              <Plus size={16} />
              <span>Nouveau Colis</span>
            </button>

            <button
              onClick={logout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                color: '#94a3b8',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              className="desktop-nav"
              title="Se déconnecter"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
            <CurrencyToggle />
          </div>
        </div>
      </header>

      {/* ---------------------------------------------
          2. MAIN WRAPPER
      --------------------------------------------- */}
      <div style={{
        display: 'flex',
        flex: 1,
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        paddingBottom: '5rem'
      }}>
        
        {/* Desktop Sidebar */}
        <aside style={{
          width: '240px',
          padding: '1.5rem 1rem',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          flexDirection: 'column',
          gap: '0.5rem'
        }} className="desktop-only">
          {tabs.map(t => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: isActive ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
                  background: isActive ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                  color: isActive ? '#4ade80' : '#94a3b8',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {t.icon}
                  <span>{t.label}</span>
                </div>
                {t.badge && t.badge > 0 ? (
                  <span style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '999px',
                    background: '#22c55e',
                    color: '#000',
                    fontSize: '0.7rem',
                    fontWeight: '800'
                  }}>
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Chiffre Net Livré :</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#4ade80', marginTop: '0.2rem' }}>
                {formatPrice(revenuNet)}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content View */}
        <main style={{
          flex: 1,
          padding: '1.25rem 1rem',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}>

          {/* ══════════════ ONGLET 1: ACCUEIL / APERCU ══════════════ */}
          {activeTab === 'apercu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Top Banner Mobile */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(59, 130, 246, 0.1), rgba(255, 255, 255, 0.02))',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '20px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    Bonjour, {profil.nom}
                    {(() => {
                      const badge = getVendorBadge(colisLivres.length);
                      return badge ? (
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '6px', background: `${badge.color}15`, color: badge.color, border: `1px solid ${badge.color}40`, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {badge.icon} {badge.label}
                        </span>
                      ) : null;
                    })()}
                  </h1>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                    {colisEnCours.length} colis en cours d'acheminement aujourd'hui
                  </p>
                </div>

                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '12px',
                    background: '#22c55e',
                    border: 'none',
                    color: '#000',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)'
                  }}
                >
                  <Plus size={18} />
                  <span>Expédier un colis</span>
                </button>
              </div>

              {/* KPI Cards Grid (4 stats) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.85rem'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Total Colis</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff' }}>{colis.length}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Historique complet</span>
                </div>

                <div style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '16px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#93c5fd' }}>En cours</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#60a5fa' }}>{colisEnCours.length}</span>
                  <span style={{ fontSize: '0.7rem', color: '#93c5fd' }}>En agence / route</span>
                </div>

                <div style={{
                  background: 'rgba(34, 197, 94, 0.06)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '16px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#86efac' }}>Livrés (OTP)</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#4ade80' }}>{colisLivres.length}</span>
                  <span style={{ fontSize: '0.7rem', color: '#86efac' }}>100% validés</span>
                </div>

                <div style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '16px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#fcd34d' }}>Taux Succès</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fbbf24' }}>
                    {colis.length > 0 ? Math.round((colisLivres.length / colis.length) * 100) : 0}%
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#fcd34d' }}>Fiabilité globale</span>
                </div>

                <div style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '16px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#fcd34d' }}>Revenu Net</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fbbf24' }}>{formatPrice(revenuNet)}</span>
                  <span style={{ fontSize: '0.7rem', color: '#fcd34d' }}>Net après transport</span>
                </div>
              </div>

              {/* Section Colis Récents */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#fff' }}>
                    Dernières Expéditions
                  </h2>
                  <button
                    onClick={() => setActiveTab('historique')}
                    style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Voir tout ({colis.length}) →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {colis.slice(0, 4).map(c => (
                    <PackageCard
                      key={c.id}
                      colis={c}
                      onSelectAgency={() => openAgencyModal(c.id)}
                      onAssignToDropPoint={() => setQrScanColisId(c.id)}
                      onCopyText={copyToClipboard}
                      onShareWhatsApp={() => shareOnWhatsApp(c)}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ══════════════ ONGLET 2: MES COLIS (Historique & Gestion) ══════════════ */}
          {activeTab === 'historique' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Header Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                    Mes Expéditions ({filteredColis.length})
                  </h1>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                    Copiez le lien de suivi ou le code OTP pour chaque client
                  </p>
                </div>

                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 1rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                  <span>Nouveau Colis</span>
                </button>
              </div>

              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Rechercher par client, téléphone, adresse, agence..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Status Filter Chips */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                paddingBottom: '0.25rem',
                scrollbarWidth: 'none'
              }}>
                {['Tous', 'En transit', 'Livré', "En attente d'agence", 'Créé'].map(st => {
                  const isSel = statusFilter === st;
                  return (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: isSel ? '700' : '500',
                        background: isSel ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: isSel ? '#4ade80' : '#94a3b8',
                        border: isSel ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>

              {/* Packages List */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  Chargement de vos colis...
                </div>
              ) : filteredColis.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)'
                }}>
                  <Package size={40} color="#64748b" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ color: '#fff', fontWeight: '700', margin: '0 0 0.5rem' }}>Aucun colis trouvé</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                    {searchQuery ? 'Aucun résultat ne correspond à votre recherche.' : 'Créez votre première expédition dès maintenant.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {filteredColis.map(c => (
                    <PackageCard
                      key={c.id}
                      colis={c}
                      onSelectAgency={() => openAgencyModal(c.id)}
                      onAssignToDropPoint={() => setQrScanColisId(c.id)}
                      onCopyText={(text, label) => copyToClipboard(text, label)}
                      onShareWhatsApp={() => shareOnWhatsApp(c)}
                    />
                  ))}
                </div>
              )}


            </div>
          )}

          {/* ══════════════ ONGLET 3: REVENUS & FINANCES ══════════════ */}
          {activeTab === 'revenus' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                  Revenus & Comptabilité
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Vue détaillée de vos encaissements, dettes et solde net
                </p>
              </div>

              {/* ── Confirmation de paiement OTP ── */}
              <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '20px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#fbbf24', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <KeyRound size={16} /> Confirmer un paiement reçu
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.1rem' }}>
                  L'agence vous a remis un code à 6 chiffres. Entrez-le ici pour confirmer la réception de votre argent.
                </p>

                {vendorRequests.some(r => r.activeOtp) && (
                  <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#86efac', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <KeyRound size={16} color="#4ade80" />
                    <div>
                      <strong>Un code OTP de versement a été généré par votre agence !</strong>
                      <div style={{ fontSize: '0.75rem', color: '#bbf7d0', marginTop: '0.15rem' }}>
                        Demandez le code à 6 chiffres à votre agence et saisissez-le ci-dessous pour valider la réception.
                      </div>
                    </div>
                  </div>
                )}

                {otpResult ? (
                  <div style={{ background: otpResult.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${otpResult.success ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {otpResult.success ? <CheckCircle size={20} color="#4ade80" /> : <AlertCircle size={20} color="#f87171" />}
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', color: otpResult.success ? '#4ade80' : '#f87171', fontSize: '0.9rem' }}>{otpResult.message}</p>
                      {otpResult.amount && <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Montant confirmé : {otpResult.amount.toLocaleString('fr-FR')} CDF</p>}
                    </div>
                    <button onClick={() => { setOtpResult(null); setOtpInput(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Code à 6 chiffres"
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value.slice(0, 6))}
                      style={{ flex: 1, minWidth: '160px', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)', color: '#fff', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '6px', textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button
                      onClick={async () => {
                        if (otpInput.length !== 6) return;
                        setOtpLoading(true);
                        try {
                          const res = await fetch('/api/vendor/payments/confirm', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ otpCode: otpInput }),
                          });
                          const json = await res.json();
                          setOtpResult({ success: res.ok, message: json.message || json.error, amount: json.amount });
                          if (res.ok) {
                            setOtpInput('');
                            loadVendorRequests();
                            refreshColis();
                          }
                        } catch {
                          setOtpResult({ success: false, message: 'Erreur réseau. Réessayez.' });
                        } finally {
                          setOtpLoading(false);
                        }
                      }}
                      disabled={otpLoading || otpInput.length !== 6}
                      style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', background: otpInput.length === 6 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.08)', color: otpInput.length === 6 ? '#000' : '#64748b', fontWeight: '700', cursor: otpInput.length === 6 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                    >
                      <KeyRound size={15} /> {otpLoading ? 'Vérification...' : 'Confirmer'}
                    </button>
                  </div>
                )}
              </div>

              {/* Financial Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>

                <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '18px', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#86efac', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chiffre d'Affaires Brut</span>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: '#4ade80', margin: '0.4rem 0 0.1rem' }}>
                    {formatPrice(totalRevenu)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Valeur totale des marchandises livrées</span>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '18px', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#fca5a5', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dettes Livraison</span>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444', margin: '0.4rem 0 0.1rem' }}>
                    -{formatPrice(dettesLivraison)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Frais de livraison à votre charge</span>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '18px', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#fcd34d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dû par les Agences</span>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24', margin: '0.4rem 0 0.1rem' }}>
                    {formatPrice(soldeEnAttenteAgence)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Argent collecté, non encore reversé</span>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(59, 130, 246, 0.1))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '18px', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#fff', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenu Net</span>
                  <div style={{ fontSize: '2rem', fontWeight: '900', color: '#22c55e', margin: '0.4rem 0 0.1rem' }}>
                    {formatPrice(revenuNet)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>CA Brut moins vos dettes livraison</span>
                </div>

              </div>

              {/* Solde par Agence */}
              <div style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', color: '#fff' }}>
                  Soldes par Agence ({agencesFinances.length})
                </h2>

                {agencesFinances.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    Aucune dette ou encaissement en cours avec les agences.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {agencesFinances.map(a => {
                      // Utiliser le taux propre de l'agence pour la conversion USD→CDF
                      const amountCDF = Math.round(a.soldeNet * (a.tauxConversionFC || exchangeRate));
                      const waMsg = encodeURIComponent(`Bonjour ${a.agencyName}, je vous informe que j'ai soumis une demande de versement de ${amountCDF.toLocaleString('fr-FR')} CDF (${a.soldeNet.toFixed(2)}$) via l'application MonColis. Merci de traiter ma demande.`);
                      const existingReq = vendorRequests.find(r => r.agency_id === a.agencyId && ['PENDING', 'SEEN'].includes(r.status));
                      return (
                        <div key={a.agencyId} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                              <div style={{ fontWeight: '800', color: '#fff', fontSize: '1rem' }}>{a.agencyName}</div>
                              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                                <span style={{ color: '#4ade80' }}>Dû au vendeur: {formatPrice(a.duAuVendeur)}</span>
                                <span style={{ color: '#ef4444' }}>Dettes livraison: {formatPrice(a.dettesVendeur)}</span>
                              </div>
                              {existingReq && (
                                <span style={{
                                  marginTop: '0.35rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  fontSize: '0.72rem',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '6px',
                                  background: existingReq.activeOtp ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: existingReq.activeOtp ? '#4ade80' : '#fbbf24',
                                  fontWeight: '600'
                                }}>
                                  {existingReq.activeOtp ? '🔑 OTP généré par l\'agence !' : (existingReq.status === 'SEEN' ? '👀 En cours de traitement' : '⏳ Demande envoyée')}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Solde Net</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: '900', color: a.soldeNet > 0 ? '#3b82f6' : (a.soldeNet < 0 ? '#ef4444' : '#94a3b8') }}>
                                  {formatPrice(a.soldeNet)}
                                </div>
                              </div>
                              {a.soldeNet > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {(() => {
                                    const lockInfo = getLockInfo(existingReq);
                                    const isLocked = lockInfo.locked;
                                    return (
                                      <>
                                        <button
                                          disabled={isLocked}
                                          onClick={() => {
                                            if (isLocked) return;
                                            setVendorRequestModal({ agencyId: a.agencyId, agencyName: a.agencyName, agencyPhone: a.phone || '', amount: a.soldeNet, amountCDF });
                                            setVendorRequestMessage('');
                                            setVendorRequestSuccess(null);
                                            loadVendorRequests();
                                          }}
                                          style={{
                                            padding: '0.5rem 0.9rem',
                                            borderRadius: '8px',
                                            border: isLocked ? '1px solid rgba(100,116,139,0.3)' : 'none',
                                            background: isLocked ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                            color: isLocked ? '#64748b' : '#fff',
                                            fontWeight: '700',
                                            fontSize: '0.78rem',
                                            cursor: isLocked ? 'not-allowed' : 'pointer',
                                            fontFamily: 'inherit',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.3s',
                                          }}
                                          title={lockInfo.otpMode ? 'Un code OTP a été généré, validez-le ci-dessus' : isLocked ? `Débloqué automatiquement dans ${formatCountdown(lockInfo.remainingSec)}` : ''}
                                        >
                                          {lockInfo.otpMode
                                            ? '🔑 Valider OTP ci-dessus'
                                            : isLocked
                                              ? (
                                                <>
                                                  <Lock size={12} />
                                                  Bloqué — {formatCountdown(lockInfo.remainingSec)}
                                                </>
                                              )
                                              : '💸 Demander mon argent'
                                          }
                                        </button>
                                        {isLocked && !lockInfo.otpMode && (
                                          <div style={{
                                            fontSize: '0.68rem',
                                            color: '#475569',
                                            textAlign: 'center',
                                            lineHeight: '1.3',
                                            paddingTop: '0.1rem',
                                          }}>
                                            ⏳ Demande envoyée. Déblocage auto dans {formatCountdown(lockInfo.remainingSec)}<br />
                                            <span style={{ color: '#334155' }}>ou si l'agence répond</span>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  <a
                                    href={`https://wa.me/${a.phone?.replace(/[^0-9]/g, '') || ''}?text=${waMsg}`}
                                    target="_blank" rel="noopener noreferrer"
                                    style={{ padding: '0.4rem 0.9rem', borderRadius: '8px', border: '1px solid #25D366', background: 'transparent', color: '#25D366', fontWeight: '600', fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center', whiteSpace: 'nowrap' }}
                                  >
                                    <Phone size={12} /> WhatsApp
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Detail per delivered package */}
              <div style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', color: '#fff' }}>
                  Détail par Colis Livré ({colisLivres.length})
                </h2>

                {colisLivres.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    Aucun colis livré pour le moment.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {colisLivres.map(c => {
                      const fraisVendeur = !c.paidByClient ? (c.prixLivraison || 0) : 0;
                      const netColis = c.prixColis - fraisVendeur;
                      return (
                        <div
                          key={c.id}
                          style={{
                            padding: '1rem',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem' }}>{c.clientName}</div>
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                #{c.id.substring(0, 8)} &bull; {c.date} &bull; {c.agence || 'Agence non assignée'}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: c.isPrepaid ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: c.isPrepaid ? '#60a5fa' : '#fbbf24', fontWeight: '600' }}>
                                  {c.isPrepaid ? 'Prépayé' : 'Cash Livraison'}
                                </span>
                                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: c.paidByClient ? 'rgba(168,85,247,0.15)' : 'rgba(239,68,68,0.15)', color: c.paidByClient ? '#c084fc' : '#f87171', fontWeight: '600' }}>
                                  Livraison: {c.paidByClient ? 'Client' : 'Vendeur'}
                                </span>
                                {!c.isPrepaid && (
                                  <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: c.vendorPaid ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: c.vendorPaid ? '#4ade80' : '#fbbf24', fontWeight: '600' }}>
                                    {c.vendorPaid ? 'Reversé' : 'En attente reversement'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: netColis >= 0 ? '#22c55e' : '#ef4444' }}>
                                {netColis >= 0 ? '+' : ''}{formatPrice(netColis)}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                                Marchandise: {formatPrice(c.prixColis)} − Livraison: {formatPrice(fraisVendeur)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ ONGLET 4: CLIENTS ══════════════ */}
          {activeTab === 'clients' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                  Répertoire Clients ({clients.length})
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Historique de vos acheteurs et fidélité
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {clients.map((cl, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '1.2rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #22c55e, #10b981)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontWeight: '800',
                        fontSize: '1.1rem'
                      }}>
                        {cl.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem' }}>{cl.name}</div>
                        <a href={`tel:${cl.phone}`} style={{ color: '#60a5fa', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Phone size={13} />
                          {cl.phone || 'Non renseigné'}
                        </a>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        color: '#4ade80',
                        fontSize: '0.78rem',
                        fontWeight: '700'
                      }}>
                        {cl.colis.length} commande(s)
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#fbbf24' }}>
                        {formatPrice(cl.colis.reduce((s, c) => s + c.prixColis, 0))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════ ONGLET 5: PROFIL BOUTIQUE ══════════════ */}
          {activeTab === 'profil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '640px' }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                  Profil Boutique
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Informations visibles par vos clients et agences partenaires
                </p>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '1.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #22c55e, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontWeight: '900',
                    fontSize: '1.5rem'
                  }}>
                    {profil.nom.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff', margin: 0 }}>{profil.nom}</h2>
                    <span style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: '600' }}>[OK] Vendeur Actif Vérifié</span>
                  </div>
                </div>

                {!editProfil ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Email de contact</span>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{profil.email}</div>
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Téléphone WhatsApp</span>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{profil.telephone}</div>
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Adresse du point de retrait</span>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{profil.adresse}</div>
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Description</span>
                      <div style={{ fontWeight: '500', color: '#cbd5e1', fontSize: '0.9rem' }}>{profil.description}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setProfilDraft(profil); setEditProfil(true); }}
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                    >
                      Modifier les informations
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>Nom de la boutique</label>
                      <input className="input-field" value={profilDraft.nom} onChange={e => setProfilDraft({ ...profilDraft, nom: e.target.value })} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>Email</label>
                      <input className="input-field" type="email" value={profilDraft.email} onChange={e => setProfilDraft({ ...profilDraft, email: e.target.value })} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>Téléphone</label>
                      <input className="input-field" type="tel" value={profilDraft.telephone} onChange={e => setProfilDraft({ ...profilDraft, telephone: e.target.value })} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>Adresse</label>
                      <input className="input-field" value={profilDraft.adresse} onChange={e => setProfilDraft({ ...profilDraft, adresse: e.target.value })} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>Description</label>
                      <textarea className="input-field" rows={3} value={profilDraft.description} onChange={e => setProfilDraft({ ...profilDraft, description: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setEditProfil(false)} className="btn btn-outline" style={{ flex: 1 }}>Annuler</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enregistrer</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ---------------------------------------------
          3. BOTTOM NAVIGATION BAR (Mobile App Feel)
      --------------------------------------------- */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(62px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(7, 9, 14, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        padding: '0 0.5rem',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }} className="mobile-bottom-nav">
        {tabs.map(t => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                color: isActive ? '#22c55e' : '#94a3b8',
                cursor: 'pointer',
                flex: 1,
                padding: '0.4rem 0',
                position: 'relative'
              }}
            >
              <div style={{ position: 'relative' }}>
                {t.icon}
                {t.badge && t.badge > 0 ? (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {t.badge}
                  </span>
                ) : null}
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: isActive ? '700' : '500' }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ---------------------------------------------
          4. MODAL NOUVEAU COLIS
      --------------------------------------------- */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }} className="bottom-sheet-container">
          <div style={{
            width: '100%',
            maxWidth: '560px',
            background: '#0d1117',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '24px',
            padding: '1.75rem',
            maxHeight: '92vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }} className="bottom-sheet modal-container">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', margin: 0 }}>
                  Expédier un Nouveau Colis
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
                  Génération automatique du lien de suivi & du code OTP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateColis} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Nom du Client Destinataire *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex : Amina Diallo"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Téléphone WhatsApp du Client *
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="Ex : +243 81 22 33 444"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Commune *
                  </label>
                  <CommuneSelect
                    value={clientCommune}
                    onChange={setClientCommune}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Quartier *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ex : Golf"
                    value={clientQuartier}
                    onChange={e => setClientQuartier(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Avenue *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ex : Boulevard du 30 Juin"
                    value={clientAvenue}
                    onChange={e => setClientAvenue(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Numéro *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ex : 45"
                    value={clientNumero}
                    onChange={e => setClientNumero(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Référence *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex : En face de l'immeuble Futur"
                  value={clientReference}
                  onChange={e => setClientReference(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Valeur Marchandise ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    placeholder="Ex : 25"
                    value={prixColis}
                    onChange={e => setPrixColis(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Poids estimé (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    placeholder="Ex : 2.5"
                    value={poids}
                    onChange={e => setPoids(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '0.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Qui paie les frais de livraison ? *
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#fff' }}>
                    <input
                      type="radio"
                      name="paidBy"
                      checked={paidByClient === false}
                      onChange={() => setPaidByClient(false)}
                      style={{ accentColor: '#22c55e', width: '16px', height: '16px' }}
                    />
                    Le Vendeur (Moi)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#fff' }}>
                    <input
                      type="radio"
                      name="paidBy"
                      checked={paidByClient === true}
                      onChange={() => setPaidByClient(true)}
                      style={{ accentColor: '#22c55e', width: '16px', height: '16px' }}
                    />
                    Le Client (À la réception)
                  </label>
                </div>
              </div>

              {/* Mode de Prise en Charge */}
              <div style={{ marginTop: '0.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Mode d'Expédition & Prise en Charge *
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    padding: '0.65rem 0.85rem', borderRadius: '10px',
                    background: deliveryMode === 'DIRECT' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${deliveryMode === 'DIRECT' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="deliveryMode"
                      checked={deliveryMode === 'DIRECT'}
                      onChange={() => setDeliveryMode('DIRECT')}
                      style={{ accentColor: '#22c55e', marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Truck size={14} /> Enlèvement à domicile / boutique (Standard)</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>Le coursier se déplace à votre adresse pour récupérer le colis.</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    padding: '0.65rem 0.85rem', borderRadius: '10px',
                    background: deliveryMode === 'DROP_POINT_FIRST_MILE' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${deliveryMode === 'DROP_POINT_FIRST_MILE' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="deliveryMode"
                      checked={deliveryMode === 'DROP_POINT_FIRST_MILE'}
                      onChange={() => setDeliveryMode('DROP_POINT_FIRST_MILE')}
                      style={{ accentColor: '#3b82f6', marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={14} /> Dépôt par le vendeur en Point Relais Moncolis (Recommandé)</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>Déposez le colis au point de votre commune sans attendre. Le livreur le récupère là-bas.</div>
                    </div>
                  </label>
                </div>

                {deliveryMode === 'DROP_POINT_FIRST_MILE' && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.06)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#93c5fd', marginBottom: '0.35rem' }}>
                      Sélectionnez le Point Relais de dépôt à Kinshasa :
                    </label>
                    <select
                      value={originDropPointId}
                      onChange={e => setOriginDropPointId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        background: '#0d1117',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        color: '#fff',
                        fontSize: '0.85rem'
                      }}
                    >
                      {DEFAULT_DROP_POINTS.map(dp => (
                        <option key={dp.id} value={dp.id}>
                          {dp.name} — {dp.commune} ({dp.address})
                        </option>
                      ))}
                    </select>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                      Ouvert : {DEFAULT_DROP_POINTS.find(d => d.id === originDropPointId)?.openingHours} · Contact : {DEFAULT_DROP_POINTS.find(d => d.id === originDropPointId)?.phone}
                    </p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '0.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Paiement de la Marchandise *
                </label>
                <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#fff' }}>
                    <input
                      type="radio"
                      name="isPrepaid"
                      checked={isPrepaid === false}
                      onChange={() => setIsPrepaid(false)}
                      style={{ accentColor: '#22c55e', width: '16px', height: '16px' }}
                    />
                    Paiement à la livraison (Le livreur encaisse)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#fff' }}>
                    <input
                      type="radio"
                      name="isPrepaid"
                      checked={isPrepaid === true}
                      onChange={() => setIsPrepaid(true)}
                      style={{ accentColor: '#22c55e', width: '16px', height: '16px' }}
                    />
                    Déjà payé par le client (Mobile Money, etc.)
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '1rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(34, 197, 94, 0.4)'
                }}
              >
                {isSubmitting ? 'Création en cours...' : 'Créer et Obtenir le Lien & Code OTP'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------
          4.2 MODAL SUCCÈS APRÈS CRÉATION DE COLIS
      --------------------------------------------- */}
      {createdPackage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: '1rem'
        }} className="bottom-sheet-container">
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: '#0d1117',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '24px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
          }} className="bottom-sheet">
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              margin: '0 auto',
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)'
            }}>
              <Check size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#fff', margin: '0 0 0.35rem' }}>
                Colis #{createdPackage.id} Enregistré avec Succès !
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                Voici les accès à transmettre à votre client {createdPackage.clientName}
              </p>
            </div>

            {/* Link Box */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {createdPackage.originDropPoint && (
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '10px',
                  fontSize: '0.82rem'
                }}>
                  <div style={{ color: '#93c5fd', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <MapPin size={14} /> <span>Point Relais où déposer ce colis :</span>
                  </div>
                  <div style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>
                    {createdPackage.originDropPoint.name} ({createdPackage.originDropPoint.commune})
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                    {createdPackage.originDropPoint.address}
                  </div>
                  <div style={{ color: '#38bdf8', fontSize: '0.75rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={12} /> Gérant : {createdPackage.originDropPoint.managerName} · {createdPackage.originDropPoint.phone} · Ouvert : {createdPackage.originDropPoint.openingHours}
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><LinkIcon size={12} /> Lien de suivi public (sans compte) :</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/track/${createdPackage.id}` : `/track/${createdPackage.id}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/track/${createdPackage.id}` : `https://moncolis.cd/track/${createdPackage.id}`;
                      copyToClipboard(url, 'Lien de suivi');
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      color: '#fff',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    Copier
                  </button>
                </div>
              </div>

              {/* OTP Box */}
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Lock size={12} /> Code Secret de livraison (OTP) :</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px dashed rgba(59, 130, 246, 0.4)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '4px', color: '#60a5fa' }}>
                    {createdPackage.otp}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdPackage.otp, 'Code OTP')}
                    style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      color: '#93c5fd',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    Copier OTP
                  </button>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp Share Button */}
            <button
              type="button"
              onClick={() => {
                shareOnWhatsApp(createdPackage);
              }}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
              }}
            >
              <Share2 size={18} />
              <span>Envoyer immédiatement au client par WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setCreatedPackage(null)}
              className="btn btn-outline"
              style={{ width: '100%', padding: '0.65rem' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------
          5. MODAL CHOIX AGENCE
      --------------------------------------------- */}
      {agencyModalColisId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }} className="bottom-sheet-container">
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: '#0d1117',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '24px',
            padding: '1.75rem',
            maxHeight: '85vh',
            overflowY: 'auto'
          }} className="bottom-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff', margin: 0 }}>
                Sélectionner une Agence Partenaire
              </h2>
              <button
                onClick={() => setAgencyModalColisId(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
              Choisissez une agence certifiée pour prendre en charge votre colis #{agencyModalColisId}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loadingAgencies ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Chargement des agences...</div>
              ) : agencies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                  Aucune agence partenaire enregistrée pour le moment.
                </div>
              ) : agencies.map(ag => {
                const currentPkg = colis.find(c => c.id === agencyModalColisId);
                const pkgCommune = currentPkg?.clientCommune || '';
                const pkgPoids = currentPkg?.poids || 1;
                const pkgDistance = currentPkg?.distance || 0;
                
                const pricing = ag.communePrices?.find(p => p.commune === pkgCommune);
                // Not available if: commune is set AND (no price entry OR price is 0)
                const isAvailable = pkgCommune === '' || (!!pricing && pricing.price > 0);
                
                const rate = ag.tauxConversionFC || exchangeRate || 2800;
                const basePrice = (pricing?.price || 0) / rate;
                const weightPrice = ((ag.pricePerKg || 0) * pkgPoids) / rate;
                const distancePrice = ((ag.pricePerKm || 0) * pkgDistance) / rate;
                const totalPrice = basePrice + weightPrice + distancePrice;
                
                return (
                <div
                  key={ag.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: ag.recommended ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{ag.name}</strong>
                      {ag.recommended && (
                        <span style={{ fontSize: '0.65rem', background: '#22c55e', color: '#000', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '800' }}>
                          Top Fiabilité
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={12} /> {ag.address || 'Kinshasa'} • <strong style={{ color: '#4ade80' }}>{ag.phone}</strong>
                    </div>
                    {!isAvailable && (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem', fontWeight: 'bold' }}>
                        Pas disponible pour la commune: {pkgCommune}
                      </div>
                    )}
                    {isAvailable && pricing && (
                      <div style={{ fontSize: '0.85rem', color: '#38bdf8', marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontWeight: 'bold' }}>Total estimé : {formatPrice(totalPrice)}</span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          (Base: {formatPrice(basePrice)} + Poids: {formatPrice(weightPrice)}{distancePrice > 0 ? ` + Dist: ${formatPrice(distancePrice)}` : ''})
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => isAvailable ? handleSelectAgency(agencyModalColisId!, ag.id, ag.name, totalPrice) : null}
                    disabled={!isAvailable}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      background: isAvailable ? '#22c55e' : '#475569',
                      border: 'none',
                      color: isAvailable ? '#000' : '#94a3b8',
                      fontWeight: '700',
                      fontSize: '0.85rem',
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      flexShrink: 0
                    }}
                  >
                    Confier
                  </button>
                </div>
              );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------
          6. MODAL SCAN QR POINT RELAIS (Simulation)
      --------------------------------------------- */}
      {qrScanColisId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }} className="bottom-sheet-container">
          <div style={{
            width: '100%',
            maxWidth: '500px',
            background: '#0d1117',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '24px',
            padding: '1.75rem'
          }} className="bottom-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={22} color="#3b82f6" />
                Déposer au Point Relais
              </h2>
              <button
                onClick={() => setQrScanColisId(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
              Scannez le QR Code du point relais pour attribuer le colis #{qrScanColisId}. (Simulation par sélection dans la liste)
            </p>

            <form onSubmit={handleAssignToDropPoint} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Numéro Agent (ou scan QR)</label>
                <input 
                  type="text"
                  className="input-field" 
                  value={agentNumberInput}
                  onChange={(e) => setAgentNumberInput(e.target.value)}
                  placeholder="Entrez le numéro à 9 chiffres de l'agent"
                  style={{ width: '100%', fontFamily: 'monospace', letterSpacing: '2px', fontSize: '1.1rem' }}
                  maxLength={9}
                  required
                />
              </div>

              <div className="form-group">
                <label>Choisir l'agence de livraison</label>
                <select 
                  className="input-field" 
                  value={selectedDropPointAgencyId}
                  onChange={(e) => setSelectedDropPointAgencyId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="" disabled>-- Sélectionnez une agence --</option>
                  {agencies.length === 0 ? (
                    <option value="demo-agency-01">Agence Express Kin (démo)</option>
                  ) : (
                    agencies.map(ag => (
                      <option key={ag.id} value={ag.id}>{ag.name}</option>
                    ))
                  )}
                </select>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  L'agence enverra un livreur avec un code secret pour récupérer votre colis au point relais.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setQrScanColisId(null)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Confirmer Dépôt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Responsive Styles */}
      <style jsx global>{`
        @media (min-width: 1024px) {
          .mobile-bottom-nav {
            display: none !important;
          }
          .desktop-sidebar {
            display: flex !important;
          }
          .desktop-nav {
            display: inline-flex !important;
          }
          .desktop-divider {
            display: block !important;
          }
          .modal-container {
            border-radius: 24px !important;
            margin: auto !important;
          }
        }

        @media (max-width: 1023px) {
          .desktop-sidebar {
            display: none !important;
          }
          .desktop-nav {
            display: none !important;
          }
          .desktop-divider {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Modal: Demande de versement vendeur → agence ─────────────────── */}
      {vendorRequestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: '#0f1117', borderRadius: '24px 24px 0 0', padding: '1.75rem', border: '1px solid rgba(59,130,246,0.2)' }}>
            
            {vendorRequestSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                <h3 style={{ margin: '0 0 0.4rem', color: '#3b82f6' }}>Demande envoyée !</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>{vendorRequestSuccess}</p>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                  L'agence recevra une notification. Vous pouvez aussi les contacter via WhatsApp.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <a
                    href={`https://wa.me/${vendorRequestModal.agencyPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour ${vendorRequestModal.agencyName}, je viens de soumettre une demande de versement de ${vendorRequestModal.amountCDF.toLocaleString('fr-FR')} CDF via MonColis. Merci de la traiter.`)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: '1px solid #25D366', color: '#25D366', fontWeight: '700', fontSize: '0.82rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Phone size={14} /> Contacter via WhatsApp
                  </a>
                  <button onClick={() => setVendorRequestModal(null)} style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>💸 Demander mon argent</h2>
                  <button onClick={() => setVendorRequestModal(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
                </div>

                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Vous demandez le versement de votre solde auprès de <strong style={{ color: '#fff' }}>{vendorRequestModal.agencyName}</strong>.<br />
                  L'agence recevra une notification et vous contactera.
                </p>

                {/* Montant mis en évidence */}
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '14px', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Montant à recevoir</p>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '1.9rem', fontWeight: '900', color: '#3b82f6' }}>
                    {vendorRequestModal.amountCDF.toLocaleString('fr-FR')} CDF
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    ≈ {vendorRequestModal.amount.toFixed(2)} USD
                  </p>
                </div>

                {/* Message optionnel */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Message pour l'agence (optionnel)</label>
                  <textarea
                    value={vendorRequestMessage}
                    onChange={e => setVendorRequestMessage(e.target.value)}
                    placeholder="Ex: Versement urgent, colis livrés cette semaine..."
                    rows={2}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setVendorRequestModal(null)} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annuler
                  </button>
                  <button
                    disabled={vendorRequestLoading}
                    onClick={async () => {
                      setVendorRequestLoading(true);
                      try {
                        const res = await fetch('/api/vendor/payments/request', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            agencyId: vendorRequestModal!.agencyId,
                            amount: vendorRequestModal!.amountCDF,
                            message: vendorRequestMessage || undefined,
                          }),
                        });
                        const json = await res.json();
                        if (res.ok) {
                          setVendorRequestSuccess(`Demande de ${vendorRequestModal!.amountCDF.toLocaleString('fr-FR')} CDF envoyée à ${vendorRequestModal!.agencyName} !`);
                          loadVendorRequests();
                        } else {
                          alert(json.error || 'Erreur lors de l\'envoi.');
                        }
                      } catch { alert('Erreur réseau.'); }
                      finally { setVendorRequestLoading(false); }
                    }}
                    style={{ flex: 2, padding: '0.7rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: '700', cursor: vendorRequestLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: vendorRequestLoading ? 0.7 : 1 }}
                  >
                    {vendorRequestLoading ? 'Envoi...' : '💸 Envoyer la demande'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

/* ---------------------------------------------
   Composant Card Colis avec Zone Lien & Code Suivi
--------------------------------------------- */
function PackageCard({
  colis,
  onSelectAgency,
  onAssignToDropPoint,
  onCopyText,
  onShareWhatsApp
}: {
  colis: Colis;
  onSelectAgency: () => void;
  onAssignToDropPoint: () => void;
  onCopyText: (text: string, label: string) => void;
  onShareWhatsApp: () => void;
}) {
  const { formatPrice } = useCurrency();
  const isDelivered = colis.status === 'Livré';
  const trackUrl = typeof window !== 'undefined' ? `${window.location.origin}/track/${colis.id}` : `https://moncolis.cd/track/${colis.id}`;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: isDelivered ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '18px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.9rem',
      backdropFilter: 'blur(10px)'
    }}>
      {/* Top Header Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
              {colis.clientName}
            </span>
            <span style={{
              fontSize: '0.75rem',
              color: '#4ade80',
              fontWeight: '700',
              background: 'rgba(34, 197, 94, 0.1)',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px'
            }}>
              #{colis.id}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            {colis.date} • Code : {colis.trackingCode}
          </div>
        </div>

        <span style={{
          padding: '0.25rem 0.65rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: '700',
          background: `${STATUS_COLOR[colis.status] || '#22c55e'}22`,
          color: STATUS_COLOR[colis.status] || '#22c55e',
          border: `1px solid ${STATUS_COLOR[colis.status] || '#22c55e'}44`,
          flexShrink: 0
        }}>
          {isDelivered ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle2 size={12} /> Livré</span> : colis.status}
        </span>
      </div>

      {/* Address and Phone */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
          <MapPin size={14} color="#60a5fa" style={{ marginTop: '2px', flexShrink: 0 }} />
          <span>{colis.clientAddress}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Phone size={14} color="#22c55e" />
          <a href={`tel:${colis.clientPhone}`} style={{ color: '#4ade80', fontWeight: '600' }}>
            {colis.clientPhone}
          </a>
        </div>
      </div>

      {/* Financial info pills */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.5rem',
        padding: '0.65rem',
        borderRadius: '12px',
        background: 'rgba(0, 0, 0, 0.3)'
      }}>
        <div>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Prix Marchandise :</span>
          <strong style={{ color: '#4ade80', fontSize: '0.95rem' }}>{formatPrice(colis.prixColis)}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Frais Livraison :</span>
          <strong style={{ color: colis.prixLivraison ? '#fbbf24' : '#94a3b8', fontSize: '0.95rem' }}>
            {colis.prixLivraison ? formatPrice(colis.prixLivraison) : 'En attente'}
          </strong>
        </div>
      </div>

      {/* -- SECTION SPÉCIALE : LIEN DE SUIVI & CODE OTP -- */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.05)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '14px',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {/* Row 1: Tracking Link */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <LinkIcon size={14} color="#60a5fa" />
            <span style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: '700' }}>
              Lien de suivi client :
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => onCopyText(trackUrl, 'Lien de suivi')}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <Copy size={12} />
              <span>Copier le lien</span>
            </button>

            <Link
              href={`/track/${colis.id}`}
              target="_blank"
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontSize: '0.75rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={12} />
              <span>Ouvrir</span>
            </Link>
          </div>
        </div>

        {/* Row 2: Code OTP & WhatsApp Share */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px dashed rgba(59, 130, 246, 0.2)',
          paddingTop: '0.65rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Code Secret OTP :</span>
            <span style={{ fontSize: '1.35rem', fontWeight: '900', letterSpacing: '3px', color: '#3b82f6' }}>
              {colis.otp}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => onCopyText(colis.otp, 'Code OTP')}
              style={{
                padding: '0.4rem 0.65rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <Copy size={13} />
              <span>Copier OTP</span>
            </button>

            <button
              type="button"
              onClick={onShareWhatsApp}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.18)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Share2 size={13} />
              <span>Envoyer WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Agency selection or assigned agency badge */}
      {(!colis.agence && !colis.originDropPointId) || ['Annulé', 'Refusé'].includes(colis.status) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {['Créé', 'Annulé', 'Refusé'].includes(colis.status) && (
            <button
              type="button"
              onClick={onAssignToDropPoint}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#93c5fd',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s ease'
              }}
            >
              <MapPin size={16} />
              <span>Déposer au Point Relais (Scan QR)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSelectAgency}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#cbd5e1',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Truck size={16} />
            <span>Remettre directement à une Agence</span>
          </button>
        </div>
      ) : colis.originDropPointId && colis.status === 'En attente de confirmation relais' ? (
        <div style={{
          padding: '0.75rem',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px dashed rgba(59, 130, 246, 0.3)',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#93c5fd',
          fontSize: '0.85rem',
          fontWeight: '600'
        }}>
          En attente de confirmation par le Point Relais
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          fontSize: '0.8rem',
          padding: '0.75rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>Agence : <strong style={{ color: '#4ade80' }}>{colis.agence}</strong></span>
            {colis.livreur && (
              <span style={{ color: '#60a5fa', fontWeight: '600' }}>
                Livreur : {colis.livreur} {colis.livreurPhone ? `(${colis.livreurPhone})` : ''}
              </span>
            )}
          </div>
          {colis.livreur && isDelivered && (
            <button 
              onClick={() => alert(`Merci d'avoir évalué le livreur ${colis.livreur} ! Cette fonctionnalité sera sauvegardée dans la prochaine mise à jour.`)}
              style={{
                marginTop: '0.25rem',
                alignSelf: 'flex-end',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Star size={14} /> Évaluer ce livreur</span>
            </button>
          )}
        </div>
      )}


    </div>
  );
}
