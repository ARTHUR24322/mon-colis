'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Truck, ArrowLeft, ShieldCheck, Lock, Mail, User, Phone, MapPin, CheckCircle2 } from 'lucide-react';

export default function GlobalRegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'vendeur' | 'agence'>('vendeur');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (role === 'vendeur') {
        router.push('/dashboard/vendeur');
      } else {
        router.push('/dashboard/agence');
      }
    }, 1000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'radial-gradient(circle at 50% 20%, rgba(34, 197, 94, 0.08), transparent 60%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.06), transparent 50%), #07090e'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem'
      }}>
        {/* Back Link */}
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          color: '#94a3b8',
          transition: 'color 0.2s ease',
          alignSelf: 'flex-start'
        }}>
          <ArrowLeft size={16} />
          Retour à l'accueil
        </Link>

        {/* Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2.5rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Brand header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: role === 'vendeur' 
                ? 'linear-gradient(135deg, #22c55e, #10b981)' 
                : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              margin: '0 auto 1rem auto',
              boxShadow: role === 'vendeur' 
                ? '0 8px 20px rgba(34, 197, 94, 0.35)' 
                : '0 8px 20px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.3s ease'
            }}>
              {role === 'vendeur' ? <Store size={26} /> : <Truck size={26} />}
            </div>
            
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
              Créer un compte {role === 'vendeur' ? 'Vendeur' : 'Agence'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Rejoignez le réseau logistique Moncolis dès aujourd'hui
            </p>
          </div>

          {/* Role selector tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0.35rem',
            borderRadius: '14px',
            marginBottom: '1.75rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              type="button"
              onClick={() => setRole('vendeur')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: role === 'vendeur' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                color: role === 'vendeur' ? '#4ade80' : '#94a3b8',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: role === 'vendeur' ? 'rgba(34, 197, 94, 0.4)' : 'transparent'
              }}
            >
              <Store size={16} />
              Boutique / Vendeur
            </button>

            <button
              type="button"
              onClick={() => setRole('agence')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: role === 'agence' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: role === 'agence' ? '#60a5fa' : '#94a3b8',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: role === 'agence' ? 'rgba(59, 130, 246, 0.4)' : 'transparent'
              }}
            >
              <Truck size={16} />
              Agence de Livraison
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                {role === 'vendeur' ? 'Nom de la Boutique / Nom' : 'Nom de l\'Agence de transport'}
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder={role === 'vendeur' ? 'Ex: Mode & Chic Kinshasa' : 'Ex: Swift Express Logistics'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                Adresse Email professionnelle
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="email"
                  className="input-field"
                  placeholder="contact@votre-entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                Numéro de Téléphone (WhatsApp/Appels)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+243 81 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            {role === 'agence' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                  Adresse du Siège / Dépôt Principal
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Boulevard du 30 Juin, Kinshasa"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ paddingLeft: '2.75rem' }}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                Mot de passe sécurisé
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="password"
                  className="input-field"
                  placeholder="Minimum 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>En vous inscrivant, vous acceptez les conditions générales d'utilisation et la politique de confidentialité de Moncolis.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#fff',
                background: role === 'vendeur'
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: role === 'vendeur'
                  ? '0 4px 14px rgba(34, 197, 94, 0.4)'
                  : '0 4px 14px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Création du compte...' : `Créer mon compte ${role === 'vendeur' ? 'Vendeur' : 'Agence'}`}
            </button>
          </form>

          {/* Login switch */}
          <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Vous avez déjà un compte ?{' '}
            <Link
              href={role === 'vendeur' ? '/auth/vendeur/login' : '/auth/agence/login'}
              style={{
                color: role === 'vendeur' ? '#4ade80' : '#60a5fa',
                fontWeight: '600',
                textDecoration: 'none'
              }}
            >
              Se connecter
            </Link>
          </div>
        </div>

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
          <ShieldCheck size={16} />
          <span>Protection des données et conformité RGPD</span>
        </div>
      </div>
    </div>
  );
}
