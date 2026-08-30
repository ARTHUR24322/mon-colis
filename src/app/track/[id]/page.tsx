'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Lock, XCircle, CheckCircle } from 'lucide-react';

/* ─────────────────────────────────────────────
   Données simulées (remplacer par Supabase)
───────────────────────────────────────────── */
const FAKE_DB: Record<string, any> = {
  'demo-client': {
    id: 'demo-client',
    role: 'client',
    expired: false,
    clientName: 'Amina Diallo',
    clientPhone: '+243 81 11 22 334',
    clientAddress: 'Gombe, Kinshasa',
    prixLivraison: 3.5,
    agenceName: 'Express Delivery',
    livreurName: 'Trésor Makambo',
    livreurPhone: '+243 81 44 55 660',
    otp: '847392',
    linkedKey: 'demo-livreur',
  },
  'demo-livreur': {
    id: 'demo-livreur',
    role: 'livreur',
    expired: false,
    clientName: 'Amina Diallo',
    clientPhone: '+243 81 11 22 334',
    clientAddress: 'Gombe, Kinshasa',
    prixLivraison: 3.5,
    agenceName: 'Express Delivery',
    livreurName: 'Trésor Makambo',
    otp: '847392',
    linkedKey: 'demo-client',
  },
};

/* ─────────────────────────────────────────────
   Wrapper Suspense pour useSearchParams
───────────────────────────────────────────── */
export default function TrackingPageWrapper() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TrackingPage />
    </Suspense>
  );
}

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page principale
───────────────────────────────────────────── */
function TrackingPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const id           = params.id as string;
  const role         = searchParams.get('role') as 'client' | 'livreur' | null;

  const [loading,   setLoading]   = useState(true);
  const [data,      setData]      = useState<any>(null);
  const [expired,   setExpired]   = useState(false);
  const [otpInput,  setOtpInput]  = useState('');
  const [otpError,  setOtpError]  = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [checking,  setChecking]  = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const record = FAKE_DB[id];
      if (!record) { setLoading(false); return; }
      if (record.expired) { setExpired(true); setLoading(false); return; }
      setData(record);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [id]);

  /* Validation OTP par le livreur */
  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setOtpError('');

    setTimeout(() => {
      if (otpInput.trim() === data.otp) {
        // Expire les deux liens (livreur + client)
        FAKE_DB[id].expired = true;
        if (data.linkedKey && FAKE_DB[data.linkedKey]) {
          FAKE_DB[data.linkedKey].expired = true;
        }
        setConfirmed(true);
      } else {
        setOtpError('Code incorrect. Veuillez réessayer.');
      }
      setChecking(false);
    }, 800);
  };

  /* ── LOADING ── */
  if (loading) {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <Spinner />
          <p style={{ opacity: 0.6, marginTop: '1rem' }}>Chargement en cours…</p>
        </div>
      </PageShell>
    );
  }

  /* ── LIEN EXPIRÉ ── */
  if ((expired || data?.expired) && !confirmed) {
    return (
      <PageShell role={role}>
        <StatusBlock
          icon={<Lock size={48} color="#ef4444" />}
          title="Lien expiré"
          color="#ef4444"
          message="Ce lien n'est plus valide. La livraison a déjà été confirmée. Pour des raisons de sécurité, chaque lien ne peut être utilisé qu'une seule fois."
        />
      </PageShell>
    );
  }

  /* ── INTROUVABLE ── */
  if (!data) {
    return (
      <PageShell role={role}>
        <StatusBlock
          icon={<XCircle size={48} color="#ef4444" />}
          title="Lien invalide"
          color="#ef4444"
          message="Ce lien ne correspond à aucun colis. Veuillez vérifier l'URL reçue."
        />
      </PageShell>
    );
  }

  /* ── CONFIRMATION RÉUSSIE ── */
  if (confirmed) {
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
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#22c55e', marginBottom: '0.5rem' }}>
              Livraison confirmée !
            </h2>
            <p style={{ opacity: 0.6, fontSize: '0.88rem', lineHeight: 1.7 }}>
              Le colis a été remis avec succès au client.<br />
              Ce lien est maintenant <strong style={{ color: '#ef4444' }}>expiré</strong> et ne peut plus être utilisé.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── VUE CLIENT ── */
  if (role === 'client' || !role) {
    return (
      <PageShell role="client">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <StatutBadge label="En cours de livraison" color="var(--primary)" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.25)" />

          <InfoRow label="Prix de la livraison"  value={`${data.prixLivraison.toLocaleString('fr-FR')} USD (${Math.round(data.prixLivraison * 2850).toLocaleString('fr-FR')} FC)`} highlight />
          <InfoRow label="Agence de livraison"   value={data.agenceName} />
          <InfoRow label="Nom du livreur"         value={data.livreurName} />
          <InfoRow label="Téléphone du livreur"   value={data.livreurPhone} />

          {/* Code OTP */}
          <div style={{
            textAlign: 'center',
            background: 'rgba(59,130,246,0.08)',
            border: '2px dashed rgba(59,130,246,0.4)',
            borderRadius: '18px', padding: '1.5rem', marginTop: '0.25rem',
          }}>
            <p style={{ fontSize: '0.75rem', opacity: 0.55, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              CODE À REMETTRE AU LIVREUR
            </p>
            <p style={{ fontSize: '2.8rem', fontWeight: '900', letterSpacing: '10px', color: '#3b82f6', margin: '0 0 0.5rem' }}>
              {data.otp}
            </p>
            <p style={{ fontSize: '0.72rem', opacity: 0.4, lineHeight: 1.5 }}>
              Ne donnez ce code qu'au moment où le livreur est devant vous
            </p>
          </div>

          <div style={{
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '12px', padding: '0.9rem 1rem', fontSize: '0.8rem', lineHeight: 1.6, color: '#f59e0b',
          }}>
            <strong>Important :</strong> Ce lien expirera automatiquement une fois la livraison confirmée par le livreur.
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── VUE LIVREUR ── */
  return (
    <PageShell role="livreur">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <StatutBadge label="Mission de livraison" color="#3b82f6" bg="rgba(59,130,246,0.08)" border="rgba(59,130,246,0.25)" />

        <InfoRow label="Nom du client"      value={data.clientName} />
        <InfoRow label="Téléphone client"   value={data.clientPhone} />
        <InfoRow label="Adresse livraison"  value={data.clientAddress} />
        <InfoRow label="Agence"             value={data.agenceName} />

        {/* Saisie OTP */}
        <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', opacity: 0.8 }}>
            Code de confirmation (reçu du client)
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
              fontSize: '2.2rem',
              letterSpacing: '10px',
              fontWeight: '900',
              padding: '1rem',
              border: otpError ? '1px solid #ef4444' : undefined,
            }}
            required
          />
          {otpError && (
            <p style={{ color: '#ef4444', fontSize: '0.82rem', textAlign: 'center', margin: 0, fontWeight: '600' }}>
              {otpError}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={checking || otpInput.length < 6}
            style={{
              opacity: (checking || otpInput.length < 6) ? 0.45 : 1,
              fontSize: '1rem', padding: '0.85rem',
              transition: 'opacity 0.2s',
            }}
          >
            {checking ? 'Vérification en cours…' : 'Confirmer la livraison'}
          </button>
        </form>

        <p style={{ fontSize: '0.72rem', opacity: 0.35, textAlign: 'center', lineHeight: 1.6 }}>
          Ce lien expirera immédiatement après confirmation pour des raisons de sécurité.
        </p>
      </div>
    </PageShell>
  );
}

/* ─────────────────────────────────────────────
   Composants utilitaires
───────────────────────────────────────────── */

function PageShell({ children, role }: { children: React.ReactNode; role?: string | null }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
      background: role === 'livreur'
        ? 'radial-gradient(ellipse at top, rgba(59,130,246,0.06) 0%, transparent 60%)'
        : 'radial-gradient(ellipse at top, rgba(34,197,94,0.06) 0%, transparent 60%)',
    }}>
      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '440px', width: '100%',
        padding: '2.5rem', borderRadius: '24px',
      }}>
        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: '900',
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Moncolis
          </h1>
          <p style={{ opacity: 0.45, fontSize: '0.78rem', marginTop: '0.2rem' }}>
            {role === 'livreur' ? 'Espace Livreur' : 'Suivi de livraison'}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatutBadge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <div style={{ textAlign: 'center', background: bg, border: `1px solid ${border}`, borderRadius: '14px', padding: '0.9rem' }}>
      <p style={{ fontSize: '0.72rem', opacity: 0.55, marginBottom: '0.25rem', letterSpacing: '0.04em' }}>STATUT</p>
      <p style={{ fontWeight: '800', color, fontSize: '1rem', margin: 0 }}>{label}</p>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.75rem 1rem', borderRadius: '12px', gap: '1rem',
      background: highlight ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${highlight ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <span style={{ fontSize: '0.8rem', opacity: 0.55, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontWeight: '700', fontSize: '0.9rem', color: highlight ? 'var(--primary)' : 'inherit', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function StatusBlock({ icon, title, color, message }: { icon: React.ReactNode; title: string; color: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
      <div style={{ lineHeight: 1 }}>{icon}</div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color, margin: 0 }}>{title}</h2>
      <p style={{ opacity: 0.6, fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>{message}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '50%',
      border: '3px solid rgba(255,255,255,0.1)',
      borderTop: '3px solid var(--primary)',
      animation: 'spin 0.8s linear infinite',
      margin: '0 auto',
    }} />
  );
}
