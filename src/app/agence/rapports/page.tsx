'use client';

import { useState, useEffect } from 'react';
import AgencyShell from '@/components/agency/AgencyShell';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  BarChart3, Download, Printer, Calendar, TrendingUp,
  Package, Truck, CheckCircle2, AlertTriangle, FileText,
  MapPin, RefreshCw
} from 'lucide-react';
import { hasAgencyPermission, normalizeAgencyRole } from '@/lib/agencyPermissions';

export default function AgencyRapportsPage() {
  const { user } = useAuth('agence');
  const { formatPrice } = useCurrency();
  const userRole = normalizeAgencyRole(user?.agencyRole);
  const canExport = hasAgencyPermission(userRole, 'canExportReports');

  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [colis, setColis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agence/colis?limit=500');
      if (res.ok) {
        const data = await res.json();
        setColis(data.colis || []);
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Métriques
  const totalColis = colis.length;
  const delivered = colis.filter(c => c.status === 'DELIVERED').length;
  const deliveryRate = totalColis > 0 ? Math.round((delivered / totalColis) * 100) : 100;
  const inTransit = colis.filter(c => ['IN_TRANSIT', 'ASSIGNED_TO_DRIVER'].includes(c.status)).length;
  const rejected = colis.filter(c => c.status === 'REJECTED_BY_AGENCY').length;
  const totalRevenue = colis.reduce((sum, c) => sum + (c.prixLivraison || 0), 0);

  // Répartition par commune
  const communeCounts: Record<string, number> = {};
  colis.forEach(c => {
    const com = c.clientCommune || 'Autre';
    communeCounts[com] = (communeCounts[com] || 0) + 1;
  });
  const topCommunes = Object.entries(communeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const handleExportCSV = () => {
    const headers = ['Code Suivi', 'Client', 'Commune', 'Vendeur', 'Statut', 'Prix Colis', 'Frais Livraison', 'Livreur', 'Date'];
    const rows = colis.map(c => [
      c.trackingCode, c.clientName, c.clientCommune, c.vendeurName,
      c.status, c.prixColis, c.prixLivraison || 0,
      c.driverName || 'Non assigné', c.date
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `rapport-activite-agence-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <AgencyShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px', color: 'var(--ag-text-primary)' }}>
              Rapports d'Activité & Performance
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ag-text-secondary)' }}>
              Analyses opérationnelles des flux, taux de complétion des livraisons et exportations de données.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid var(--ag-border)', backgroundColor: 'var(--ag-surface)',
                color: 'var(--ag-text-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600'
              }}
            >
              <Printer size={15} /> Imprimer Rapport
            </button>

            {canExport && (
              <button
                onClick={handleExportCSV}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  backgroundColor: 'var(--ag-brand)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
                  boxShadow: '0 2px 6px var(--ag-brand-glow)'
                }}
              >
                <Download size={15} /> Exporter Rapport CSV
              </button>
            )}
          </div>
        </div>

        {/* Sélecteur de période */}
        <div style={{
          display: 'flex', gap: '8px', backgroundColor: 'var(--ag-surface)',
          border: '1px solid var(--ag-border)', borderRadius: '10px', padding: '4px', width: 'fit-content'
        }}>
          {[
            { id: 'today', label: 'Aujourd’hui' },
            { id: '7d', label: '7 derniers jours' },
            { id: '30d', label: '30 derniers jours' },
            { id: 'all', label: 'Tout l’historique' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              style={{
                border: 'none',
                backgroundColor: period === p.id ? 'var(--ag-brand)' : 'transparent',
                color: period === p.id ? '#fff' : 'var(--ag-text-secondary)',
                padding: '6px 14px', borderRadius: '7px', fontSize: '0.78rem',
                fontWeight: period === p.id ? '700' : '600', cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Cartes KPI Performance */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              Volume Total Traité
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ag-text-primary)', margin: '4px 0' }}>
              {totalColis}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>Colis enregistrés</div>
          </div>

          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              Taux de Réussite
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ag-success)', margin: '4px 0' }}>
              {deliveryRate}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>{delivered} colis livrés avec succès</div>
          </div>

          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              En Cours de Livraison
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#06b6d4', margin: '4px 0' }}>
              {inTransit}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>Assignés aux coursiers</div>
          </div>

          <div style={{
            backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
            borderRadius: '14px', padding: '18px', boxShadow: 'var(--ag-card-shadow)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              Revenus Frais Agence
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ag-brand)', margin: '4px 0' }}>
              {formatPrice(totalRevenue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ag-text-secondary)' }}>Gains cumulés sur livraisons</div>
          </div>
        </div>

        {/* Répartition géographique des livraisons */}
        <div style={{
          backgroundColor: 'var(--ag-surface)', border: '1px solid var(--ag-border)',
          borderRadius: '14px', padding: '24px', boxShadow: 'var(--ag-card-shadow)'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 16px', color: 'var(--ag-text-primary)' }}>
            Top Communes de Destination (Kinshasa)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {topCommunes.map(([commune, count]) => {
              const percent = totalColis > 0 ? Math.round((count / totalColis) * 100) : 0;
              return (
                <div key={commune} style={{
                  padding: '12px 16px', borderRadius: '10px',
                  backgroundColor: 'var(--ag-surface-hover)', border: '1px solid var(--ag-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--ag-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="var(--ag-brand)" /> {commune}
                    </span>
                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--ag-brand)' }}>
                      {count} colis ({percent}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--ag-border)', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--ag-brand)', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AgencyShell>
  );
}
