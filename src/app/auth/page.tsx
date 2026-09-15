'use client';

import Link from 'next/link';
import { Store, Truck, ArrowRight, ShieldCheck, ArrowLeft, MapPin, User } from 'lucide-react';

export default function AuthIndexPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'radial-gradient(circle at top center, rgba(34, 197, 94, 0.08), transparent 70%), #07090e'
    }}>
      <div style={{
        maxWidth: '800px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2.5rem'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            color: '#94a3b8',
            marginBottom: '1.5rem',
            transition: 'color 0.2s ease'
          }}>
            <ArrowLeft size={16} />
            Retour à l'accueil
          </Link>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #22c55e, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 20px rgba(34, 197, 94, 0.3)'
            }}>
              <ShieldCheck size={24} />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#fff', margin: 0 }}>Moncolis</h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>
            Sélectionnez votre espace pour vous connecter ou créer un compte
          </p>
        </div>

        {/* Roles Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          width: '100%'
        }}>
          {/* Card Vendeur */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15), transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e',
                marginBottom: '1.5rem'
              }}>
                <Store size={28} />
              </div>

              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#4ade80',
                fontSize: '0.8rem',
                fontWeight: '600',
                marginBottom: '0.75rem'
              }}>
                Pour les Commerçants
              </span>

              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', marginBottom: '0.75rem' }}>
                Espace Vendeur
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                Expédiez vos colis en toute simplicité, comparez les tarifs des meilleures agences et sécurisez chaque remise grâce aux codes secrets OTP.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link
                href="/auth/vendeur/login"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: '600'
                }}
              >
                Se connecter (Vendeur)
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/auth/vendeur/register"
                className="btn btn-outline"
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#e2e8f0'
                }}
              >
                Créer un compte Vendeur
              </Link>
            </div>
          </div>

          {/* Card Agence */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
                marginBottom: '1.5rem'
              }}>
                <Truck size={28} />
              </div>

              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#93c5fd',
                fontSize: '0.8rem',
                fontWeight: '600',
                marginBottom: '0.75rem'
              }}>
                Pour les Transporteurs
              </span>

              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', marginBottom: '0.75rem' }}>
                Espace Agence
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                Gérez vos tournées, assignez les colis à vos livreurs, validez les réceptions et développez votre activité logistique avec un tableau de bord complet.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link
                href="/auth/agence/login"
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                }}
              >
                Se connecter (Agence)
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/auth/agence/register"
                className="btn btn-outline"
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#e2e8f0'
                }}
              >
                Créer un compte Agence
              </Link>
            </div>
          </div>          {/* Card Livreur */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15), transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fdba74',
                marginBottom: '1.5rem'
              }}>
                <User size={28} />
              </div>

              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(249, 115, 22, 0.1)',
                color: '#fdba74',
                fontSize: '0.8rem',
                fontWeight: '600',
                marginBottom: '0.75rem'
              }}>
                Pour les Livreurs
              </span>

              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', marginBottom: '0.75rem' }}>
                Espace Livreur
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                Gérez vos livraisons, scannez les colis et optimisez vos tournées grâce à l'interface dédiée.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link
                href="/auth/livreur/login"
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #ea580c, #f97316)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.4)'
                }}
              >
                Se connecter (Livreur)
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* Card Point Relais */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(234, 179, 8, 0.15), transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fef08a',
                marginBottom: '1.5rem'
              }}>
                <MapPin size={28} />
              </div>

              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(234, 179, 8, 0.1)',
                color: '#fef08a',
                fontSize: '0.8rem',
                fontWeight: '600',
                marginBottom: '0.75rem'
              }}>
                Pour les Relais
              </span>

              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', marginBottom: '0.75rem' }}>
                Espace Point Relais
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                Validez les dépôts de colis des vendeurs et remettez-les en sécurité aux livreurs.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link
                href="/auth/point-relais/login"
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #ca8a04, #eab308)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(202, 138, 4, 0.4)'
                }}
              >
                Se connecter (Relais)
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
        </div>
        {/* Footer info */}
        <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
          Vous êtes client et souhaitez suivre un colis ?{' '}
          <Link href="/track/c1" style={{ color: '#22c55e', textDecoration: 'underline' }}>
            Suivre un colis ici
          </Link>
      </div>
    </div>
  );
}
