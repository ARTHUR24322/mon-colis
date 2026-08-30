'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, History, DollarSign, CheckSquare, Users, User, ArrowRight, Truck, Scale, Ruler, MapPin } from 'lucide-react';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface Colis {
  id: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  prixColis: number;
  prixLivraison: number | null;
  status: 'Créé' | 'En attente d\'agence' | 'En transit' | 'Livré' | 'Annulé';
  agence: string | null;
  otp: string;
  date: string;
  confirmed: boolean;
  // Caractéristiques physiques
  poids: number;          // kg
  longueur: number;       // cm
  largeur: number;        // cm
  hauteur: number;        // cm
  distance: number;       // km
}

/* ─────────────────────────────────────────────
   Données de démonstration
───────────────────────────────────────────── */
const DEMO_COLIS: Colis[] = [
  { id: 'c1', clientName: 'Amina Diallo',    clientPhone: '+243 81 11 22 334', clientAddress: 'Boulevard du 30 Juin, Gombe',       prixColis: 15, prixLivraison: 2, status: 'Livré',                agence: 'Express Delivery',   otp: '847392', date: '28/06/2026', confirmed: true,  poids: 2.5,  longueur: 35, largeur: 25, hauteur: 20, distance: 12 },
  { id: 'c2', clientName: 'Kofi Mensah',     clientPhone: '+243 99 44 55 667', clientAddress: 'Avenue de la Paix, Limete',         prixColis: 8,  prixLivraison: 1, status: 'En transit',            agence: 'Mondial Logistique', otp: '391047', date: '30/06/2026', confirmed: false, poids: 1.2,  longueur: 30, largeur: 20, hauteur: 15, distance: 8  },
  { id: 'c3', clientName: 'Fatou Coulibaly', clientPhone: '+243 89 77 88 990', clientAddress: 'Quartier Macampagne, Ngaliema',     prixColis: 25, prixLivraison: null, status: 'En attente d\'agence', agence: null,                 otp: '562810', date: '01/07/2026', confirmed: false, poids: 15.0, longueur: 60, largeur: 40, hauteur: 35, distance: 22 },
  { id: 'c4', clientName: 'Yao Kouamé',      clientPhone: '+243 82 33 44 551', clientAddress: 'Rond-Point Victoire, Kasa-Vubu',    prixColis: 5,  prixLivraison: 1, status: 'Livré',                agence: 'Express Delivery',   otp: '203947', date: '25/06/2026', confirmed: true,  poids: 0.8,  longueur: 20, largeur: 15, hauteur: 10, distance: 5  },
  { id: 'c5', clientName: 'Marie Traoré',    clientPhone: '+243 90 66 77 882', clientAddress: 'Quartier Salongo, Lemba',           prixColis: 12, prixLivraison: 1.5, status: 'Livré',                agence: 'Chronopost Local',   otp: '748203', date: '22/06/2026', confirmed: true,  poids: 4.0,  longueur: 45, largeur: 30, hauteur: 25, distance: 15 },
  { id: 'c6', clientName: 'Seydou Bamba',    clientPhone: '+243 85 99 00 113', clientAddress: 'Bandalungwa',                       prixColis: 4,  prixLivraison: 0.5, status: 'Annulé',               agence: 'Relais Colis Pro',   otp: '109384', date: '20/06/2026', confirmed: false, poids: 0.5,  longueur: 15, largeur: 10, hauteur: 8,  distance: 3  },
];

const AGENCES_LIST = [
  { id: '1', name: 'Express Delivery',    recommended: true,  score: 98, price: '1.5 USD' },
  { id: '2', name: 'Mondial Logistique', recommended: true,  score: 95, price: '1 USD' },
  { id: '3', name: 'Chronopost Local',   recommended: false, score: 88, price: '2 USD' },
  { id: '4', name: 'Relais Colis Pro',   recommended: false, score: 76, price: '0.8 USD' },
];

type Tab = 'apercu' | 'historique' | 'revenus' | 'confirmations' | 'clients' | 'profil';

const STATUS_COLOR: Record<string, string> = {
  'Livré': '#22c55e',
  'En transit': '#3b82f6',
  "En attente d'agence": '#f59e0b',
  'Créé': '#a855f7',
  'Annulé': '#ef4444',
};

/* ─────────────────────────────────────────────
   Composant principal
───────────────────────────────────────────── */
export default function VendeurDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('apercu');
  const [colis, setColis] = useState<Colis[]>(DEMO_COLIS);
  const [showModal, setShowModal]  = useState(false);
  const [agencyModalColisId, setAgencyModalColisId] = useState<string | null>(null);

  // Formulaire nouveau colis
  const [clientName,    setClientName]    = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientPhone,   setClientPhone]   = useState('');
  const [prixColis,     setPrixColis]     = useState('');
  const [poids,         setPoids]         = useState('');
  const [longueur,      setLongueur]      = useState('');
  const [largeur,       setLargeur]       = useState('');
  const [hauteur,       setHauteur]       = useState('');
  const [distance,      setDistance]      = useState('');

  // Profil
  const [profil, setProfil] = useState({
    nom: 'Boutique Express',
    email: 'boutique@express.cd',
    telephone: '+243 81 00 11 223',
    adresse: 'Gombe, Kinshasa',
    description: 'Vente de vêtements et accessoires en ligne.',
  });
  const [editProfil, setEditProfil] = useState(false);
  const [profilDraft, setProfilDraft] = useState(profil);

  /* ─── Calculs ─── */
  const colisLivres      = colis.filter(c => c.status === 'Livré');
  const totalRevenu       = colisLivres.reduce((s, c) => s + c.prixColis, 0);
  const totalLivraison    = colisLivres.reduce((s, c) => s + (c.prixLivraison ?? 0), 0);
  const revenuNet         = totalRevenu - totalLivraison;
  const confirmsPending   = colis.filter(c => c.status === 'Livré' && !c.confirmed);

  // Clients uniques
  const clientsMap = new Map<string, { name: string; phone: string; colis: Colis[] }>();
  colis.forEach(c => {
    if (!clientsMap.has(c.clientPhone)) {
      clientsMap.set(c.clientPhone, { name: c.clientName, phone: c.clientPhone, colis: [] });
    }
    clientsMap.get(c.clientPhone)!.colis.push(c);
  });
  const clients = Array.from(clientsMap.values());

  /* ─── Handlers ─── */
  const handleCreateColis = (e: React.FormEvent) => {
    e.preventDefault();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setColis([{
      id: Math.random().toString(36).substr(2, 9),
      clientName, clientAddress, clientPhone,
      prixColis:    parseFloat(prixColis),
      poids:        parseFloat(poids),
      longueur:     parseFloat(longueur),
      largeur:      parseFloat(largeur),
      hauteur:      parseFloat(hauteur),
      distance:     parseFloat(distance),
      prixLivraison: null,
      status: 'Créé',
      agence: null,
      otp,
      date: new Date().toLocaleDateString('fr-FR'),
      confirmed: false,
    }, ...colis]);
    setShowModal(false);
    setClientName(''); setClientAddress(''); setClientPhone(''); setPrixColis('');
    setPoids(''); setLongueur(''); setLargeur(''); setHauteur(''); setDistance('');
  };

  const handleSelectAgency = (colisId: string, agencyName: string) => {
    setColis(colis.map(c =>
      c.id === colisId
        ? { ...c, status: "En attente d'agence" as const, agence: agencyName }
        : c
    ));
    setAgencyModalColisId(null);
  };

  const handleConfirm = (colisId: string) => {
    setColis(colis.map(c => c.id === colisId ? { ...c, confirmed: true } : c));
  };

  /* ─── Nav tabs ─── */
  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'apercu',        icon: <Package size={20} />,  label: 'Aperçu' },
    { key: 'historique',    icon: <History size={20} />, label: 'Historique colis', badge: colis.length },
    { key: 'revenus',       icon: <DollarSign size={20} />, label: 'Revenus' },
    { key: 'confirmations', icon: <CheckSquare size={20} />, label: 'Confirmations', badge: confirmsPending.length || undefined },
    { key: 'clients',       icon: <Users size={20} />, label: 'Clients', badge: clients.length },
    { key: 'profil',        icon: <User size={20} />, label: 'Mon Profil' },
  ];

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ══ SIDEBAR GAUCHE ══ */}
      <aside style={{
        width: '240px',
        minWidth: '240px',
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
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '0.1rem',
          }}>Moncolis</h1>
          <p style={{ fontSize: '0.72rem', opacity: 0.4, margin: 0 }}>Espace Vendeur</p>
        </div>

        {/* Profil mini */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '900', fontSize: '1rem', color: '#000',
          }}>
            {profil.nom.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontWeight: '700', fontSize: '0.88rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profil.nom}</p>
            <p style={{ fontSize: '0.72rem', opacity: 0.45, margin: 0 }}>Vendeur vérifié</p>
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
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.88rem',
                fontWeight: activeTab === t.key ? '700' : '500',
                textAlign: 'left',
                background: activeTab === t.key ? 'var(--primary)' : 'transparent',
                color: activeTab === t.key ? '#000' : 'var(--foreground)',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { if (activeTab !== t.key) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (activeTab !== t.key) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{t.icon}</span>
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.badge ? (
                <span style={{
                  background: activeTab === t.key ? 'rgba(0,0,0,0.2)' : 'var(--primary)',
                  color: '#000', padding: '0.05rem 0.45rem',
                  borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Actions bas de sidebar */}
        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.88rem', padding: '0.65rem' }} onClick={() => setShowModal(true)}>
            + Nouveau Colis
          </button>
          <Link href="/" className="btn btn-outline" style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', textAlign: 'center' }}>
            Déconnexion
          </Link>
        </div>
      </aside>

      {/* ══ CONTENU PRINCIPAL ══ */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', minWidth: 0 }}>
      {/* Titre de section */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontWeight: '800', fontSize: '1.5rem', margin: 0 }}>
          {tabs.find(t => t.key === activeTab)?.label}
        </h2>
        <p style={{ opacity: 0.45, fontSize: '0.82rem', marginTop: '0.25rem' }}>
          {activeTab === 'apercu' && 'Vue globale de votre activité'}
          {activeTab === 'historique' && 'Tous vos colis créés'}
          {activeTab === 'revenus' && 'Chiffre d\'affaires et marges'}
          {activeTab === 'confirmations' && 'Livraisons à confirmer'}
          {activeTab === 'clients' && 'Liste de tous vos destinataires'}
          {activeTab === 'profil' && 'Informations de votre boutique'}
        </p>
      </div>

      {/* ══════════════ APERCU ══════════════ */}
      {activeTab === 'apercu' && (
        <div className="animate-fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {[
              { label: 'Total colis', value: colis.length, color: 'var(--primary)' },
              { label: 'Colis livrés', value: colisLivres.length, color: '#22c55e' },
              { label: 'En cours', value: colis.filter(c => c.status === 'En transit').length, color: '#3b82f6' },
              { label: 'Revenu net', value: `${revenuNet.toLocaleString('fr-FR')} USD`, color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="glass-panel" style={{ padding: '1.5rem' }}>
                <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.4rem' }}>{s.label}</p>
                <p style={{ fontSize: '2rem', fontWeight: '800', color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Derniers colis</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)', opacity: 0.6 }}>
                  {['Client', 'Date', 'Valeur', 'Agence', 'Statut'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colis.slice(0, 5).map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.7rem 0.75rem', fontWeight: '600' }}>{c.clientName}</td>
                    <td style={{ padding: '0.7rem 0.75rem', opacity: 0.6 }}>{c.date}</td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--primary)', fontWeight: '700' }}>{c.prixColis.toLocaleString('fr-FR')} USD</td>
                    <td style={{ padding: '0.7rem 0.75rem', opacity: 0.7 }}>{c.agence ?? '—'}</td>
                    <td style={{ padding: '0.7rem 0.75rem' }}>
                      <span style={{ background: STATUS_COLOR[c.status] + '22', color: STATUS_COLOR[c.status], padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', border: `1px solid ${STATUS_COLOR[c.status]}44` }}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ HISTORIQUE COLIS ══════════════ */}
      {activeTab === 'historique' && (
        <div className="animate-fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {colis.map(c => (
              <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', transition: 'transform 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.015)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '1.05rem' }}>{c.clientName}</strong>
                  <span style={{ background: STATUS_COLOR[c.status] + '22', color: STATUS_COLOR[c.status], padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', border: `1px solid ${STATUS_COLOR[c.status]}44`, flexShrink: 0 }}>
                    {c.status}
                  </span>
                </div>
                <p style={{ opacity: 0.6, fontSize: '0.82rem', marginBottom: '0.2rem' }}>{c.clientAddress}</p>
                <p style={{ opacity: 0.6, fontSize: '0.82rem', marginBottom: '0.9rem' }}>{c.clientPhone} · {c.date}</p>

                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '0.5rem', borderRadius: '10px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: '0 0 0.2rem' }}>Valeur colis</p>
                    <p style={{ fontWeight: '800', color: 'var(--primary)', margin: 0 }}>{c.prixColis.toLocaleString('fr-FR')} USD</p>
                  </div>
                  <div style={{ flex: 1, background: c.prixLivraison ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${c.prixLivraison ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`, padding: '0.5rem', borderRadius: '10px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: '0 0 0.2rem' }}>Livraison</p>
                    <p style={{ fontWeight: '800', color: c.prixLivraison ? '#f59e0b' : 'rgba(255,255,255,0.3)', margin: 0, fontSize: c.prixLivraison ? '1rem' : '0.78rem' }}>
                      {c.prixLivraison ? `${c.prixLivraison.toLocaleString('fr-FR')} USD` : 'En attente'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem', fontSize: '0.75rem' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Scale size={14} /> {c.poids} kg</span>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Ruler size={14} /> {c.longueur}x{c.largeur}x{c.hauteur}</span>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> {c.distance} km</span>
                </div>



                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px dashed var(--primary)', padding: '0.6rem', borderRadius: '10px', textAlign: 'center', marginBottom: '0.9rem' }}>
                  <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.6, marginBottom: '0.2rem' }}>Code OTP client</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '4px', color: 'var(--primary)' }}>{c.otp}</span>
                </div>

                {!c.agence ? (
                  <button className="btn btn-outline" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => setAgencyModalColisId(c.id)}>
                    Choisir une agence
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', fontSize: '0.85rem', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                    Agence : <strong style={{ color: 'var(--primary)' }}>{c.agence}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ REVENUS ══════════════ */}
      {activeTab === 'revenus' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {[
              { label: 'Chiffre d\'affaires brut', value: totalRevenu, color: 'var(--primary)', suffix: 'USD' },
              { label: 'Frais de livraison', value: totalLivraison, color: '#ef4444', suffix: 'USD' },
              { label: 'Revenu net', value: revenuNet, color: '#22c55e', suffix: 'USD' },
              { label: 'Colis facturés', value: colisLivres.length, color: '#3b82f6', suffix: 'colis' },
            ].map((s, i) => (
              <div key={i} className="glass-panel" style={{ padding: '1.5rem' }}>
                <p style={{ fontSize: '0.82rem', opacity: 0.6, marginBottom: '0.4rem' }}>{s.label}</p>
                <p style={{ fontSize: '1.9rem', fontWeight: '800', color: s.color }}>{typeof s.value === 'number' ? s.value.toLocaleString('fr-FR') : s.value}</p>
                <p style={{ fontSize: '0.78rem', opacity: 0.5, marginTop: '0.2rem' }}>{s.suffix}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Détail des revenus par colis livré</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)', opacity: 0.6 }}>
                  {['Client', 'Date', 'Valeur colis', 'Frais livraison', 'Revenu net', 'Agence'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colisLivres.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.7rem 0.75rem', fontWeight: '600' }}>{c.clientName}</td>
                    <td style={{ padding: '0.7rem 0.75rem', opacity: 0.6 }}>{c.date}</td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--primary)', fontWeight: '700' }}>{c.prixColis.toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '0.7rem 0.75rem', color: '#ef4444' }}>- {(c.prixLivraison ?? 0).toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '0.7rem 0.75rem', color: '#22c55e', fontWeight: '700' }}>{(c.prixColis - (c.prixLivraison ?? 0)).toLocaleString('fr-FR')} USD</td>
                    <td style={{ padding: '0.7rem 0.75rem', opacity: 0.7 }}>{c.agence}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--card-border)' }}>
                  <td colSpan={2} style={{ padding: '0.75rem', fontWeight: '700', opacity: 0.7 }}>TOTAL</td>
                  <td style={{ padding: '0.75rem', color: 'var(--primary)', fontWeight: '800' }}>{totalRevenu.toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '0.75rem', color: '#ef4444', fontWeight: '800' }}>- {totalLivraison.toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: '800' }}>{revenuNet.toLocaleString('fr-FR')} USD</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ CONFIRMATIONS ══════════════ */}
      {activeTab === 'confirmations' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {confirmsPending.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠</span>
              <p style={{ margin: 0, color: '#f59e0b', fontWeight: '600' }}>
                {confirmsPending.length} colis livré(s) en attente de confirmation
              </p>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Colis livrés — confirmation requise</h2>
            {colis.filter(c => c.status === 'Livré').length === 0 ? (
              <p style={{ opacity: 0.5, textAlign: 'center', padding: '2rem' }}>Aucun colis livré pour l'instant.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {colis.filter(c => c.status === 'Livré').map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.03)', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '1rem' }}>{c.clientName}</strong>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', opacity: 0.6 }}>{c.clientAddress} · {c.date}</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: '700' }}>
                        {c.prixColis.toLocaleString('fr-FR')} USD · Agence : {c.agence}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      {c.confirmed ? (
                        <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          ✓ Confirmé
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                          onClick={() => handleConfirm(c.id)}
                        >
                          Confirmer la réception
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ CLIENTS ══════════════ */}
      {activeTab === 'clients' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.82rem', opacity: 0.6, marginBottom: '0.4rem' }}>Clients uniques</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>{clients.length}</p>
            </div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.82rem', opacity: 0.6, marginBottom: '0.4rem' }}>Clients fidèles (2+ colis)</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: '#3b82f6' }}>{clients.filter(cl => cl.colis.length >= 2).length}</p>
            </div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.82rem', opacity: 0.6, marginBottom: '0.4rem' }}>Moy. colis / client</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>
                {clients.length > 0 ? (colis.length / clients.length).toFixed(1) : '0'}
              </p>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Liste de mes clients</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {clients.map(cl => (
                <div key={cl.phone} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.03)', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem', color: '#000', flexShrink: 0 }}>
                      {cl.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>{cl.name}</strong>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', opacity: 0.6 }}>{cl.phone}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--primary)', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700' }}>
                      {cl.colis.length} colis
                    </span>
                    <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                      Dernier : {cl.colis[0]?.date ?? '—'}
                    </span>
                    <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.85rem' }}>
                      {cl.colis.reduce((s, c) => s + c.prixColis, 0).toLocaleString('fr-FR')} USD
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ PROFIL ══════════════ */}
      {activeTab === 'profil' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '2rem', color: '#000', flexShrink: 0 }}>
                {profil.nom.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>{profil.nom}</h2>
                <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.2rem' }}>Vendeur vérifié</p>
              </div>
            </div>

            {!editProfil ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {[
                  { label: 'Email',       value: profil.email },
                  { label: 'Téléphone',   value: profil.telephone },
                  { label: 'Adresse',     value: profil.adresse },
                  { label: 'Description', value: profil.description },
                ].map(f => (
                  <div key={f.label} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.2rem' }}>{f.label}</p>
                    <p style={{ fontWeight: '600', margin: 0 }}>{f.value}</p>
                  </div>
                ))}
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => { setProfilDraft(profil); setEditProfil(true); }}
                >
                  Modifier le profil
                </button>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); setProfil(profilDraft); setEditProfil(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {([
                  { key: 'nom',         label: 'Nom boutique',  type: 'text' },
                  { key: 'email',       label: 'Email',         type: 'email' },
                  { key: 'telephone',   label: 'Téléphone',     type: 'tel' },
                  { key: 'adresse',     label: 'Adresse',       type: 'text' },
                  { key: 'description', label: 'Description',   type: 'text' },
                ] as { key: keyof typeof profilDraft; label: string; type: string }[]).map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.4rem' }}>{f.label}</label>
                    <input
                      type={f.type}
                      className="input-field"
                      value={profilDraft[f.key]}
                      onChange={e => setProfilDraft({ ...profilDraft, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditProfil(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enregistrer</button>
                </div>
              </form>
            )}
          </div>

          {/* Stats rapides profil */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[
              { label: 'Membre depuis', value: 'Juin 2026' },
              { label: 'Colis total',   value: colis.length },
              { label: 'Taux livraison', value: `${colisLivres.length > 0 ? Math.round((colisLivres.length / colis.length) * 100) : 0}%` },
              { label: 'Clients',       value: clients.length },
            ].map((s, i) => (
              <div key={i} className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.78rem', opacity: 0.5, marginBottom: '0.3rem' }}>{s.label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ MODAL NOUVEAU COLIS ══════════════ */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '580px', padding: '2rem', margin: '1rem', maxHeight: '92vh', overflowY: 'auto' }}>

            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Nouveau colis</h2>
                <p style={{ margin: '0.25rem 0 0', opacity: 0.5, fontSize: '0.82rem' }}>Renseignez toutes les informations pour permettre à l'agence de fixer le tarif</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>

            <form onSubmit={handleCreateColis} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── Section destinataire ── */}
              <SectionLabel>Destinataire</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <FormField label="Nom du client *">
                  <input required className="input-field" type="text" placeholder="Ex : Alice Koné" value={clientName} onChange={e => setClientName(e.target.value)} />
                </FormField>
                <FormField label="Adresse de livraison *">
                  <input required className="input-field" type="text" placeholder="Ex : Gombe, Boulevard du 30 Juin, Kinshasa" value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
                </FormField>
                <FormField label="Téléphone *">
                  <input required className="input-field" type="tel" placeholder="+243 81 22 33 445" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
                </FormField>
              </div>

              {/* ── Section valeur ── */}
              <SectionLabel>Valeur &amp; Distance</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <FormField label="Valeur du colis (USD) *">
                  <input required type="number" min="1" step="1" className="input-field" placeholder="Ex : 25 000" value={prixColis} onChange={e => setPrixColis(e.target.value)} />
                </FormField>
                <FormField label="Distance estimée (km) *">
                  <input required type="number" min="0.1" step="0.1" className="input-field" placeholder="Ex : 12" value={distance} onChange={e => setDistance(e.target.value)} />
                </FormField>
              </div>

              {/* ── Section poids & dimensions ── */}
              <SectionLabel>Poids &amp; Dimensions</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <FormField label="Poids (kg) *">
                  <input required type="number" min="0.01" step="0.01" className="input-field" placeholder="Ex : 2.5" value={poids} onChange={e => setPoids(e.target.value)} />
                </FormField>
                <FormField label="Longueur (cm) *">
                  <input required type="number" min="1" step="1" className="input-field" placeholder="Ex : 40" value={longueur} onChange={e => setLongueur(e.target.value)} />
                </FormField>
                <FormField label="Largeur (cm) *">
                  <input required type="number" min="1" step="1" className="input-field" placeholder="Ex : 30" value={largeur} onChange={e => setLargeur(e.target.value)} />
                </FormField>
                <FormField label="Hauteur (cm) *">
                  <input required type="number" min="1" step="1" className="input-field" placeholder="Ex : 20" value={hauteur} onChange={e => setHauteur(e.target.value)} />
                </FormField>
              </div>

              {/* ── Aperçu transport suggéré ── */}
              {poids && longueur && largeur && hauteur && (
                <TransportSuggestion
                  poids={parseFloat(poids) || 0}
                  volume={(parseFloat(longueur) * parseFloat(largeur) * parseFloat(hauteur)) / 1_000_000}
                  distance={parseFloat(distance) || 0}
                />
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Générer le code OTP</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL CHOIX AGENCE ══════════════ */}
      {agencyModalColisId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '560px', padding: '2rem', margin: '1rem', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0 }}>Choisir une agence</h2>
              <button onClick={() => setAgencyModalColisId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <p style={{ opacity: 0.6, marginBottom: '1.25rem', fontSize: '0.875rem' }}>Les agences recommandées ont un meilleur taux de réussite dans votre zone.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {AGENCES_LIST.map(agence => (
                <div key={agence.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderRadius: '12px', border: agence.recommended ? '2px solid var(--primary)' : '1px solid var(--card-border)', background: 'rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>{agence.name}</strong>
                      {agence.recommended && <span style={{ background: 'var(--primary)', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '800' }}>Recommandé</span>}
                    </div>
                    <p style={{ opacity: 0.6, fontSize: '0.82rem', marginTop: '0.2rem' }}>Fiabilité : {agence.score}% · Tarif estimé : {agence.price}</p>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', flexShrink: 0 }} onClick={() => handleSelectAgency(agencyModalColisId, agence.name)}>
                    Choisir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Composants de Formulaire
───────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, margin: '0.5rem 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {children}
      <div style={{ height: '1px', flex: 1, background: 'var(--card-border)' }} />
    </h3>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', opacity: 0.8 }}>{label}</label>
      {children}
    </div>
  );
}

function TransportSuggestion({ poids, volume, distance }: { poids: number; volume: number; distance: number }) {
  let suggestion = '';
  let color = '';
  let icon: React.ReactNode;

  if (poids > 50 || volume > 0.5) {
    suggestion = 'Camionnette ou Camion';
    color = '#ef4444'; // rouge (lourd/encombrant)
    icon = <Truck size={32} color={color} />;
  } else if (poids > 10 || volume > 0.1 || distance > 20) {
    suggestion = 'Voiture';
    color = '#f59e0b'; // orange (moyen)
    icon = <ArrowRight size={32} color={color} />;
  } else {
    suggestion = 'Moto ou Scooter';
    color = '#22c55e'; // vert (léger/proche)
    icon = <ArrowRight size={32} color={color} />;
  }

  return (
    <div style={{
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      borderRadius: '12px',
      padding: '1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginTop: '0.5rem'
    }}>
      <div style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</div>
      <div>
        <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: '0 0 0.2rem' }}>Meilleur moyen de transport estimé</p>
        <p style={{ color, fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>{suggestion}</p>
        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: '0.2rem 0 0' }}>
          Vol: {volume.toFixed(3)} m³ · Dist: {distance} km
        </p>
      </div>
    </div>
  );
}

