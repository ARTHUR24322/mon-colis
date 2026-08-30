'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const role = params.role as string; // 'vendeur' | 'agence'
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // States supplémentaires pour l'agence
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  
  const [loading, setLoading] = useState(false);

  const roleLabels: Record<string, string> = {
    vendeur: 'Vendeur',
    agence: 'Agence de Livraison'
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simuler un appel API d'inscription avec Supabase
    setTimeout(() => {
      setLoading(false);
      // Redirection après inscription vers le bon dashboard
      if (role === 'vendeur') router.push('/dashboard/vendeur');
      else router.push('/dashboard/agence');
    }, 1500);
  };

  if (!role || !roleLabels[role]) {
    return <div>Rôle invalide</div>;
  }

  return (
    <div className="animate-fade-in" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '2.5rem',
        borderRadius: '20px'
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '2rem',
          fontSize: '1.75rem',
          fontWeight: '700'
        }}>
          Créer un compte <span style={{ color: 'var(--primary)' }}>{roleLabels[role]}</span>
        </h2>
        
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
              {role === 'vendeur' ? 'Nom de la Boutique / Nom' : 'Nom de l\'Agence'}
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder={role === 'vendeur' ? "Boutique Express" : "Fast Delivery Inc"} 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>Email</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="contact@exemple.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>Mot de passe</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          {role === 'agence' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>Adresse Principale</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="123 Rue de la Logistique, Paris" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>Numéro de Téléphone</label>
                <input 
                  type="tel" 
                  className="input-field" 
                  placeholder="+33 6 12 34 56 78" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required 
                />
              </div>
            </>
          )}
          
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Création en cours...' : 'M\'inscrire'}
          </button>
        </form>

        {role === 'vendeur' && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', opacity: 0.6 }}>
              <hr style={{ flex: 1, borderColor: 'var(--card-border)' }} />
              <span style={{ padding: '0 1rem', fontSize: '0.85rem' }}>ou</span>
              <hr style={{ flex: 1, borderColor: 'var(--card-border)' }} />
            </div>
            <button className="btn btn-outline" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }} onClick={() => console.log('Google login clicked')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              S'inscrire avec Google
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <p style={{ opacity: 0.8 }}>
            Déjà un compte ?{' '}
            <Link href={`/auth/${role}/login`} style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
              Se connecter
            </Link>
          </p>
          <p style={{ marginTop: '1rem' }}>
            <Link href="/" style={{ opacity: 0.6 }}>Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
