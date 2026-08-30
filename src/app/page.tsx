import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="animate-fade-in" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      
      <div className="glass-panel" style={{
        maxWidth: '900px',
        width: '100%',
        padding: '3rem',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>

        {/* Hero illustration */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          animation: 'float 4s ease-in-out infinite',
        }}>
          <Image
            src="/delivery-hero.png"
            alt="Un vendeur remet son colis à un livreur"
            width={420}
            height={300}
            priority
            style={{
              borderRadius: '16px',
              objectFit: 'cover',
              boxShadow: '0 20px 60px rgba(var(--primary-rgb, 99,102,241), 0.25)',
              maxWidth: '100%',
              height: 'auto',
            }}
          />
        </div>

        <h1 style={{
          fontSize: '3rem',
          fontWeight: '800',
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginTop: '0.5rem',
        }}>
          Moncolis
        </h1>
        <p style={{
          fontSize: '1.2rem',
          opacity: 0.8,
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          La plateforme nouvelle génération qui connecte les vendeurs aux meilleures agences de livraison. 
          Générez un code, suivez votre colis, et garantissez sa livraison.
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: '1.5rem'
        }}>
          <Link href="/auth/vendeur/login" className="btn btn-primary" style={{ minWidth: '200px' }}>
            Espace Vendeur
          </Link>
          <Link href="/auth/agence/login" className="btn btn-outline" style={{ minWidth: '200px' }}>
            Espace Agence
          </Link>
        </div>

        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--card-border)'}}>
          <h3>Vous êtes un client ou livreur ?</h3>
          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
            Les clients utilisent le lien de suivi reçu par message.
            Les livreurs accèdent à leur espace via le lien fourni par leur agence.
          </p>
        </div>
      </div>

    </div>
  );
}

