'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Truck, ArrowLeft, Lock, Mail, User, Phone, MapPin, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const params = useParams();
  
  // Safe role unwrapping
  const rawRole = params?.role;
  const role = (Array.isArray(rawRole) ? rawRole[0] : rawRole) || 'vendeur';
  const isAgence = role === 'agence';
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone, address, zone, description, role }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création du compte.');
        setLoading(false);
        return;
      }

      // Redirect to the right dashboard after registration
      if (isAgence) {
        window.location.href = '/dashboard/agence';
      } else {
        window.location.href = '/dashboard/vendeur';
      }
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
      setLoading(false);
    }
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
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: isAgence 
                ? 'linear-gradient(135deg, #2563eb, #3b82f6)' 
                : 'linear-gradient(135deg, #22c55e, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              margin: '0 auto 1rem auto',
              boxShadow: isAgence 
                ? '0 8px 20px rgba(37, 99, 235, 0.35)' 
                : '0 8px 20px rgba(34, 197, 94, 0.35)'
            }}>
              {isAgence ? <Truck size={28} /> : <Store size={28} />}
            </div>
            
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
              Créer un compte {isAgence ? 'Agence' : 'Vendeur'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Rejoignez le réseau logistique Moncolis dès aujourd'hui
            </p>
          </div>

          {/* Role switcher tabs */}
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
            <Link
              href="/auth/vendeur/register"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: !isAgence ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                color: !isAgence ? '#4ade80' : '#94a3b8',
                border: !isAgence ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent',
                textDecoration: 'none'
              }}
            >
              <Store size={16} />
              Vendeur
            </Link>

            <Link
              href="/auth/agence/register"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: isAgence ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: isAgence ? '#60a5fa' : '#94a3b8',
                border: isAgence ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                textDecoration: 'none'
              }}
            >
              <Truck size={16} />
              Agence
            </Link>
          </div>
          
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                {isAgence ? 'Nom de l\'Agence de livraison' : 'Nom de la Boutique / Vendeur'}
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={isAgence ? "Fast Express Logistics" : "Mode & Tech Boutique"} 
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
                  placeholder="contact@exemple.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required 
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                Numéro de Téléphone (WhatsApp/Contact)
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

            {/* Adresse — obligatoire pour TOUS */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1' }}>
                <span style={{ color: '#ef4444' }}>*</span>{' '}
                {isAgence ? 'Adresse du Dépôt / Siège de l\'Agence' : 'Adresse exacte de la Boutique / Lieu d\'activité'}
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={isAgence ? "Boulevard du 30 Juin, Gombe, Kinshasa" : "Avenue Kasa-Vubu, Commune de Kinshasa"} 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required 
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', marginLeft: '0.25rem' }}>
                {isAgence
                  ? 'Adresse où les vendeurs déposent les colis et où les livreurs viennent les récupérer.'
                  : 'Adresse où le livreur viendra récupérer les colis de votre boutique.'}
              </p>
            </div>

            {/* Quartier / Zone géographique */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1' }}>
                <span style={{ color: '#ef4444' }}>*</span>{' '}
                {isAgence ? 'Zone de couverture (communes desservies)' : 'Quartier / Commune'}
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={isAgence ? "Gombe, Lingwala, Barumbu..." : "Gombe, Kinshasa"} 
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required 
                />
              </div>
            </div>

            {/* Description des activités */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1' }}>
                {isAgence ? 'Description des services proposés' : 'Description de vos activités / produits vendus'}
              </label>
              <textarea
                className="input-field"
                placeholder={isAgence
                  ? "Ex : Livraison express dans toute la ville de Kinshasa, gestion des retours..."
                  : "Ex : Vente de vêtements, chaussures et accessoires de mode pour hommes et femmes."}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#cbd5e1' }}>
                Mot de passe
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

            {/* Error message */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.85rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>En vous inscrivant, vous acceptez les conditions d'utilisation de Moncolis.</span>
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
                background: isAgence
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                boxShadow: isAgence
                  ? '0 4px 14px rgba(37, 99, 235, 0.4)'
                  : '0 4px 14px rgba(34, 197, 94, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Création en cours...' : `Créer mon compte ${isAgence ? 'Agence' : 'Vendeur'}`}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Déjà un compte ?{' '}
            <Link 
              href={`/auth/${role}/login`} 
              style={{ 
                color: isAgence ? '#60a5fa' : '#4ade80', 
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
