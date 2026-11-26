'use client';

import { useState, useEffect, useMemo } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  Wallet, DollarSign, ArrowUpRight, ArrowDownLeft, CheckCircle2,
  AlertTriangle, RefreshCw, Printer, ShieldCheck, Clock,
  FileText, Lock, Unlock, HelpCircle, Check, X,
  Building2, Percent, Warehouse, PackageCheck, Layers, Info, ExternalLink
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

interface CashSession {
  isOpen: boolean;
  openedAt: string;
  openedBy?: string;
  openingFundUSD: number;
  openingFundCDF: number;
  expectedUSD: number;
  expectedCDF: number;
}

interface VendorBalance {
  vendor_id: string;
  amount_owed_to_vendor: number;
  amount_owed_by_vendor: number;
  total_delivered: number;
  vendor?: {
    name: string;
    phone: string;
  };
}

interface VendorPaymentHistory {
  id: string;
  vendor_id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  created_at: string;
  confirmed_by_vendor_at?: string | null;
  notes?: string | null;
  vendor?: {
    name: string;
    phone: string;
  };
  otpInfo?: {
    id: string;
    expires_at: string;
    used: boolean;
  } | null;
}

interface CashRequest {
  id: string;
  driver_id: string;
  amount: number;
  status: string;
  note?: string;
  created_at: string;
  driver?: {
    phone: string;
    profile?: {
      name: string;
    };
  };
}

interface ClosedSessionReceipt {
  id?: string;
  reference: string;
  openedAt: string;
  closedAt: string;
  openedBy?: string;
  closedBy: string;
  openingUSD: number;
  openingCDF: number;
  expectedUSD: number;
  expectedCDF: number;
  countedUSD: number;
  countedCDF: number;
  diffUSD: number;
  diffCDF: number;
  reason: string;
}

interface AgencyCommissionDeliveryItem {
  id: string;
  tracking_code: string;
  delivered_at: string;
  delivery_price: number;
  commission_rate: number;
  commission_amount: number;
  net_agency: number;
  currency: string;
  vendor_name: string;
}

interface AgencyCommissionWarehouseItem {
  id: string;
  space_title: string;
  vendor_name: string;
  slots: number;
  price_paid: number;
  commission_rate: number;
  commission_amount: number;
  net_agency_amount: number;
  currency: string;
  start_date: string;
  end_date: string;
}

interface AgencyCommissionsData {
  summary: {
    totalCommissionDue: number;
    totalGrossRevenue: number;
    totalNetAgency: number;
    currency?: string;
  };
  agency: {
    id: string;
    name: string;
    billing_type: string;
    billing_value: number;
    billingType?: string;
    billingValue?: number;
  };
  deliveries: {
    count: number;
    totalDeliveryFees: number;
    totalDeliveryCommission: number;
    totalNetDeliveryAgency: number;
    grossRevenue?: number;
    commissionDue?: number;
    netAgency?: number;
    items: AgencyCommissionDeliveryItem[];
  };
  warehouse: {
    count: number;
    totalRentFees: number;
    totalWarehouseCommission: number;
    totalNetWarehouseAgency: number;
    grossRevenue?: number;
    commissionDue?: number;
    netAgency?: number;
    activeCount?: number;
    totalCount?: number;
    items: AgencyCommissionWarehouseItem[];
  };
}

export default function AgencyVersementsPage() {
  const { user } = useAuth('agence');
  const { currency, formatPrice } = useCurrency();
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canManageCash = hasAgencyPermission(userRole, 'canManageCashSessions');

  const [loading, setLoading] = useState(true);
  const [vendorBalances, setVendorBalances] = useState<VendorBalance[]>([]);
  const [vendorHistory, setVendorHistory] = useState<VendorPaymentHistory[]>([]);
  const [cashRequests, setCashRequests] = useState<CashRequest[]>([]);

  // Onglet sélectionné
  const [activeTab, setActiveTab] = useState<'session' | 'vendors' | 'drivers' | 'commissions'>('session');
  const [commissionsData, setCommissionsData] = useState<AgencyCommissionsData | null>(null);
  const [commissionsFilter, setCommissionsFilter] = useState<'all' | 'deliveries' | 'warehouse'>('all');

  // Session de caisse (persistance locale / état d'agence)
  const [cashSession, setCashSession] = useState<CashSession>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mc_agency_cash_session');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return {
      isOpen: true,
      openedAt: new Date().toISOString(),
      openedBy: 'Agent Caisse',
      openingFundUSD: 100,
      openingFundCDF: 150000,
      expectedUSD: 240,
      expectedCDF: 380000,
    };
  });

  // Historique permanent des sessions de caisse clôturées
  const [sessionHistory, setSessionHistory] = useState<ClosedSessionReceipt[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mc_agency_cash_history');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [];
  });
  const [viewingReceiptModal, setViewingReceiptModal] = useState<ClosedSessionReceipt | null>(null);

  // Modal Ouverture de Caisse
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [openFundUSD, setOpenFundUSD] = useState<string>('0');
  const [openFundCDF, setOpenFundCDF] = useState<string>('0');
  const [openAgentName, setOpenAgentName] = useState<string>('');

  // Modal Clôture de Caisse
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [countedUSD, setCountedUSD] = useState<string>('');
  const [countedCDF, setCountedCDF] = useState<string>('');
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');
  const [closedReceipt, setClosedReceipt] = useState<ClosedSessionReceipt | null>(null);

  // Modal Paiement Vendeur
  const [payVendorModal, setPayVendorModal] = useState<VendorBalance | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'AIRTEL_MONEY' | 'ORANGE_MONEY' | 'MPESA'>('CASH');
  const [paying, setPaying] = useState(false);
  const [paymentSuccessReceipt, setPaymentSuccessReceipt] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resBalances, resRequests, resSessions, resCommissions] = await Promise.all([
        fetch('/api/agency/payments/balances').then(r => r.ok ? r.json() : { balances: [], history: [] }).catch(() => ({ balances: [], history: [] })),
        fetch('/api/agency/cash-requests').then(r => r.ok ? r.json() : { requests: [] }).catch(() => ({ requests: [] })),
        fetch('/api/agency/cash-sessions').then(r => r.ok ? r.json() : { history: [], currentSession: null }).catch(() => ({ history: [], currentSession: null })),
        fetch('/api/agency/commissions').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      setVendorBalances(resBalances.balances || []);
      setVendorHistory(resBalances.history || []);
      setCashRequests(resRequests.requests || []);
      if (resCommissions) {
        setCommissionsData(resCommissions);
      }

      // Synchroniser l'historique des sessions
      const serverHistory: ClosedSessionReceipt[] = resSessions.history || [];
      setSessionHistory(prev => {
        const localList = [...prev];
        const combined = [...serverHistory];
        for (const item of localList) {
          if (!combined.some(c => c.reference === item.reference || (c.id && item.id && c.id === item.id))) {
            combined.push(item);
          }
        }
        combined.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
        if (typeof window !== 'undefined') {
          localStorage.setItem('mc_agency_cash_history', JSON.stringify(combined));
        }
        return combined;
      });

      // Si le serveur renvoie une session ouverte active, la synchroniser
      if (resSessions.currentSession) {
        setCashSession(resSessions.currentSession);
        if (typeof window !== 'undefined') {
          localStorage.setItem('mc_agency_cash_session', JSON.stringify(resSessions.currentSession));
        }
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'commissions' || tabParam === 'vendors' || tabParam === 'drivers' || tabParam === 'session') {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  // Calculs écarts de clôture
  const parsedCountedUSD = parseFloat(countedUSD) || 0;
  const parsedCountedCDF = parseFloat(countedCDF) || 0;
  const diffUSD = parsedCountedUSD - cashSession.expectedUSD;
  const diffCDF = parsedCountedCDF - cashSession.expectedCDF;
  const hasDiscrepancy = Math.abs(diffUSD) > 0.01 || Math.abs(diffCDF) > 500;

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasDiscrepancy && !discrepancyReason.trim()) return;

    const receipt: ClosedSessionReceipt = {
      reference: `PV-${Date.now().toString(36).toUpperCase()}`,
      closedAt: new Date().toISOString(),
      openedAt: cashSession.openedAt,
      openedBy: cashSession.openedBy || user?.name || 'Agent Caisse',
      closedBy: user?.name || 'Agent Caisse',
      openingUSD: cashSession.openingFundUSD,
      openingCDF: cashSession.openingFundCDF,
      expectedUSD: cashSession.expectedUSD,
      expectedCDF: cashSession.expectedCDF,
      countedUSD: parsedCountedUSD,
      countedCDF: parsedCountedCDF,
      diffUSD,
      diffCDF,
      reason: discrepancyReason.trim() || 'Aucun écart constaté.',
    };

    // Mettre à jour l'historique local immédiatement
    setSessionHistory(prev => {
      const updated = [receipt, ...prev.filter(h => h.reference !== receipt.reference)];
      if (typeof window !== 'undefined') {
        localStorage.setItem('mc_agency_cash_history', JSON.stringify(updated));
      }
      return updated;
    });

    setClosedReceipt(receipt);
    setCloseModalOpen(false);

    // Mettre à jour la session
    const updated = {
      ...cashSession,
      isOpen: false,
    };
    setCashSession(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mc_agency_cash_session', JSON.stringify(updated));
    }

    // Persister vers le serveur API
    try {
      await fetch('/api/agency/cash-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', receipt }),
      });
    } catch (err) {
      console.warn('Erreur synchronisation clôture session', err);
    }
  };

  const handleOpenNewSession = () => {
    setOpenFundUSD(String(cashSession.openingFundUSD || 0));
    setOpenFundCDF(String(cashSession.openingFundCDF || 0));
    setOpenAgentName(user?.name || '');
    setOpenModalOpen(true);
  };

  const handleConfirmOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const usd = Math.max(0, parseFloat(openFundUSD) || 0);
    const cdf = Math.max(0, parseFloat(openFundCDF) || 0);
    const agent = openAgentName.trim() || user?.name || 'Agent Caisse';

    const fresh: CashSession = {
      isOpen: true,
      openedAt: new Date().toISOString(),
      openedBy: agent,
      openingFundUSD: usd,
      openingFundCDF: cdf,
      expectedUSD: usd,
      expectedCDF: cdf,
    };

    // Si un reçu de clôture était affiché, s'assurer qu'il est bien conservé dans l'historique
    if (closedReceipt) {
      setSessionHistory(prev => {
        if (!prev.some(h => h.reference === closedReceipt.reference)) {
          const updated = [closedReceipt, ...prev];
          if (typeof window !== 'undefined') {
            localStorage.setItem('mc_agency_cash_history', JSON.stringify(updated));
          }
          return updated;
        }
        return prev;
      });
    }

    setCashSession(fresh);
    setClosedReceipt(null);
    setOpenModalOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mc_agency_cash_session', JSON.stringify(fresh));
    }

    // Persister ouverture vers le serveur
    try {
      await fetch('/api/agency/cash-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', session: fresh }),
      });
    } catch (err) {
      console.warn('Erreur synchronisation ouverture session', err);
    }
  };

  const handleExecuteVendorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payVendorModal || !payAmount) return;

    if (payMethod === 'CASH' && !cashSession.isOpen) {
      alert('Veuillez d\'abord ouvrir une session de caisse pour effectuer un paiement en espèces.');
      return;
    }

    setPaying(true);

    try {
      const res = await fetch('/api/agency/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: payVendorModal.vendor_id,
          amount: parseFloat(payAmount),
          currency: 'USD',
          channel: payMethod,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Si paiement en espèces CASH, déduire immédiatement de la caisse active
        if (payMethod === 'CASH' && cashSession.isOpen) {
          const paidUsd = parseFloat(payAmount) || 0;
          const paidCdf = Math.round(paidUsd * 2400);
          const updated = {
            ...cashSession,
            expectedUSD: Math.max(0, parseFloat((cashSession.expectedUSD - paidUsd).toFixed(2))),
            expectedCDF: Math.max(0, cashSession.expectedCDF - paidCdf),
          };
          setCashSession(updated);
          if (typeof window !== 'undefined') {
            localStorage.setItem('mc_agency_cash_session', JSON.stringify(updated));
          }
        }

        setPaymentSuccessReceipt({
          vendorName: payVendorModal.vendor?.name || 'Vendeur',
          amount: parseFloat(payAmount),
          currency: 'USD',
          method: payMethod,
          date: new Date().toISOString(),
          reference: data.entryId || Math.random().toString(36).slice(-8).toUpperCase(),
          otp: data.otp || null,
        });
        setPayVendorModal(null);
        setPayAmount('');
        fetchData();
      } else {
        alert(data.error || 'Erreur lors du versement.');
      }
    } catch {
      alert('Erreur réseau.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Caisse & Versements Partenaires
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
              Gestion des sessions de caisse en double devise (USD & CDF), suivi des dépôts livreurs et historique des versements vendeurs.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchData}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                color: 'var(--ag-text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
        </div>

        {/* ─── CADRE STATUT CAISSE ET DEVISES (USD & CDF) ─────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Caisse USD */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Caisse Espèces USD ($)
              </span>
              <span className="agency-badge" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                Devise 1
              </span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ag-text-primary)' }}>
              ${cashSession.expectedUSD.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
              Fond initial : ${cashSession.openingFundUSD.toFixed(2)} | Encaissements en cours
            </div>
          </div>

          {/* Caisse CDF */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Caisse Espèces CDF (FC)
              </span>
              <span className="agency-badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                Devise 2
              </span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ag-text-primary)' }}>
              {cashSession.expectedCDF.toLocaleString('fr-FR')} FC
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
              Fond initial : {cashSession.openingFundCDF.toLocaleString('fr-FR')} FC | Espèces franc congolais
            </div>
          </div>

          {/* Statut Session & Clôture */}
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>
                  Session Quotidienne
                </span>
                <span className="agency-badge" style={{
                  backgroundColor: cashSession.isOpen ? 'var(--ag-success-bg)' : 'var(--ag-danger-bg)',
                  color: cashSession.isOpen ? 'var(--ag-success)' : 'var(--ag-danger)'
                }}>
                  {cashSession.isOpen ? <Unlock size={12} /> : <Lock size={12} />}
                  {cashSession.isOpen ? 'Session Active' : 'Session Clôturée'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)' }}>
                Ouverte le {new Date(cashSession.openedAt).toLocaleDateString('fr-FR')} à {new Date(cashSession.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {canManageCash && (
              <div style={{ marginTop: '14px' }}>
                {cashSession.isOpen ? (
                  <button
                    onClick={() => {
                      setCountedUSD(String(cashSession.expectedUSD));
                      setCountedCDF(String(cashSession.expectedCDF));
                      setDiscrepancyReason('');
                      setCloseModalOpen(true);
                    }}
                    style={{
                      width: '100%', height: '36px', borderRadius: '8px', border: 'none',
                      backgroundColor: 'var(--ag-brand)', color: '#fff',
                      fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                    }}
                  >
                    Clôturer la caisse & Billetage
                  </button>
                ) : (
                  <button
                    onClick={handleOpenNewSession}
                    style={{
                      width: '100%', height: '36px', borderRadius: '8px', border: 'none',
                      backgroundColor: 'var(--ag-success)', color: '#000',
                      fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer'
                    }}
                  >
                    Démarrer une nouvelle session
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── ONGLETS NAVIGATION ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--ag-border)', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('session')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: activeTab === 'session' ? 'var(--ag-brand-subtle)' : 'transparent',
              color: activeTab === 'session' ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
              fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            Rapprochement de Caisse
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: activeTab === 'vendors' ? 'var(--ag-brand-subtle)' : 'transparent',
              color: activeTab === 'vendors' ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
              fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            Versements Vendeurs ({vendorBalances.length})
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: activeTab === 'drivers' ? 'var(--ag-brand-subtle)' : 'transparent',
              color: activeTab === 'drivers' ? 'var(--ag-brand)' : 'var(--ag-text-secondary)',
              fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            Dépôts Livreurs ({cashRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: activeTab === 'commissions' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
              color: activeTab === 'commissions' ? '#ef4444' : 'var(--ag-text-secondary)',
              fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Percent size={14} />
            Commissions Mon Colis {commissionsData?.summary ? `($${commissionsData.summary.totalCommissionDue.toFixed(2)})` : ''}
          </button>
        </div>

        {/* CONTENU ONGLET 1 : RAPPROCHEMENT & REÇU DE SESSION & HISTORIQUE PERMANENT */}
        {activeTab === 'session' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Si un reçu vient d'être généré lors d'une clôture récente */}
            {closedReceipt && (
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '16px', padding: '24px', boxShadow: 'var(--ag-card-shadow)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--ag-brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ag-brand)' }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                        Procès-Verbal de Clôture de Caisse ({closedReceipt.reference})
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                        Cette session est désormais archivée dans l'historique ci-dessous.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setViewingReceiptModal(closedReceipt)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                        backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
                      }}
                    >
                      <Printer size={15} /> Imprimer PV
                    </button>
                    <button
                      onClick={() => setClosedReceipt(null)}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                        backgroundColor: 'transparent', color: 'var(--ag-text-secondary)',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
                      }}
                    >
                      Masquer
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--ag-surface-hover)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>Clôturé par :</div>
                    <strong style={{ fontSize: '0.95rem' }}>{closedReceipt.closedBy}</strong>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--ag-surface-hover)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>Date & Heure :</div>
                    <strong style={{ fontSize: '0.95rem' }}>{new Date(closedReceipt.closedAt).toLocaleString('fr-FR')}</strong>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--ag-surface-hover)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>Écart USD :</div>
                    <strong style={{ fontSize: '0.95rem', color: closedReceipt.diffUSD === 0 ? 'var(--ag-success)' : 'var(--ag-danger)' }}>
                      ${closedReceipt.diffUSD.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--ag-surface-hover)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)' }}>Écart CDF :</div>
                    <strong style={{ fontSize: '0.95rem', color: closedReceipt.diffCDF === 0 ? 'var(--ag-success)' : 'var(--ag-danger)' }}>
                      {closedReceipt.diffCDF} FC
                    </strong>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--ag-text-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--ag-border)' }}>
                  <strong>Justification des écarts / Observations :</strong>
                  <p style={{ margin: '4px 0 0' }}>{closedReceipt.reason}</p>
                </div>
              </div>
            )}

            {/* Carte de statut de la caisse active */}
            {!cashSession.isOpen ? (
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: 'var(--ag-card-shadow)'
              }}>
                <Lock size={40} style={{ color: 'var(--ag-danger)', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
                  Caisse Actuellement Clôturée
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--ag-text-secondary)', maxWidth: '540px', margin: '0 auto 20px' }}>
                  Aucune session active en cours. Toutes les sessions précédentes sont conservées dans l'historique ci-dessous.
                  Pour démarrer une nouvelle journée ou une nouvelle relève, ouvrez une session avec votre fond de caisse.
                </p>
                {canManageCash && (
                  <button
                    onClick={handleOpenNewSession}
                    style={{
                      padding: '12px 28px', borderRadius: '8px', border: 'none',
                      backgroundColor: 'var(--ag-success)', color: '#000',
                      fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <Unlock size={16} /> Ouvrir une nouvelle session de caisse
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '16px', padding: '28px', textAlign: 'center', boxShadow: 'var(--ag-card-shadow)'
              }}>
                <ShieldCheck size={40} style={{ color: 'var(--ag-brand)', margin: '0 auto 10px' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 6px', color: 'var(--ag-text-primary)' }}>
                  Session de Caisse Active en Cours
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--ag-text-secondary)', maxWidth: '540px', margin: '0 auto 18px' }}>
                  Ouverte par <strong>{cashSession.openedBy || 'Agent Caisse'}</strong> le {new Date(cashSession.openedAt).toLocaleDateString('fr-FR')} à {new Date(cashSession.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.
                  Tous les encaissements guichet et dépôts livreurs sont comptabilisés en direct.
                </p>
                {canManageCash && (
                  <button
                    onClick={() => {
                      setCountedUSD(String(cashSession.expectedUSD));
                      setCountedCDF(String(cashSession.expectedCDF));
                      setDiscrepancyReason('');
                      setCloseModalOpen(true);
                    }}
                    style={{
                      padding: '10px 24px', borderRadius: '8px', border: 'none',
                      backgroundColor: 'var(--ag-brand)', color: '#fff',
                      fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
                    }}
                  >
                    Clôturer la caisse & Billetage
                  </button>
                )}
              </div>
            )}

            {/* ─── TABLEAU HISTORIQUE PERMANENT DES SESSIONS DE CAISSE ─────── */}
            <div style={{
              backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
              borderRadius: '14px', boxShadow: 'var(--ag-card-shadow)', overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ag-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                    Historique Permanent des Sessions & Procès-Verbaux de Clôture ({sessionHistory.length})
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                    Toutes vos anciennes sessions, montants de départ, comptages de caisse et écarts restent conservés et consultables.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="agency-table" style={{ minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th>Réf. PV</th>
                      <th>Ouverture / Clôture</th>
                      <th>Caissier(s)</th>
                      <th>Fond Initial</th>
                      <th>Attendu</th>
                      <th>Compté (Billetage)</th>
                      <th>Écart</th>
                      <th>Observations</th>
                      <th style={{ textAlign: 'right' }}>Procès-Verbal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionHistory.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ag-text-muted)' }}>
                          Aucune session clôturée enregistrée pour l'instant. Dès que vous clôturez une session, elle restera archivée ici en permanence.
                        </td>
                      </tr>
                    ) : (
                      sessionHistory.map(item => {
                        const isPerfect = Math.abs(item.diffUSD) < 0.01 && Math.abs(item.diffCDF) < 500;
                        return (
                          <tr key={item.reference || item.id}>
                            <td style={{ fontWeight: '800', fontFamily: 'monospace', color: 'var(--ag-brand)', fontSize: '0.85rem' }}>
                              {item.reference}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--ag-text-secondary)', whiteSpace: 'nowrap' }}>
                              <div> Ouv: {new Date(item.openedAt).toLocaleDateString('fr-FR')} {new Date(item.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                              <div> Clôt: {new Date(item.closedAt).toLocaleDateString('fr-FR')} {new Date(item.closedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td style={{ fontSize: '0.82rem', fontWeight: '600' }}>
                              {item.closedBy || item.openedBy || 'Agent Caisse'}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)' }}>
                              <div>${Number(item.openingUSD || 0).toFixed(2)}</div>
                              <div>{Number(item.openingCDF || 0).toLocaleString('fr-FR')} FC</div>
                            </td>
                            <td style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                              <div>${Number(item.expectedUSD || 0).toFixed(2)}</div>
                              <div>{Number(item.expectedCDF || 0).toLocaleString('fr-FR')} FC</div>
                            </td>
                            <td style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--ag-text-primary)' }}>
                              <div>${Number(item.countedUSD || 0).toFixed(2)}</div>
                              <div>{Number(item.countedCDF || 0).toLocaleString('fr-FR')} FC</div>
                            </td>
                            <td>
                              <span className="agency-badge" style={{
                                backgroundColor: isPerfect ? 'var(--ag-success-bg)' : 'var(--ag-danger-bg)',
                                color: isPerfect ? 'var(--ag-success)' : 'var(--ag-danger)',
                                fontSize: '0.72rem', whiteSpace: 'nowrap'
                              }}>
                                {isPerfect ? ' 0.00 (Conforme)' : ` USD ${item.diffUSD > 0 ? '+' : ''}${item.diffUSD.toFixed(2)} | CDF ${item.diffCDF > 0 ? '+' : ''}${item.diffCDF}`}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.reason || 'Aucun écart.'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                onClick={() => setViewingReceiptModal(item)}
                                style={{
                                  padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--ag-border)',
                                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
                                  fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <FileText size={12} /> Voir PV
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTENU ONGLET 2 : SOLDES ET HISTORIQUE VERSEMENTS VENDEURS */}
        {activeTab === 'vendors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 1. Tableau des Soldes en attente de versement */}
            <div style={{
              backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
              borderRadius: '14px', boxShadow: 'var(--ag-card-shadow)', overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ag-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                    Soldes Dus aux Vendeurs (Marchandises Livrées Non Reversées)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                    Calculé en direct selon les colis remis avec succès aux clients par vos livreurs.
                  </p>
                </div>
              </div>

              <table className="agency-table">
                <thead>
                  <tr>
                    <th>Vendeur</th>
                    <th>Téléphone</th>
                    <th>Colis Livrés</th>
                    <th>Solde Dû au Vendeur</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBalances.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ag-text-muted)' }}>
                        Aucun solde vendeur en attente.
                      </td>
                    </tr>
                  ) : (
                    vendorBalances.map(vb => (
                      <tr key={vb.vendor_id}>
                        <td style={{ fontWeight: '700', color: 'var(--ag-text-primary)' }}>
                          {vb.vendor?.name || 'Vendeur Inconnu'}
                        </td>
                        <td style={{ color: 'var(--ag-text-secondary)', fontSize: '0.8rem' }}>
                          {vb.vendor?.phone || '—'}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {vb.total_delivered}
                        </td>
                        <td>
                          <span style={{ fontWeight: '900', color: vb.amount_owed_to_vendor > 0 ? 'var(--ag-brand)' : 'var(--ag-text-muted)', fontSize: '0.95rem' }}>
                            {formatPrice(vb.amount_owed_to_vendor)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {canManageCash && vb.amount_owed_to_vendor > 0 && (
                            <button
                              onClick={() => {
                                setPayVendorModal(vb);
                                setPayAmount(String(vb.amount_owed_to_vendor));
                              }}
                              style={{
                                padding: '6px 14px', borderRadius: '6px', border: 'none',
                                backgroundColor: 'var(--ag-success)', color: '#000',
                                fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer'
                              }}
                            >
                              Effectuer un versement
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 2. Historique des versements effectués aux vendeurs */}
            <div style={{
              backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
              borderRadius: '14px', boxShadow: 'var(--ag-card-shadow)', overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ag-border)' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                  Historique des Versements Effectués aux Vendeurs
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                  Journal certifié des virements et paiements espèces validés ou en attente d'OTP.
                </p>
              </div>

              <table className="agency-table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Vendeur Bénéficiaire</th>
                    <th>Téléphone</th>
                    <th>Montant Transféré</th>
                    <th>Statut Versement</th>
                    <th>Détails & Référence</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ag-text-muted)' }}>
                        Aucun versement vendeur enregistré dans l'historique.
                      </td>
                    </tr>
                  ) : (
                    vendorHistory.map(vh => {
                      const isConfirmed = vh.status === 'CONFIRMED' || vh.type === 'VENDOR_PAYMENT_CONFIRMED';
                      const isPending = vh.status === 'PENDING';
                      return (
                        <tr key={vh.id}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--ag-text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(vh.created_at).toLocaleString('fr-FR')}
                          </td>
                          <td style={{ fontWeight: '700', color: 'var(--ag-text-primary)' }}>
                            {vh.vendor?.name || 'Vendeur'}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)' }}>
                            {vh.vendor?.phone || '—'}
                          </td>
                          <td style={{ fontWeight: '800', color: 'var(--ag-brand)', fontSize: '0.92rem' }}>
                            {vh.currency === 'CDF' ? `${vh.amount.toLocaleString('fr-FR')} FC` : formatPrice(vh.amount)}
                          </td>
                          <td>
                            <span className="agency-badge" style={{
                              backgroundColor: isConfirmed ? 'var(--ag-success-bg)' : isPending ? 'var(--ag-warning-bg)' : 'var(--ag-danger-bg)',
                              color: isConfirmed ? 'var(--ag-success)' : isPending ? 'var(--ag-warning)' : 'var(--ag-danger)'
                            }}>
                              {isConfirmed ? ' Confirmé par le vendeur' : isPending ? ' En attente validation OTP' : vh.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {vh.notes || `#${vh.id.slice(0, 8)}`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTENU ONGLET 3 : DÉPÔTS LIVREURS */}
        {activeTab === 'drivers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Cartes récapitulatives dépôts livreurs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: 'var(--ag-surface)', border: '1px solid var(--ag-border)', borderRadius: '12px', padding: '14px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Total Dépôts Enregistrés
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--ag-text-primary)', marginTop: '2px' }}>
                  {cashRequests.length}
                </div>
              </div>
              <div style={{ background: 'var(--ag-surface)', border: '1px solid var(--ag-border)', borderRadius: '12px', padding: '14px' }}>
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>
                  Dépôts Encaissés
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>
                  {cashRequests.filter(c => c.status === 'PAID').length}
                </div>
              </div>
              <div style={{ background: 'var(--ag-surface)', border: '1px solid var(--ag-border)', borderRadius: '12px', padding: '14px' }}>
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase' }}>
                  En Attente Validation Guichet
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#f59e0b', marginTop: '2px' }}>
                  {cashRequests.filter(c => c.status === 'PENDING').length}
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
              borderRadius: '14px', boxShadow: 'var(--ag-card-shadow)', overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ag-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                    Historique des Dépôts d'Espèces par les Livreurs
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                    Ensemble des versements de caisse initiés par vos livreurs via QR code ou code OTP guichet.
                  </p>
                </div>
                <a
                  href="/agence/reception"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '8px', background: 'var(--ag-brand)',
                    color: '#fff', fontSize: '0.8rem', fontWeight: '700', textDecoration: 'none'
                  }}
                >
                  Ouvrir Guichet Réception
                </a>
              </div>

              <table className="agency-table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Livreur</th>
                    <th>Téléphone</th>
                    <th>Montant Déposé</th>
                    <th>Statut</th>
                    <th>Code OTP / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {cashRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ag-text-muted)' }}>
                        Aucun historique de dépôt livreur trouvé.
                      </td>
                    </tr>
                  ) : (
                    cashRequests.map(cr => (
                      <tr key={cr.id}>
                        <td style={{ fontSize: '0.78rem', color: 'var(--ag-text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(cr.created_at).toLocaleString('fr-FR')}
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--ag-text-primary)' }}>
                          {cr.driver?.profile?.name || 'Livreur'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)' }}>
                          {cr.driver?.phone || '—'}
                        </td>
                        <td style={{ fontWeight: '900', color: 'var(--ag-brand)', fontSize: '0.92rem' }}>
                          {formatPrice(cr.amount)}
                        </td>
                        <td>
                          <span className="agency-badge" style={{
                            backgroundColor: cr.status === 'PAID' ? 'var(--ag-success-bg)' : cr.status === 'PENDING' ? 'var(--ag-warning-bg)' : 'var(--ag-danger-bg)',
                            color: cr.status === 'PAID' ? 'var(--ag-success)' : cr.status === 'PENDING' ? 'var(--ag-warning)' : 'var(--ag-danger)'
                          }}>
                            {cr.status === 'PAID' ? ' Encaissé' : cr.status === 'PENDING' ? ' En attente' : cr.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--ag-text-secondary)', fontFamily: 'monospace' }}>
                          {cr.note || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTENU ONGLET 4 : COMMISSIONS SUPER ADMIN */}
        {activeTab === 'commissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Bannière explicative & Modèle de facturation */}
            <div style={{
              backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
              borderRadius: '16px', padding: '20px 24px', boxShadow: 'var(--ag-card-shadow)',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.03) 0%, rgba(245,158,11,0.03) 100%)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '10px',
                    backgroundColor: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ef4444'
                  }}>
                    <Percent size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                      Redevances & Commissions Dues à Mon Colis
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--ag-text-secondary)' }}>
                      Relevé transparent de vos obligations financières envers la plateforme pour vos livraisons achevées et vos locations d&apos;entrepôt.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="agency-badge" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: '800' }}>
                    Type: {commissionsData?.agency?.billing_type || commissionsData?.agency?.billingType || 'Commission'} ({commissionsData?.agency?.billing_value ?? commissionsData?.agency?.billingValue ?? 15}%)
                  </span>
                  <span className="agency-badge" style={{ backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)' }}>
                    Agence: {commissionsData?.agency?.name || user?.name || 'Mon Agence'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3 Cartes KPI Clés */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {/* Carte 1 : Total Dû à Mon Colis */}
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: '#ef4444', opacity: 0.08, borderRadius: '0 0 0 60px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Dû à Mon Colis
                  </span>
                  <DollarSign size={18} color="#ef4444" />
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ef4444' }}>
                  ${Number(commissionsData?.summary?.totalCommissionDue ?? 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
                  CA brut total : ${Number(commissionsData?.summary?.totalGrossRevenue ?? 0).toFixed(2)} | Net agence : ${Number(commissionsData?.summary?.totalNetAgency ?? 0).toFixed(2)} $
                </div>
              </div>

              {/* Carte 2 : Dû sur Livraisons */}
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: '#f59e0b', opacity: 0.08, borderRadius: '0 0 0 60px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Dû sur Livraisons
                  </span>
                  <PackageCheck size={18} color="#f59e0b" />
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ag-text-primary)' }}>
                  ${Number(commissionsData?.deliveries?.totalDeliveryCommission ?? commissionsData?.deliveries?.commissionDue ?? 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
                  {commissionsData?.deliveries?.count ?? 0} colis livrés | Frais bruts : ${Number(commissionsData?.deliveries?.totalDeliveryFees ?? commissionsData?.deliveries?.grossRevenue ?? 0).toFixed(2)} (Net : ${Number(commissionsData?.deliveries?.totalNetDeliveryAgency ?? commissionsData?.deliveries?.netAgency ?? 0).toFixed(2)} $)
                </div>
              </div>

              {/* Carte 3 : Dû sur Entrepôts & Stockage */}
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: '#8b5cf6', opacity: 0.08, borderRadius: '0 0 0 60px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Dû sur Entrepôt & Stockage
                  </span>
                  <Warehouse size={18} color="#8b5cf6" />
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ag-text-primary)' }}>
                  ${Number(commissionsData?.warehouse?.totalWarehouseCommission ?? commissionsData?.warehouse?.commissionDue ?? 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', marginTop: '4px' }}>
                  {commissionsData?.warehouse?.count ?? commissionsData?.warehouse?.activeCount ?? 0} souscriptions | Loyers bruts : ${Number(commissionsData?.warehouse?.totalRentFees ?? commissionsData?.warehouse?.grossRevenue ?? 0).toFixed(2)} (Net : ${Number(commissionsData?.warehouse?.totalNetWarehouseAgency ?? commissionsData?.warehouse?.netAgency ?? 0).toFixed(2)} $)
                </div>
              </div>
            </div>

            {/* Sous-filtres */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setCommissionsFilter('all')}
                style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: commissionsFilter === 'all' ? 'var(--ag-brand)' : 'var(--ag-surface-hover)',
                  color: commissionsFilter === 'all' ? '#fff' : 'var(--ag-text-secondary)',
                  fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Toutes les commissions ({Number(commissionsData?.deliveries?.count ?? 0) + Number(commissionsData?.warehouse?.count ?? commissionsData?.warehouse?.totalCount ?? 0)})
              </button>
              <button
                onClick={() => setCommissionsFilter('deliveries')}
                style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: commissionsFilter === 'deliveries' ? 'var(--ag-brand)' : 'var(--ag-surface-hover)',
                  color: commissionsFilter === 'deliveries' ? '#fff' : 'var(--ag-text-secondary)',
                  fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Livraisons ({commissionsData?.deliveries?.count ?? 0})
              </button>
              <button
                onClick={() => setCommissionsFilter('warehouse')}
                style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: commissionsFilter === 'warehouse' ? 'var(--ag-brand)' : 'var(--ag-surface-hover)',
                  color: commissionsFilter === 'warehouse' ? '#fff' : 'var(--ag-text-secondary)',
                  fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Location Entrepôt ({commissionsData?.warehouse?.count ?? commissionsData?.warehouse?.totalCount ?? 0})
              </button>
            </div>

            {/* Tableau 1 : Commissions sur Livraisons */}
            {(commissionsFilter === 'all' || commissionsFilter === 'deliveries') && (
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--ag-card-shadow)'
              }}>
                <div style={{
                  padding: '16px 20px', borderBottom: '1px solid var(--ag-border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--ag-surface-hover)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PackageCheck size={18} color="#f59e0b" />
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                      Commissions sur Livraisons de Colis ({commissionsData?.deliveries?.count ?? 0})
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                    Total Dû : <strong>${Number(commissionsData?.deliveries?.totalDeliveryCommission ?? commissionsData?.deliveries?.commissionDue ?? 0).toFixed(2)}</strong>
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="agency-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)' }}>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Code Suivi</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Vendeur</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Date Livraison</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Frais Livraison Brut</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Taux Appliqué</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>Commission Mon Colis (Dû)</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>Net Revenu Agence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!commissionsData?.deliveries?.items || commissionsData.deliveries.items.length === 0) ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ag-text-muted)', fontSize: '0.85rem' }}>
                            Aucun colis livré enregistré pour le moment.
                          </td>
                        </tr>
                      ) : (
                        commissionsData.deliveries.items.map((item: any) => {
                          const deliveryFee = Number(item.delivery_price ?? item.deliveryPrice ?? 0);
                          const commRate = Number(item.commission_rate ?? item.commissionRate ?? 0);
                          const commAmount = Number(item.commission_amount ?? item.commissionAmount ?? 0);
                          const netAgency = Number(item.net_agency ?? item.netAgency ?? (deliveryFee - commAmount));
                          const tracking = item.tracking_code || item.trackingCode || '—';
                          const vendor = item.vendor_name || item.vendorName || '—';
                          const delDate = item.delivered_at || item.date || item.created_at;

                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--ag-border)' }}>
                              <td style={{ padding: '12px 16px', fontWeight: '700', fontSize: '0.82rem', color: 'var(--ag-text-primary)', fontFamily: 'monospace' }}>
                                {tracking}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--ag-text-primary)' }}>
                                {vendor}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--ag-text-secondary)' }}>
                                {delDate ? new Date(delDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--ag-text-primary)' }}>
                                ${deliveryFee.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--ag-text-muted)' }}>
                                <span className="agency-badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                                  {commRate}%
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.88rem', fontWeight: '800', color: '#ef4444' }}>
                                -${commAmount.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.88rem', fontWeight: '800', color: '#10b981' }}>
                                +${netAgency.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tableau 2 : Commissions sur Location d'Entrepôt */}
            {(commissionsFilter === 'all' || commissionsFilter === 'warehouse') && (
              <div style={{
                backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
                borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--ag-card-shadow)'
              }}>
                <div style={{
                  padding: '16px 20px', borderBottom: '1px solid var(--ag-border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--ag-surface-hover)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Warehouse size={18} color="#8b5cf6" />
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '800', color: 'var(--ag-text-primary)' }}>
                      Commissions sur Location d&apos;Entrepôt ({commissionsData?.warehouse?.count ?? commissionsData?.warehouse?.totalCount ?? 0})
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ag-text-muted)' }}>
                    Total Dû : <strong>${Number(commissionsData?.warehouse?.totalWarehouseCommission ?? commissionsData?.warehouse?.commissionDue ?? 0).toFixed(2)}</strong>
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="agency-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)' }}>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Espace de Stockage</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Vendeur Locataire</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Emplacements</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Loyer Brut Perçu</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--ag-text-muted)', textTransform: 'uppercase' }}>Taux Appliqué</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>Commission Mon Colis (Dû)</th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>Net Revenu Agence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!commissionsData?.warehouse?.items || commissionsData.warehouse.items.length === 0) ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ag-text-muted)', fontSize: '0.85rem' }}>
                            Aucune souscription d&apos;entrepôt active enregistrée pour le moment.
                          </td>
                        </tr>
                      ) : (
                        commissionsData.warehouse.items.map((sub: any) => {
                          const spaceTitle = sub.space_title || sub.spaceName || 'Emplacement';
                          const vendor = sub.vendor_name || sub.vendorName || 'Vendeur';
                          const slots = sub.slots || sub.slotsCount || 1;
                          const rentPaid = Number(sub.price_paid ?? sub.pricePaid ?? 0);
                          const commRate = Number(sub.commission_rate ?? sub.commissionRate ?? 0);
                          const commAmount = Number(sub.commission_amount ?? sub.commissionAmount ?? 0);
                          const netAgency = Number(sub.net_agency_amount ?? sub.netAgencyAmount ?? (rentPaid - commAmount));

                          return (
                            <tr key={sub.id} style={{ borderBottom: '1px solid var(--ag-border)' }}>
                              <td style={{ padding: '12px 16px', fontWeight: '700', fontSize: '0.82rem', color: 'var(--ag-text-primary)' }}>
                                {spaceTitle}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--ag-text-primary)' }}>
                                {vendor}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--ag-text-secondary)' }}>
                                {slots} emplacement{slots > 1 ? 's' : ''}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--ag-text-primary)' }}>
                                ${rentPaid.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--ag-text-muted)' }}>
                                <span className="agency-badge" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                                  {commRate}%
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.88rem', fontWeight: '800', color: '#ef4444' }}>
                                -${commAmount.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '0.88rem', fontWeight: '800', color: '#10b981' }}>
                                +${netAgency.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL OUVERTURE DE CAISSE ─────────────────────────────────────── */}
      {openModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                backgroundColor: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ag-success)'
              }}>
                <Unlock size={20} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--ag-text-primary)' }}>
                Ouvrir une Session de Caisse
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 18px' }}>
              Enregistrez le fond de caisse physique de départ pour démarrer la journée en toute conformité :
            </p>

            <form onSubmit={handleConfirmOpenSession} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px', color: 'var(--ag-text-primary)' }}>
                   Fond de caisse initial en Dollars USD ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openFundUSD}
                  onChange={e => setOpenFundUSD(e.target.value)}
                  placeholder="Ex : 50.00"
                  style={{
                    width: '100%', height: '42px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '1rem', fontWeight: '800', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px', color: 'var(--ag-text-primary)' }}>
                   Fond de caisse initial en Francs Congolais CDF (FC)
                </label>
                <input
                  type="number"
                  step="500"
                  min="0"
                  required
                  value={openFundCDF}
                  onChange={e => setOpenFundCDF(e.target.value)}
                  placeholder="Ex : 150000"
                  style={{
                    width: '100%', height: '42px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '1rem', fontWeight: '800', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px', color: 'var(--ag-text-primary)' }}>
                   Responsable de Caisse / Caissier
                </label>
                <input
                  type="text"
                  required
                  value={openAgentName}
                  onChange={e => setOpenAgentName(e.target.value)}
                  placeholder="Nom de l'agent caissier"
                  style={{
                    width: '100%', height: '42px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '0.9rem', fontWeight: '600', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setOpenModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                    backgroundColor: 'transparent', color: 'var(--ag-text-secondary)', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-success)', color: '#000', fontWeight: '800', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Unlock size={15} /> Valider l&apos;ouverture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CLÔTURE DE CAISSE (BILLETAGE) ─────────────────────────── */}
      {closeModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Comptage Physique de Caisse (Billetage)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Comptez le cash réel en tiroir-caisse dans chacune des deux devises :
            </p>

            <form onSubmit={handleCloseSession} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  <span>Espèces réelles en USD ($)</span>
                  <span style={{ color: 'var(--ag-text-muted)' }}>Attendu : ${cashSession.expectedUSD}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={countedUSD}
                  onChange={e => setCountedUSD(e.target.value)}
                  style={{
                    width: '100%', height: '42px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '1rem', fontWeight: '800', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  <span>Espèces réelles en CDF (FC)</span>
                  <span style={{ color: 'var(--ag-text-muted)' }}>Attendu : {cashSession.expectedCDF} FC</span>
                </label>
                <input
                  type="number"
                  step="500"
                  required
                  value={countedCDF}
                  onChange={e => setCountedCDF(e.target.value)}
                  style={{
                    width: '100%', height: '42px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '1rem', fontWeight: '800', boxSizing: 'border-box'
                  }}
                />
              </div>

              {hasDiscrepancy && (
                <div style={{
                  backgroundColor: 'var(--ag-warning-bg)', border: '1px solid var(--ag-warning)',
                  borderRadius: '10px', padding: '12px'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--ag-warning)', marginBottom: '4px' }}>
                     Écart détecté : {diffUSD !== 0 ? `USD ${diffUSD > 0 ? '+' : ''}${diffUSD.toFixed(2)} ` : ''} {diffCDF !== 0 ? `CDF ${diffCDF > 0 ? '+' : ''}${diffCDF} FC` : ''}
                  </div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--ag-text-secondary)', marginBottom: '4px' }}>
                    Motif obligatoire de l'écart :
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={discrepancyReason}
                    onChange={e => setDiscrepancyReason(e.target.value)}
                    placeholder="Ex: Monnaie rendue manquante, pourboire client, billet abîmé..."
                    style={{
                      width: '100%', padding: '8px', borderRadius: '6px',
                      border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                      color: 'var(--ag-text-primary)', fontSize: '0.8rem', resize: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCloseModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                    backgroundColor: 'transparent', color: 'var(--ag-text-secondary)', fontWeight: '600'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={hasDiscrepancy && !discrepancyReason.trim()}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-brand)', color: '#fff', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Valider la clôture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL PAIEMENT VENDEUR ───────────────────────────────────────── */}
      {payVendorModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--ag-card-shadow-hover)', animation: 'agFadeIn 0.15s ease'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Payer le vendeur {payVendorModal.vendor?.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-secondary)', margin: '0 0 16px' }}>
              Solde disponible : <strong>{formatPrice(payVendorModal.amount_owed_to_vendor)}</strong>
            </p>

            <form onSubmit={handleExecuteVendorPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Montant à verser ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={payVendorModal.amount_owed_to_vendor}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  style={{
                    width: '100%', height: '42px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontSize: '1.1rem', fontWeight: '900', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '4px' }}>
                  Mode de règlement *
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  style={{
                    width: '100%', height: '42px', borderRadius: '8px',
                    border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface-hover)',
                    color: 'var(--ag-text-primary)', padding: '0 12px', fontWeight: '700', boxSizing: 'border-box'
                  }}
                >
                  <option value="CASH">Espèces en main au guichet</option>
                  <option value="AIRTEL_MONEY">Airtel Money</option>
                  <option value="ORANGE_MONEY">Orange Money</option>
                  <option value="MPESA">M-Pesa</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setPayVendorModal(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                    backgroundColor: 'transparent', color: 'var(--ag-text-secondary)', fontWeight: '600'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--ag-success)', color: '#000', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  {paying ? 'Validation...' : 'Confirmer le paiement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL REÇU DE PAIEMENT VENDEUR ───────────────────────────────── */}
      {paymentSuccessReceipt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 120, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px',
            textAlign: 'center', boxShadow: 'var(--ag-card-shadow-hover)'
          }}>
            <CheckCircle2 size={36} color="var(--ag-success)" style={{ margin: '0 auto 8px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--ag-text-primary)', margin: '0 0 4px' }}>
              Reçu de Paiement Vendeur
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--ag-text-muted)', margin: '0 0 16px' }}>
              Réf : {paymentSuccessReceipt.reference}
            </p>

            {/* Code OTP généré pour confirmation vendeur */}
            {paymentSuccessReceipt.otp && (
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px dashed #f59e0b',
                borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#f59e0b', fontWeight: '800', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                   Code OTP à communiquer au vendeur
                </span>
                <span style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '6px', color: '#f59e0b', fontFamily: 'monospace' }}>
                  {paymentSuccessReceipt.otp}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', display: 'block', marginTop: '4px' }}>
                  Le vendeur doit saisir ce code dans son tableau Finance pour confirmer la réception du versement.
                </span>
              </div>
            )}

            <div style={{
              backgroundColor: 'var(--ag-surface-hover)', borderRadius: '10px',
              padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--ag-text-muted)' }}>Bénéficiaire :</span>
                <strong>{paymentSuccessReceipt.vendorName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--ag-text-muted)' }}>Montant réglé :</span>
                <strong style={{ color: 'var(--ag-brand)', fontSize: '1.1rem' }}>{formatPrice(paymentSuccessReceipt.amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--ag-text-muted)' }}>Moyen :</span>
                <strong>{paymentSuccessReceipt.method}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--ag-text-muted)' }}>Date :</span>
                <span>{new Date(paymentSuccessReceipt.date).toLocaleString('fr-FR')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-primary)',
                  fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Printer size={16} /> Imprimer reçu
              </button>
              <button
                onClick={() => setPaymentSuccessReceipt(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'var(--ag-brand)', color: '#fff', fontWeight: '800', cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL VISUALISATION & IMPRESSION PV DE CLÔTURE DE CAISSE ────── */}
      {viewingReceiptModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 120, backgroundColor: 'var(--ag-modal-overlay)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '580px',
            boxShadow: 'var(--ag-card-shadow-hover)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--ag-border)', paddingBottom: '14px', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--ag-brand-subtle)', color: 'var(--ag-brand)', fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  DOCUMENT OFFICIEL CERTIFIÉ
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: 'var(--ag-text-primary)' }}>
                  Procès-Verbal de Clôture de Caisse
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--ag-text-muted)', fontFamily: 'monospace' }}>
                  Réf. {viewingReceiptModal.reference}
                </span>
              </div>
              <button
                onClick={() => setViewingReceiptModal(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--ag-text-muted)',
                  cursor: 'pointer', padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Détails Horodatage & Caissiers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px', backgroundColor: 'var(--ag-surface-hover)', padding: '14px', borderRadius: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Ouverture</span>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', marginTop: '2px' }}>
                  {new Date(viewingReceiptModal.openedAt).toLocaleDateString('fr-FR')} à {new Date(viewingReceiptModal.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>
                  Par: <strong>{viewingReceiptModal.openedBy || 'Agent Caisse'}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Clôture</span>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', marginTop: '2px' }}>
                  {new Date(viewingReceiptModal.closedAt).toLocaleDateString('fr-FR')} à {new Date(viewingReceiptModal.closedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>
                  Par: <strong>{viewingReceiptModal.closedBy || 'Agent Caisse'}</strong>
                </div>
              </div>
            </div>

            {/* Comparatif Chiffré Billetage USD & CDF */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              {/* Colonne USD */}
              <div style={{ border: '1px solid var(--ag-border)', borderRadius: '10px', padding: '14px', backgroundColor: 'rgba(16,185,129,0.03)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Devise USD ($)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ag-text-muted)' }}>Fond initial :</span>
                    <strong>${Number(viewingReceiptModal.openingUSD || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ag-text-muted)' }}>Montant attendu :</span>
                    <strong>${Number(viewingReceiptModal.expectedUSD || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--ag-border)', paddingTop: '4px' }}>
                    <span style={{ color: 'var(--ag-text-primary)', fontWeight: '700' }}>Compté physique :</span>
                    <strong style={{ fontSize: '0.95rem' }}>${Number(viewingReceiptModal.countedUSD || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ color: 'var(--ag-text-muted)' }}>Écart :</span>
                    <span style={{
                      fontWeight: '800',
                      color: Math.abs(viewingReceiptModal.diffUSD) < 0.01 ? 'var(--ag-success)' : 'var(--ag-danger)'
                    }}>
                      {Math.abs(viewingReceiptModal.diffUSD) < 0.01 ? '0.00 (Conforme)' : `${viewingReceiptModal.diffUSD > 0 ? '+' : ''}$${viewingReceiptModal.diffUSD.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Colonne CDF */}
              <div style={{ border: '1px solid var(--ag-border)', borderRadius: '10px', padding: '14px', backgroundColor: 'rgba(245,158,11,0.03)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Devise CDF (FC)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ag-text-muted)' }}>Fond initial :</span>
                    <strong>{Number(viewingReceiptModal.openingCDF || 0).toLocaleString('fr-FR')} FC</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ag-text-muted)' }}>Montant attendu :</span>
                    <strong>{Number(viewingReceiptModal.expectedCDF || 0).toLocaleString('fr-FR')} FC</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--ag-border)', paddingTop: '4px' }}>
                    <span style={{ color: 'var(--ag-text-primary)', fontWeight: '700' }}>Compté physique :</span>
                    <strong style={{ fontSize: '0.95rem' }}>{Number(viewingReceiptModal.countedCDF || 0).toLocaleString('fr-FR')} FC</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ color: 'var(--ag-text-muted)' }}>Écart :</span>
                    <span style={{
                      fontWeight: '800',
                      color: Math.abs(viewingReceiptModal.diffCDF) < 500 ? 'var(--ag-success)' : 'var(--ag-danger)'
                    }}>
                      {Math.abs(viewingReceiptModal.diffCDF) < 500 ? '0 FC (Conforme)' : `${viewingReceiptModal.diffCDF > 0 ? '+' : ''}${viewingReceiptModal.diffCDF} FC`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Observations / Justification */}
            <div style={{
              backgroundColor: 'var(--ag-surface-hover)', borderRadius: '8px',
              padding: '12px 14px', marginBottom: '20px', border: '1px solid var(--ag-border)'
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '2px' }}>
                Observations & Justification des écarts
              </span>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ag-text-primary)' }}>
                {viewingReceiptModal.reason || 'Aucune observation particulière. Caisse parfaitement balancée.'}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-brand)', color: '#fff',
                  fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Printer size={16} /> Imprimer ce Procès-Verbal
              </button>
              <button
                onClick={() => setViewingReceiptModal(null)}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface-hover)', color: 'var(--ag-text-secondary)',
                  fontWeight: '700', cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </AgencyShell>
  );
}
