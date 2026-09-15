'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, XCircle, CheckCircle, Package, ArrowLeft, Truck, Phone, MapPin, DollarSign, ShieldCheck } from 'lucide-react';
import { dataService, ColisItem } from '@/lib/data-service';

/* ---------------------------------------------
   Wrapper Suspense pour useSearchParams
--------------------------------------------- */
export default function TrackingPageWrapper() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TrackingPage />
    </Suspense>
  );
}

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07090e' }}>
      <Spinner />
    </div>
  );
}

/* ---------------------------------------------
   Page principale
--------------------------------------------- */
function TrackingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const role = searchParams.get('role') as 'client' | 'livreur' | null;

  const [loading, setLoading] = useState(true);
  const [colis, setColis] = useState<ColisItem | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (id) {
        const found = await dataService.getPackageByTracking(id);
        setColis(found);
        if (found?.confirmed || found?.status === 'Livré') {
          setConfirmed(true);
        }
      }
      setLoading(false);
    }
    loadData();
  }, [id]);

  /* Validation OTP par le livreur */
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setOtpError('');

    if (!colis) {
      setOtpError('Colis introuvable.');
      setChecking(false);
      return;
    }

    const res = await dataService.validateDeliveryOtp(colis.id, otpInput);
    if (res.success) {
      setConfirmed(true);
      if (res.package) setColis(res.package);
    } else {
      setOtpError(res.message);
    }
    setChecking(false);
  };

  /* -- LOADING -- */
  if (loading) {
    return (
      <PageShell role={role}>
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <Spinner />
          <p style={{ opacity: 0.6, marginTop: '1rem', color: '#94a3b8' }}>Recherche du colis en cours…</p>
        </div>
      </PageShell>
    );
  }

  /* -- INTROUVABLE -- */
  if (!colis) {
    return (
      <PageShell role={role}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ef4444'
          }}>
            <XCircle size={36} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
              Colis introuvable
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
              La référence <strong>#{id}</strong> ne correspond à aucun colis enregistré. Veuillez vérifier le code et réessayer.
            </p>
            <Link href="/" className="btn btn-outline" style={{ fontSize: '0.9rem' }}>
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  /* -- CONFIRMATION RÉUSSIE -- */
  if (confirmed || colis.status === 'Livré') {
    return (
      <PageShell role={role}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.2rem', boxShadow: '0 0 40px rgba(34,197,94,0.35)',
            color: 'white',
          }}>
            <CheckCircle size={40} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#22c55e', marginBottom: '0.5rem' }}>
              Livraison confirmée !
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Le colis <strong>#{colis.id}</strong> ({colis.clientName}) a été remis avec succès au destinataire.<br />
              Statut : <strong style={{ color: '#22c55e' }}>LIVRÉ ✅</strong>
            </p>
            <Link href="/" className="btn btn-primary" style={{ fontSize: '0.9rem' }}>
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  /* -- VUE CLIENT (Par défaut) -- */
  if (role === 'client' || !role) {
    const isAvailableAtRelais = colis.status === 'Disponible au point relais' || Boolean(colis.destDropPoint);

    return (
      <PageShell role="client">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            background: isAvailableAtRelais ? 'rgba(59, 130, 246, 0.12)' : 'rgba(34, 197, 94, 0.1)',
            border: `1px solid ${isAvailableAtRelais ? 'rgba(59, 130, 246, 0.35)' : 'rgba(34, 197, 94, 0.3)'}`,
            borderRadius: '12px'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Statut du colis :</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: isAvailableAtRelais ? '#60a5fa' : '#4ade80' }}>
              {isAvailableAtRelais ? '🏪 Disponible en Point Relais' : colis.status === 'En transit' ? '🚚 En cours de livraison' : `📦 ${colis.status}`}
            </span>
          </div>

          {/* Reroute Alert / Point Relais Retrieval Card */}
          {colis.destDropPoint && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(15, 23, 42, 0.7))',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#60a5fa'
                }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#fff' }}>
                    {colis.status === 'Disponible au point relais' ? 'Colis prêt à être retiré !' : 'Point Relais de destination'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                    {colis.inaccessibilityNote ? 'Réacheminé suite à une zone difficilement accessible' : 'Retrait sécurisé en agence partenaire'}
                  </p>
                </div>
              </div>

              {colis.inaccessibilityNote && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.78rem',
                  color: '#fca5a5',
                  lineHeight: 1.5
                }}>
                  <strong>Note du livreur :</strong> {colis.inaccessibilityNote}
                </div>
              )}

              <div style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Point Relais :</span>
                  <strong style={{ color: '#fff' }}>{colis.destDropPoint.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Commune :</span>
                  <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{colis.destDropPoint.commune}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ color: '#94a3b8', flexShrink: 0 }}>Adresse :</span>
                  <span style={{ color: '#e2e8f0', textAlign: 'right' }}>{colis.destDropPoint.address}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Horaires :</span>
                  <span style={{ color: '#38bdf8', fontWeight: '600' }}>{colis.destDropPoint.openingHours}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>Responsable :</span>
                  <a href={`tel:${colis.destDropPoint.phone}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={13} /> {colis.destDropPoint.managerName} ({colis.destDropPoint.phone})
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* First mile origin drop point notice */}
          {colis.originDropPoint && !colis.destDropPoint && (
            <div style={{
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.85rem'
            }}>
              <MapPin size={18} style={{ color: '#c084fc', flexShrink: 0 }} />
              <span style={{ color: '#e2e8f0' }}>
                Colis déposé au <strong>{colis.originDropPoint.name}</strong> ({colis.originDropPoint.commune}) par le vendeur.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
            <InfoRow label="Destinataire" value={colis.clientName} />
            <InfoRow label={isAvailableAtRelais ? "Adresse initiale" : "Adresse de livraison"} value={colis.clientAddress} />
            <InfoRow label="Agence responsable" value={colis.agence || 'Non assignée'} />
            <InfoRow label="Livreur assigné" value={colis.livreur ? `${colis.livreur} (${colis.livreurPhone || 'En route'})` : 'En attente d\'un livreur'} />
            <InfoRow
              label="Montant à payer"
              value={`$${(colis.prixColis + (colis.paidByClient ? (colis.deliveryPrice || colis.prixLivraison || 0) : 0)).toFixed(2)} USD (Colis: $${colis.prixColis} + Livraison: ${colis.paidByClient ? `$${colis.deliveryPrice || colis.prixLivraison || 0}` : '0$ (Payée par le vendeur)'})`}
              highlight
            />
          </div>

          {/* Code Secret OTP */}
          <div style={{
            textAlign: 'center',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '2px dashed rgba(59, 130, 246, 0.4)',
            borderRadius: '18px',
            padding: '1.5rem',
            marginTop: '0.5rem',
          }}>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: '700' }}>
              {isAvailableAtRelais ? 'Code Secret de Retrait en Point Relais (OTP)' : 'Votre Code Secret de Livraison (OTP)'}
            </p>
            <p style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '8px', color: '#3b82f6', margin: '0 0 0.5rem' }}>
              {colis.otp}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              {isAvailableAtRelais
                ? 'Présentez ce code secret au gestionnaire du point relais pour retirer votre colis en toute sécurité.'
                : 'Ne donnez ce code au livreur qu\'au moment précis de la réception de votre colis.'}
            </p>
          </div>

          <div style={{
            background: 'rgba(245, 158, 11, 0.07)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            fontSize: '0.8rem',
            lineHeight: 1.6,
            color: '#f59e0b',
          }}>
            <strong>Sécurité Moncolis :</strong> La saisie de ce code par {isAvailableAtRelais ? 'le gestionnaire du point relais' : 'le livreur'} garantit la validation immédiate et définitive de votre réception.
          </div>
        </div>
      </PageShell>
    );
  }

  /* -- VUE LIVREUR -- */
  return (
    <PageShell role="livreur">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Mission Livreur :</span>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#60a5fa' }}>
            #{colis.id}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
          <InfoRow label="Client" value={colis.clientName} />
          <InfoRow label="Téléphone" value={colis.clientPhone} />
          <InfoRow label="Adresse" value={colis.clientAddress} />
          <InfoRow label="Montant à encaisser" value={`$${(colis.prixColis + (colis.paidByClient ? (colis.deliveryPrice || colis.prixLivraison || 0) : 0)).toFixed(2)} USD`} highlight />
        </div>

        {/* Saisie OTP */}
        <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1' }}>
            Code de confirmation remis par le client :
          </label>
          <input
            className="input-field"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="• • • • • •"
            value={otpInput}
            onChange={e => {
              setOtpInput(e.target.value.replace(/\D/g, ''));
              setOtpError('');
            }}
            style={{
              textAlign: 'center',
              fontSize: '2rem',
              letterSpacing: '8px',
              fontWeight: '900',
              padding: '0.85rem',
              border: otpError ? '1px solid #ef4444' : undefined,
            }}
            required
          />
          {otpError && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', margin: 0, fontWeight: '600' }}>
              {otpError}
            </p>
          )}

          <button
            type="submit"
            disabled={checking || otpInput.length < 6}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.85rem',
              fontSize: '1rem',
              fontWeight: '700',
              marginTop: '0.5rem'
            }}
          >
            {checking ? 'Validation en cours...' : 'Valider la livraison'}
          </button>
        </form>
      </div>
    </PageShell>
  );
}

/* ---------------------------------------------
   Composants UI partagés
--------------------------------------------- */
function PageShell({ children, role }: { children: React.ReactNode; role?: string | null }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'radial-gradient(circle at 50% 20%, rgba(34, 197, 94, 0.08), transparent 60%), #07090e'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.875rem',
            color: '#94a3b8'
          }}>
            <ArrowLeft size={16} />
            Accueil Moncolis
          </Link>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            background: 'rgba(34, 197, 94, 0.1)',
            color: '#4ade80',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            <ShieldCheck size={14} />
            <span>Suivi Sécurisé</span>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2.25rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '1rem',
      padding: '0.5rem 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    }}>
      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{label}</span>
      <span style={{
        fontWeight: highlight ? '800' : '600',
        color: highlight ? '#4ade80' : '#fff',
        textAlign: 'right',
        fontSize: '0.9rem'
      }}>
        {value}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      border: '3px solid rgba(255, 255, 255, 0.1)',
      borderTopColor: '#22c55e',
      animation: 'spin 0.8s linear infinite',
      margin: '0 auto'
    }}>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
