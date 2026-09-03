'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Truck, ClipboardList, Star, Settings, CheckCircle, XCircle, Clock, Copy, Check, KeyRound, LogOut, DollarSign } from 'lucide-react';
import { useAuth } from '@/lib/use-auth';

// ─── Types ─────────────────────────────────────────────────────────────────
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
  quotation?: Quotation | null;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────
const SEED_LIVREURS: Livreur[] = [
  { id: 'L1', name: 'Patrick Makiese', phone: '+243 81 44 55 660', pinCode: '1234', vehicle: 'Moto Honda 150', available: true,  deliveries: 142, rating: 4.9, joinedDate: '2026-01-15' },
  { id: 'L2', name: 'Alain Kabongo',   phone: '+243 89 22 11 003', pinCode: '5678', vehicle: 'Van Toyota HiAce', available: true, deliveries:  88, rating: 4.8, joinedDate: '2026-02-10' },
  { id: 'L3', name: 'Joel Tshimanga',  phone: '+243 99 33 44 551', pinCode: '9900', vehicle: 'Moto Boxer', available: false, deliveries:  64, rating: 4.6, joinedDate: '2026-03-01' },
];

const SEED_COLIS: Colis[] = [
  { id: 'COL-1029', trackId: 'abc123', clientName: 'Alice Dubois',     clientAddress: '15 Boulevard du 30 Juin, Gombe', clientPhone: '+243 82 10 11 123', status: 'En attente', vendeur: 'Boutique Express', vendeurId: 'V1', driverId: null, date: '2026-07-02', otp: '847291', prixColis: 10, prixLivraison: null, distanceKm: 12, poids: 2.5, paidByClient: true, vendorPaid: false },
  { id: 'COL-1028', trackId: 'def456', clientName: 'Jean-Pierre',      clientAddress: 'Quartier Industriel, Limete',    clientPhone: '+243 81 20 21 224', status: 'Livré',     vendeur: 'Mode & Co',        vendeurId: 'V2', driverId: 'L1', date: '2026-07-01', otp: '192837', prixColis: 5, prixLivraison: 2, distanceKm: 8,  poids: 1.2, quotation: { basePrice: 1, commune: 'Limete', distanceTotal: 8, distancePrice: 0.5, weightTotal: 1.2, weightPrice: 0.5, totalFinale: 2}, paidByClient: true, vendorPaid: false },
  { id: 'COL-1027', trackId: 'ghi789', terminal: 'Fatou Diallo',       clientAddress: 'Rond-Point Ngaba, Lemba',        clientPhone: '+243 90 30 31 325', status: 'En transit', vendeur: 'Boutique Express', vendeurId: 'V1', driverId: 'L3', date: '2026-06-30', otp: '563821', prixColis: 15, prixLivraison: 3, distanceKm: 18, poids: 4.0, paidByClient: true, vendorPaid: false } as any,
  { id: 'COL-1025', trackId: 'mno345', clientName: 'Amira Saidani',    clientAddress: 'Macampagne, Ngaliema',           clientPhone: '+243 89 50 51 526', status: 'Refusé',    vendeur: 'Mode & Co',        vendeurId: 'V2', driverId: null, date: '2026-06-28', otp: '019283', prixColis: 20, prixLivraison: null, distanceKm: 5,  poids: 10.0, paidByClient: true, vendorPaid: false },
];

// ─── Status colors ──────────────────────────────────────────────────────────
const statusStyle: Record<string, string> = {
  'En attente': '#f59e0b',
  'Accepté':    '#3b82f6',
  'Refusé':     '#ef4444',
  'Assigné':    '#8b5cf6',
  'En transit': '#06b6d4',
  'Livré':      '#10b981',
  'Annulé':     '#6b7280',
};

// ─── Sub-components ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
export default function AgenceDashboard() {
  const { user, loading: authLoading, logout } = useAuth('agence');
  const [activeTab, setActiveTab] = useState<'demandes' | 'livreurs' | 'historique' | 'vendeurs' | 'parametres' | 'finances'>('demandes');
  const [colis, setColis]         = useState<Colis[]>(SEED_COLIS);
  const [livreurs, setLivreurs]   = useState<Livreur[]>(SEED_LIVREURS);

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
            vendeurId: p.id,
            driverId: p.driverId || null,
            date: p.date,
            otp: p.otp,
            prixColis: p.prixColis,
            prixLivraison: p.prixLivraison || null,
            distanceKm: p.distance || 0,
            poids: p.poids || 1,
            paidByClient: p.paidByClient,
            vendorPaid: p.vendorPaid,
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

        unsubscribe = dataService.subscribeToPackages(() => {
          loadLiveData();
        });
      } catch (err) {
        console.error('Error loading live data:', err);
      }
    }

    loadLiveData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.agencyId]);



  // Livreur modal
  const [showAddLivreur, setShowAddLivreur] = useState(false);
  const [newName, setNewName]     = useState('');
  const [newPhone, setNewPhone]   = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newPin, setNewPin]       = useState('');
  const [createdDriver, setCreatedDriver] = useState<{ name: string; pin: string; phone: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Formulaire de calcul tarifaire (Devis / Quotation)
  const [quotations, setQuotations] = useState<Record<string, Quotation>>({});
  
  // Paramètres de prix modifiables par l'agence (pour un colis spécifique en cours d'édition)
  const [pricingParams, setPricingParams] = useState<Record<string, { commune: string, basePrice: number, pricePerKm: number, pricePerKg: number }>>({});

  const [globalSettings, setGlobalSettings] = useState({
    defaultPricePerKm: 0.5,
    defaultPricePerKg: 0.2,
    tauxConversionFC: 2850,
    communes: [
      { name: 'Gombe', base: 1 },
      { name: 'Limete', base: 1.5 },
      { name: 'Lemba', base: 1 },
      { name: 'Bandalungwa', base: 0.8 },
      { name: 'Ngaliema', base: 1.5 },
      { name: 'Kintambo', base: 2 },
      { name: 'Matete', base: 1 },
    ]
  });

  // Historique filters
  const [filterStatus, setFilterStatus]   = useState('Tous');
  const [filterVendeur, setFilterVendeur] = useState('Tous');

  // ── Derived data ──────────────────────────────────────────────────────────
  const demandes   = colis.filter(c => c.status === 'En attente' || c.status === 'Accepté');
  const historique = colis.filter(c => !['En attente', 'Accepté'].includes(c.status));

  const filteredHistorique = useMemo(() => {
    return historique.filter(c => {
      const matchStatus  = filterStatus  === 'Tous' || c.status  === filterStatus;
      const matchVendeur = filterVendeur === 'Tous' || c.vendeur === filterVendeur;
      return matchStatus && matchVendeur;
    });
  }, [historique, filterStatus, filterVendeur]);

  const uniqueVendeurs = useMemo(() => [...new Set(colis.map(c => c.vendeur))], [colis]);

  const vendeurStats = useMemo(() => {
    const map: Record<string, { name: string; total: number; livres: number; lastDate: string; revenu: number }> = {};
    colis.forEach(c => {
      if (!map[c.vendeurId]) map[c.vendeurId] = { name: c.vendeur, total: 0, livres: 0, lastDate: c.date, revenu: 0 };
      map[c.vendeurId].total++;
      if (c.status === 'Livré') {
        map[c.vendeurId].livres++;
        map[c.vendeurId].revenu += c.prixLivraison ?? 0;
      }
      if (c.date > map[c.vendeurId].lastDate) map[c.vendeurId].lastDate = c.date;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [colis]);

  const totalLivres   = colis.filter(c => c.status === 'Livré').length;
  const totalEnCours  = colis.filter(c => ['Assigné', 'En transit', 'Accepté', 'En attente'].includes(c.status)).length;
  const tauxLivraison = colis.length > 0 ? Math.round((totalLivres / colis.length) * 100) : 0;
  const revenuAgence  = colis.filter(c => c.status === 'Livré').reduce((s, c) => s + (c.prixLivraison ?? 0), 0);

  // ── Handlers ─────────────────────────────────────────────────────────────
  
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
  
  const updateQuotation = (id: string, basePrice: number, pricePerKm: number, distanceKm: number, pricePerKg: number, poids: number, communeName: string) => {
    const distancePrice = distanceKm * pricePerKm;
    const weightPrice = poids * pricePerKg;
    const totalFinale = basePrice + distancePrice + weightPrice;
    
    setQuotations(prev => ({
      ...prev,
      [id]: {
        basePrice, commune: communeName,
        distanceTotal: distanceKm, distancePrice, 
        weightTotal: poids, weightPrice,
        totalFinale
      }
    }));
  };

  const handleAction = async (c: Colis, action: 'accept' | 'reject') => {
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
    }
  };

  const assignDriver = async (colisId: string, driverId: string) => {
    try {
      const { dataService } = await import('@/lib/data-service');
      await dataService.assignDriver(colisId, driverId);
      setColis(prev => prev.map(c => c.id === colisId ? { ...c, status: 'Assigné', driverId } : c));
    } catch (e) {
      console.error(e);
      alert("Impossible d'assigner le livreur.");
    }
  };

  const toggleAvailable = (id: string) => {
    setLivreurs(prev => prev.map(l => l.id === id ? { ...l, available: !l.available } : l));
  };

  const handleAddLivreur = async (e: React.FormEvent) => {
    e.preventDefault();
    // Generate a 4-digit PIN if not provided
    const pin = newPin.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    const newL: Livreur = {
      id: `L${Date.now()}`,
      name: newName,
      phone: newPhone,
      pinCode: pin,
      vehicle: newVehicle || 'Moto',
      available: true,
      deliveries: 0,
      rating: 5.0,
      joinedDate: new Date().toISOString().split('T')[0],
    };
    setLivreurs(prev => [newL, ...prev]);
    // Also register in dataService so the livreur can log in
    try {
      const { dataService } = await import('@/lib/data-service');
      const savedDriver = await dataService.addDriver(user!.agencyId!, { name: newName, phone: newPhone, vehicle: newVehicle, available: true, pinCode: pin });
      // Replace the optimistic local entry with the real DB id
      setLivreurs(prev => prev.map(l => l.name === newName && l.phone === newPhone ? { ...l, id: savedDriver.id } : l));
    } catch (e) {
      console.error('Failed to save driver to DB:', e);
    }
    setCreatedDriver({ name: newName, pin, phone: newPhone });
    setNewName(''); setNewPhone(''); setNewVehicle(''); setNewPin('');
    setShowAddLivreur(false);
  };

  const removeLivreur = (id: string) => setLivreurs(prev => prev.filter(l => l.id !== id));

  const getDriverName = (driverId: string | null) =>
    driverId ? livreurs.find(l => l.id === driverId)?.name ?? '—' : '—';

  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'demandes',   icon: <Bell size={20} />, label: 'Demandes', badge: demandes.length },
    { key: 'livreurs',   icon: <Truck size={20} />, label: 'Flotte', badge: livreurs.length },
    { key: 'historique', icon: <ClipboardList size={20} />, label: 'Historique' },
    { key: 'finances',   icon: <DollarSign size={20} />, label: 'Finances' },
    { key: 'vendeurs',   icon: <Star size={20} />, label: 'Fidélité' },
    { key: 'parametres', icon: <Settings size={20} />, label: 'Paramètres' },
  ];

  // ── Garde : session en cours de vérification
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
          <p>Vérification de la session...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* ── TAB: Demandes ─────────────────────────────────────────────────── */}
      {activeTab === 'demandes' && (
        <div className="animate-fade-in">
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>Demandes en attente / acceptées</h2>
          {demandes.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>
              Aucune demande en cours.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {demandes.map(c => {
                const qParams = pricingParams[c.id];
                const q = quotations[c.id];
                
                return (
                  <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '1.05rem', display: 'block' }}>{c.id} — par <span style={{ color: 'var(--accent)' }}>{c.vendeur}</span></strong>
                        <span style={{ opacity: 0.7, fontSize: '0.875rem' }}>{c.clientName} · {c.clientAddress} · {c.clientPhone}</span>
                      </div>
                      <span style={{ background: statusStyle[c.status], color: 'white', padding: '0.3rem 0.9rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.82rem', flexShrink: 0 }}>
                        {c.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', opacity: 0.8, fontSize: '0.875rem', flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>Poids: {c.poids} kg</span>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>Distance: {c.distanceKm} km</span>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '8px', color: '#22c55e', fontWeight: 'bold' }}>Valeur colis: {c.prixColis.toLocaleString('fr-FR')} USD ({Math.round(c.prixColis * globalSettings.tauxConversionFC).toLocaleString('fr-FR')} FC)</span>
                    </div>

                    {/* Formulaire de Cotation — uniquement si En attente */}
                    {c.status === 'En attente' && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem' }}>
                        {c.paidByClient === false ? (
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem', color: '#10b981' }}>Frais de livraison à la charge du Vendeur</p>
                            <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '1.5rem' }}>
                              L'agence ne fixe pas les frais pour ce colis. Le règlement se fera avec le vendeur.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                              <button className="btn btn-primary" style={{ padding: '0.7rem 1.5rem' }} onClick={() => handleAction(c, 'accept')}>
                                Accepter le Colis
                              </button>
                              <button className="btn btn-outline" style={{ padding: '0.7rem 1.5rem', borderColor: 'var(--error)', color: 'var(--error)' }} onClick={() => handleAction(c, 'reject')}>
                                Refuser
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent)' }}>Établir le devis détaillé</p>

                            {!qParams ? (
                              <button className="btn btn-primary" onClick={() => initPricing(c.id, 'Cocody', c.distanceKm, c.poids)}>
                                Démarrer le calculateur
                              </button>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {/* Commune */}
                                <div>
                                   <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Commune de destination</label>
                                   <select 
                                    className="input-field" 
                                    value={qParams.commune} 
                                    onChange={e => {
                                      const commune = globalSettings.communes.find(co => co.name === e.target.value) || globalSettings.communes[0];
                                      setPricingParams(prev => ({...prev, [c.id]: { ...qParams, commune: commune.name, basePrice: commune.base }}));
                                      updateQuotation(c.id, commune.base, qParams.pricePerKm, c.distanceKm, qParams.pricePerKg, c.poids, commune.name);
                                    }}>
                                     {globalSettings.communes.map(co => <option key={co.name} value={co.name}>{co.name} (Base: {co.base} USD)</option>)}
                                   </select>
                                </div>

                                {/* Prix par km */}
                                <div>
                                   <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Tarif par Km (USD)</label>
                                   <input type="number" className="input-field" value={qParams.pricePerKm} 
                                     onChange={e => {
                                       const val = parseFloat(e.target.value) || 0;
                                       setPricingParams(prev => ({...prev, [c.id]: { ...qParams, pricePerKm: val }}));
                                       updateQuotation(c.id, qParams.basePrice, val, c.distanceKm, qParams.pricePerKg, c.poids, qParams.commune);
                                     }} 
                                   />
                                </div>
                                
                                {/* Prix par kg */}
                                <div>
                                   <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Tarif par Kg (USD)</label>
                                   <input type="number" className="input-field" value={qParams.pricePerKg} 
                                     onChange={e => {
                                       const val = parseFloat(e.target.value) || 0;
                                       setPricingParams(prev => ({...prev, [c.id]: { ...qParams, pricePerKg: val }}));
                                       updateQuotation(c.id, qParams.basePrice, qParams.pricePerKm, c.distanceKm, val, c.poids, qParams.commune);
                                     }} 
                                   />
                                </div>
                              </div>
                            )}

                            {/* Devis Résultat */}
                            {q && (
                              <div style={{ marginTop: '1.5rem', background: 'rgba(245,158,11,0.08)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(245,158,11,0.2)' }}>
                                <p style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', color: '#f59e0b' }}>Récapitulatif envoyé au vendeur</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ opacity: 0.8 }}>Base ({q.commune})</span>
                                    <strong>{q.basePrice.toLocaleString('fr-FR')} USD</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ opacity: 0.8 }}>Distance ({q.distanceTotal} km × {qParams.pricePerKm})</span>
                                    <strong>{q.distancePrice.toLocaleString('fr-FR')} USD</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ opacity: 0.8 }}>Poids ({q.weightTotal} kg × {qParams.pricePerKg})</span>
                                    <strong>{q.weightPrice.toLocaleString('fr-FR')} USD</strong>
                                  </div>
                                  <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.2)', margin: '0.5rem 0' }} />
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: '#f59e0b', fontWeight: '800' }}>
                                    <span>TOTAL LIVRAISON</span>
                                    <span>{q.totalFinale.toLocaleString('fr-FR')} USD ({Math.round(q.totalFinale * globalSettings.tauxConversionFC).toLocaleString('fr-FR')} FC)</span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                                  <button className="btn btn-primary" style={{ flex: 1, padding: '0.7rem' }} onClick={() => handleAction(c, 'accept')}>
                                    Accepter & Envoyer le Devis
                                  </button>
                                  <button className="btn btn-outline" style={{ flex: 1, padding: '0.7rem', borderColor: 'var(--error)', color: 'var(--error)' }} onClick={() => handleAction(c, 'reject')}>
                                    Refuser
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Assignation livreur — uniquement si Accepté */}
                    {c.status === 'Accepté' && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                        <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Assigner un livreur :</p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {livreurs.filter(l => l.available).map(l => (
                            <button key={l.id} className="btn btn-outline" style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }} onClick={() => assignDriver(c.id, l.id)}>
                              {l.name}
                            </button>
                          ))}
                          {livreurs.filter(l => l.available).length === 0 && (
                            <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>Aucun livreur disponible.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Livreurs ─────────────────────────────────────────────────── */}
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
                <p style={{ fontWeight: '800', color: '#4ade80', margin: '0 0 0.2rem' }}>✅ Livreur {createdDriver.name} ajouté !</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                  Transmettez ces identifiants de connexion à votre livreur :
                </p>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem' }}>📱 <strong style={{ color: '#fff' }}>{createdDriver.phone}</strong></span>
                  <span style={{ fontSize: '0.85rem' }}>🔐 Code PIN : <strong style={{ color: '#fbbf24', fontSize: '1.1rem', letterSpacing: '3px' }}>{createdDriver.pin}</strong></span>
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
                    {l.vehicle && <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>🚗 {l.vehicle}</span>}
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

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => toggleAvailable(l.id)} className="btn btn-outline" style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', borderColor: l.available ? '#6b7280' : '#10b981', color: l.available ? '#6b7280' : '#10b981' }}>
                    {l.available ? 'Marquer indispo' : 'Marquer dispo'}
                  </button>
                  <button onClick={() => removeLivreur(l.id)} style={{ padding: '0.45rem 0.75rem', borderRadius: '9999px', border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', transition: 'all 0.2s' }}>
                    Retirer
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

      {/* ── TAB: Historique ───────────────────────────────────────────────── */}
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

      {/* ── TAB: Vendeurs Fidèles ─────────────────────────────────────────── */}
      {activeTab === 'vendeurs' && (
        <div className="animate-fade-in">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Vendeurs Fidèles</h2>
          <p style={{ opacity: 0.6, marginBottom: '1.5rem', fontSize: '0.9rem' }}>Classement par volume de colis confie a votre agence.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {vendeurStats.map((v, i) => {
              const tx = v.total > 0 ? Math.round((v.livres / v.total) * 100) : 0;
              const medalColors = ['#f59e0b', '#9ca3af', '#cd7f32'];
              return (
                <div key={v.name} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: i < 3 ? medalColors[i] : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem', flexShrink: 0, color: i < 3 ? '#000' : 'rgba(255,255,255,0.5)' }}>
                    #{i + 1}
                  </div>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.2rem', flexShrink: 0 }}>
                    {v.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <strong style={{ fontSize: '1.05rem', display: 'block' }}>{v.name}</strong>
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

      {/* ── TAB: Finances ─────────────────────────────────────────────── */}
      {activeTab === 'finances' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Portefeuille & Reversements</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <StatCard 
              label="À reverser aux vendeurs" 
              value={`${colis.filter(c => c.status === 'Livré' && c.paidByClient && !c.vendorPaid).reduce((acc, c) => acc + c.prixColis, 0)} $`}
              sub="Montant total en attente"
              color="#f59e0b"
            />
            <StatCard 
              label="Déjà reversé" 
              value={`${colis.filter(c => c.status === 'Livré' && c.paidByClient && c.vendorPaid).reduce((acc, c) => acc + c.prixColis, 0)} $`}
              sub="Historique des paiements"
              color="#10b981"
            />
          </div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Colis Livrés (Argent collecté à reverser)</h3>
          
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
                          ✓ Reversé
                        </span>
                      ) : (
                        <button 
                          className="btn btn-primary"
                          onClick={async () => {
                            try {
                              const { dataService } = await import('@/lib/data-service');
                              await dataService.payVendor(c.id);
                              setColis(prev => prev.map(col => col.id === c.id ? { ...col, vendorPaid: true } : col));
                            } catch (e) {
                              console.error(e);
                              alert("Erreur lors du paiement");
                            }
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
        </div>
      )}

      {/* ── TAB: Paramètres ─────────────────────────────────────────────── */}
      {activeTab === 'parametres' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
          
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>Tarification de base par Commune</h3>
            <p style={{ opacity: 0.7, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Ces valeurs seront utilisées par défaut lors de l'établissement d'un devis pour un colis. Vous pourrez toujours les ajuster manuellement pour chaque colis. Les historiques existants ne seront pas impactés par cette modification.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {globalSettings.communes.map((commune, index) => (
                <div key={commune.name}>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', opacity: 0.8 }}>{commune.name}</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <input 
                      type="number" className="input-field" style={{ border: 'none', background: 'transparent', width: '100%' }}
                      value={commune.base} 
                      onChange={e => {
                        const newCommunes = [...globalSettings.communes];
                        newCommunes[index].base = parseFloat(e.target.value) || 0;
                        setGlobalSettings(prev => ({ ...prev, communes: newCommunes }));
                      }}
                    />
                    <span style={{ padding: '0 1rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold' }}>USD</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>Suppléments (Km / Poids)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', opacity: 0.8 }}>Tarif Standard Poids (USD par Kg)</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <input 
                      type="number" className="input-field" style={{ border: 'none', background: 'transparent', width: '100%' }}
                      value={globalSettings.defaultPricePerKg} 
                      onChange={e => setGlobalSettings(prev => ({ ...prev, defaultPricePerKg: parseFloat(e.target.value) || 0 }))}
                    />
                    <span style={{ padding: '0 1rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold' }}>/ kg</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', opacity: 0.8 }}>Tarif Standard Distance (USD par Km)</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <input 
                      type="number" className="input-field" style={{ border: 'none', background: 'transparent', width: '100%' }}
                      value={globalSettings.defaultPricePerKm} 
                      onChange={e => setGlobalSettings(prev => ({ ...prev, defaultPricePerKm: parseFloat(e.target.value) || 0 }))}
                    />
                    <span style={{ padding: '0 1rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold' }}>/ km</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>Taux de change</h3>
            <p style={{ opacity: 0.7, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Définissez le taux de change applicable par votre agence. Ce montant ne peut pas dépasser le plafond défini par l'administrateur de Moncolis.
            </p>
            <div style={{ maxWidth: '300px' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', opacity: 0.8 }}>Taux Franc Congolais (FC pour 1 USD)</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <input 
                    type="number" className="input-field" style={{ border: 'none', background: 'transparent', width: '100%' }}
                    value={globalSettings.tauxConversionFC} 
                    onChange={e => {
                      // Simulating admin limit check
                      let val = parseInt(e.target.value) || 0;
                      if (val > 2900) {
                        alert("Le taux ne peut pas dépasser le plafond fixé par l'administrateur (2900 FC).");
                        val = 2900;
                      }
                      setGlobalSettings(prev => ({ ...prev, tauxConversionFC: val }));
                    }}
                  />
                  <span style={{ padding: '0 1rem', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold' }}>FC</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
              Sauvegarder les paramètres
            </button>
          </div>
        </div>
      )}

      </main>

      {/* ── Modal: Ajouter un livreur ────────────────────────────────────── */}
      {showAddLivreur && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
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
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', opacity: 0.8 }}>Véhicule</label>
                <input placeholder="Ex : Moto Honda 150, Van Toyota..." className="input-field" value={newVehicle} onChange={e => setNewVehicle(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', opacity: 0.8 }}>
                  🔐 Code PIN de connexion (4 chiffres)
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
    </div>
  );
}
