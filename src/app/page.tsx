'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Package,
  Truck,
  Store,
  ShieldCheck,
  Search,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  Smartphone,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Lock,
  DollarSign,
  Users,
  Award
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [trackingCode, setTrackingCode] = useState('');
  const [activeTab, setActiveTab] = useState<'vendeur' | 'agence'>('vendeur');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackingCode.trim();
    if (code) {
      router.push(`/track/${encodeURIComponent(code)}`);
    } else {
      router.push('/track/c1');
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const demoCodes = ['c1', 'c2', 'c3', 'c4'];

  return (
    <div style={{ minHeight: '100vh', background: '#07090e', color: '#f8fafc', overflowX: 'hidden' }}>
      
      {/* ─────────────────────────────────────────────
          1. NAVIGATION BAR
      ───────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(16px)',
        background: 'rgba(7, 9, 14, 0.85)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.9rem 1.5rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #22c55e, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)'
            }}>
              <Package size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1 }}>
                Moncolis
              </span>
              <span style={{ fontSize: '0.65rem', color: '#4ade80', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Logistics Hub
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
            fontSize: '0.9rem',
            fontWeight: '500',
            color: '#94a3b8',
          }} className="desktop-nav">
            <a href="#fonctionnalites" style={{ transition: 'color 0.2s' }} className="nav-link">Fonctionnalités</a>
            <a href="#solutions" style={{ transition: 'color 0.2s' }} className="nav-link">Solutions</a>
            <a href="#comment-ca-marche" style={{ transition: 'color 0.2s' }} className="nav-link">Comment ça marche</a>
            <a href="#faq" style={{ transition: 'color 0.2s' }} className="nav-link">FAQ</a>
            <Link href="/livreur" style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Smartphone size={15} color="#22c55e" />
              Espace Livreur
            </Link>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href="/login"
              style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#e2e8f0',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.04)',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              Connexion
            </Link>

            <Link
              href="/register"
              style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#fff',
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.35)',
                border: 'none',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>Créer un compte</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        padding: '4.5rem 1.5rem 5rem 1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* Ambient Glows */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.15), rgba(59, 130, 246, 0.08), transparent 70%)',
          filter: 'blur(70px)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '3.5rem',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Left Column: Hero Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Pill badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.9rem',
              borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ade80',
              fontSize: '0.82rem',
              fontWeight: '600',
              width: 'fit-content'
            }}>
              <Sparkles size={15} />
              <span>Plateforme B2B de livraison & logistique intelligente</span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: 'clamp(2.3rem, 5vw, 3.5rem)',
              fontWeight: '800',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#fff',
              margin: 0
            }}>
              Connectez vos boutiques aux meilleures{' '}
              <span style={{
                background: 'linear-gradient(135deg, #22c55e 30%, #4ade80 70%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                agences de livraison
              </span>
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: '1.1rem',
              lineHeight: 1.6,
              color: '#94a3b8',
              margin: 0,
              maxWidth: '540px'
            }}>
              Générez des codes de validation sécurisés (OTP), choisissez vos transporteurs en temps réel, optimisez vos expéditions et éliminez 100% des litiges de remise de colis.
            </p>

            {/* Dual CTA Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              marginTop: '0.5rem'
            }}>
              <Link
                href="/auth/vendeur/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  padding: '0.85rem 1.6rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '1rem',
                  boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none'
                }}
              >
                <Store size={20} />
                <span>Espace Vendeur</span>
                <ArrowRight size={17} />
              </Link>

              <Link
                href="/auth/agence/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  padding: '0.85rem 1.6rem',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  color: '#93c5fd',
                  fontWeight: '600',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none'
                }}
              >
                <Truck size={20} />
                <span>Espace Agence</span>
              </Link>
            </div>

            {/* 🔍 Direct Live Tracking Bar */}
            <div style={{
              marginTop: '1rem',
              padding: '1.25rem',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#cbd5e1',
                marginBottom: '0.75rem'
              }}>
                <Search size={16} color="#22c55e" />
                <span>Suivre un colis sans compte :</span>
              </div>

              <form onSubmit={handleTrack} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Ex: c1, c2, c3 ou votre N° de colis..."
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  style={{
                    flex: '1 1 200px',
                    padding: '0.7rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(0, 0, 0, 0.4)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0.7rem 1.25rem',
                    borderRadius: '10px',
                    background: '#22c55e',
                    border: 'none',
                    color: '#000',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Search size={16} />
                  <span>Suivre</span>
                </button>
              </form>

              {/* Demo tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.65rem', fontSize: '0.78rem', color: '#64748b' }}>
                <span>Exemples démo :</span>
                {demoCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setTrackingCode(code);
                      router.push(`/track/${code}`);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '0.15rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    #{code}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Hero Visual with Interactive Status Floaters */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            
            <div style={{
              position: 'relative',
              borderRadius: '24px',
              padding: '0.5rem',
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(59, 130, 246, 0.15), rgba(255, 255, 255, 0.05))',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)'
            }}>
              <Image
                src="/delivery-hero.png"
                alt="Plateforme logistique Moncolis"
                width={520}
                height={380}
                priority
                style={{
                  borderRadius: '20px',
                  objectFit: 'cover',
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />

              {/* Floating Widget 1: Live Status */}
              <div style={{
                position: 'absolute',
                top: '-15px',
                left: '-20px',
                background: 'rgba(10, 15, 25, 0.92)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '16px',
                padding: '0.85rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
                animation: 'float 4s ease-in-out infinite'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22c55e'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Code OTP Sécurisé</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#4ade80' }}>#847392 validé</div>
                </div>
              </div>

              {/* Floating Widget 2: Package in Transit */}
              <div style={{
                position: 'absolute',
                bottom: '-20px',
                right: '-15px',
                background: 'rgba(10, 15, 25, 0.92)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '16px',
                padding: '0.85rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
                animation: 'float 4s ease-in-out infinite 2s'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60a5fa'
                }}>
                  <Truck size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>En cours de livraison</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff' }}>Express Delivery • Gombe</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          3. METRICS & TRUST COUNTERS
      ───────────────────────────────────────────── */}
      <section style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(255, 255, 255, 0.015)',
        padding: '2.5rem 1.5rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: '800', color: '#4ade80', letterSpacing: '-0.02em' }}>
              +50,000
            </div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Colis acheminés avec succès
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: '800', color: '#60a5fa', letterSpacing: '-0.02em' }}>
              99.9%
            </div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Livraisons sans litige grâce à l'OTP
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: '800', color: '#fbbf24', letterSpacing: '-0.02em' }}>
              &lt; 2 Heures
            </div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Délai moyen de prise en charge
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: '800', color: '#a78bfa', letterSpacing: '-0.02em' }}>
              150+
            </div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Boutiques & Agences partenaires
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          4. KEY FEATURES GRID (Fonctionnalités)
      ───────────────────────────────────────────── */}
      <section id="fonctionnalites" style={{
        padding: '5.5rem 1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span style={{
            color: '#22c55e',
            fontSize: '0.85rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            Infrastructure & Technologie
          </span>
          <h2 style={{
            fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
            fontWeight: '800',
            color: '#fff',
            marginTop: '0.5rem',
            letterSpacing: '-0.02em'
          }}>
            Conçu pour éliminer les frictions de livraison
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: '600px', margin: '0.75rem auto 0 auto' }}>
            Des outils avancés conçus pour les exigences des commerçants modernes et des agences de transport professionnelles.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.75rem',
        }}>
          {/* Feature 1 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Validation Anti-Fraude par Code OTP
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              Chaque colis génère un code de sécurité secret à 6 chiffres. Le livreur ne peut clôturer la course qu'après saisie du code fourni par le client. Zéro contestation possible.
            </p>
          </div>

          {/* Feature 2 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Calculateur Automatique Tarif & Volumétrie
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              Estimation instantanée des coûts de transport basée sur le poids réel, les dimensions du colis (longueur, largeur, hauteur) et la distance de livraison.
            </p>
          </div>

          {/* Feature 3 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DollarSign size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Suivi Financier & Paiement à la Livraison (COD)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              Gestion transparente des montants à encaisser (Cash on Delivery et Mobile Money). Tableaux de bord financiers clairs pour les reversements aux commerçants.
            </p>
          </div>

          {/* Feature 4 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(168, 85, 247, 0.12)',
              color: '#c084fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Dispatch & Attribution de Flotte
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              Les agences attribuent les courses à leurs livreurs en 1 clic. Suivi de charge de travail, performances individuelles et historique d'activité.
            </p>
          </div>

          {/* Feature 5 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(236, 72, 153, 0.12)',
              color: '#f472b6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Smartphone size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Application Livreur Ultra-Légère
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              Une interface web mobile dédiée sans installation lourde. Vos livreurs consultent l'adresse client, déclenchent l'appel et valident les livraisons en un clin d'œil.
            </p>
          </div>

          {/* Feature 6 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(20, 184, 166, 0.12)',
              color: '#2dd4bf',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Award size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Système de Notation & Confiance
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              Les vendeurs notent les agences après chaque course. Choisissez vos partenaires en fonction de leur score de ponctualité et de leur qualité de service.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          5. SOLUTIONS PAR ACTEUR (Vendeur vs Agence)
      ───────────────────────────────────────────── */}
      <section id="solutions" style={{
        padding: '5rem 1.5rem',
        background: 'rgba(255, 255, 255, 0.01)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Pour tous les acteurs de la chaîne
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: '800', color: '#fff', marginTop: '0.5rem' }}>
              Une expérience dédiée à votre métier
            </h2>
          </div>

          {/* Tabs switch */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: '3rem'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('vendeur')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'vendeur' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === 'vendeur' ? '#4ade80' : '#94a3b8',
                border: activeTab === 'vendeur' ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <Store size={20} />
              <span>Pour les Vendeurs & Boutiques</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('agence')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'agence' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === 'agence' ? '#60a5fa' : '#94a3b8',
                border: activeTab === 'agence' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <Truck size={20} />
              <span>Pour les Agences de Transport</span>
            </button>
          </div>

          {/* Tab Content: Vendeur */}
          {activeTab === 'vendeur' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2.5rem',
              alignItems: 'center',
              background: 'rgba(34, 197, 94, 0.03)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '24px',
              padding: '3rem 2.5rem',
              backdropFilter: 'blur(16px)'
            }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '0.3rem 0.8rem',
                  borderRadius: '999px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#4ade80',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  marginBottom: '1rem'
                }}>
                  Commerçants & E-boutiques
                </span>
                <h3 style={{ fontSize: '1.85rem', fontWeight: '800', color: '#fff', marginBottom: '1rem', lineHeight: 1.25 }}>
                  Concentrez-vous sur vos ventes, Moncolis sécurise vos livraisons
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  Fini les litiges où les clients affirment ne pas avoir reçu leur commande ou les livreurs qui égarent les paquets. Bénéficiez d'une preuve de livraison irréfutable.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#22c55e" />
                    <span>Création de colis en moins de 30 secondes</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#22c55e" />
                    <span>Génération automatique de codes OTP sécurisés</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#22c55e" />
                    <span>Comparateur des agences les mieux notées</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#22c55e" />
                    <span>Suivi transparent des revenus et des encaissements</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <Link
                    href="/auth/vendeur/login"
                    className="btn btn-primary"
                    style={{ fontWeight: '600', padding: '0.75rem 1.5rem' }}
                  >
                    Accéder à l'Espace Vendeur
                    <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
                  </Link>
                  <Link
                    href="/auth/vendeur/register"
                    className="btn btn-outline"
                    style={{ fontWeight: '600', padding: '0.75rem 1.5rem' }}
                  >
                    Créer un compte Boutique
                  </Link>
                </div>
              </div>

              {/* Visual Card */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#fff', fontSize: '1.1rem' }}>📦 Nouveau Colis #c3</span>
                  <span style={{ background: '#f59e0b', color: '#000', fontSize: '0.75rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    En attente d'agence
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                  <div><strong>Destinataire :</strong> Fatou Coulibaly (+243 89 77 88 990)</div>
                  <div><strong>Adresse :</strong> Quartier Macampagne, Ngaliema</div>
                  <div><strong>Dimensions :</strong> 60x40x35 cm • 15.0 kg</div>
                  <div><strong>Prix marchandise :</strong> $25.00</div>
                </div>

                <div style={{
                  padding: '1rem',
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: '12px',
                  border: '1px dashed #22c55e',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.85rem', color: '#86efac' }}>Code Secret OTP :</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#22c55e', letterSpacing: '0.1em' }}>562810</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: Agence */}
          {activeTab === 'agence' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2.5rem',
              alignItems: 'center',
              background: 'rgba(59, 130, 246, 0.03)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '24px',
              padding: '3rem 2.5rem',
              backdropFilter: 'blur(16px)'
            }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '0.3rem 0.8rem',
                  borderRadius: '999px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  marginBottom: '1rem'
                }}>
                  Transporteurs & Agences
                </span>
                <h3 style={{ fontSize: '1.85rem', fontWeight: '800', color: '#fff', marginBottom: '1rem', lineHeight: 1.25 }}>
                  Développez votre flotte et captez des centaines de nouveaux clients
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  Recevez les demandes d'expédition des commerçants, répartissez les tournées à vos coursiers et suivez les validations et encaissements en temps réel.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#60a5fa" />
                    <span>Tableau de bord de dispatching et gestion des livreurs</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#60a5fa" />
                    <span>Validation instantanée de livraison via application mobile</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#60a5fa" />
                    <span>Calcul des commissions et export comptable</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1' }}>
                    <CheckCircle2 size={18} color="#60a5fa" />
                    <span>Gestion des zones et tarification sur-mesure</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <Link
                    href="/auth/agence/login"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: '600',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      color: '#fff',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                    }}
                  >
                    Accéder à l'Espace Agence
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/auth/agence/register"
                    className="btn btn-outline"
                    style={{ fontWeight: '600', padding: '0.75rem 1.5rem', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#93c5fd' }}
                  >
                    Rejoindre le Réseau Agence
                  </Link>
                </div>
              </div>

              {/* Visual Card */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#fff', fontSize: '1.1rem' }}>🚚 Dispatching Tournée #T-204</span>
                  <span style={{ background: '#22c55e', color: '#000', fontSize: '0.75rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    Active
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px' }}>
                    <div style={{ color: '#fff', fontWeight: '600' }}>Livreur : Patrick M. (Moto 04)</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>4 colis assignés • Zone Limete / Gombe</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px' }}>
                    <div style={{ color: '#fff', fontWeight: '600' }}>Livreur : Eric K. (Véhicule 01)</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>6 colis assignés • Zone Ngaliema / Kintambo</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>Chiffre du jour :</span>
                  <span style={{ color: '#60a5fa', fontWeight: '800', fontSize: '1.1rem' }}>$340.00 USD</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ─────────────────────────────────────────────
          6. COMMENT ÇA MARCHE (Step by step)
      ───────────────────────────────────────────── */}
      <section id="comment-ca-marche" style={{
        padding: '5.5rem 1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Processus Simplifié
          </span>
          <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: '800', color: '#fff', marginTop: '0.5rem' }}>
            Comment fonctionne Moncolis ?
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          position: 'relative'
        }}>
          {/* Step 1 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2.25rem',
            position: 'relative'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#22c55e',
              color: '#000',
              fontWeight: '800',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem'
            }}>
              1
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', marginBottom: '0.75rem' }}>
              Enregistrement & Code Secret
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Le vendeur renseigne les coordonnées du client et les dimensions du colis. La plateforme génère instantanément un code de validation OTP unique.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2.25rem',
            position: 'relative'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: '800',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem'
            }}>
              2
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', marginBottom: '0.75rem' }}>
              Prise en charge par l'Agence
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
              L'agence partenaire accepte la course et assigne un livreur. Le statut passe automatiquement à "En transit" et le client reçoit son lien de suivi en direct.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2.25rem',
            position: 'relative'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#10b981',
              color: '#000',
              fontWeight: '800',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem'
            }}>
              3
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', marginBottom: '0.75rem' }}>
              Remise & Validation OTP
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
              À l'arrivée, le client communique son code secret au livreur. La saisie du code valide instantanément la livraison, encaisse le montant et clôture la course.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          7. FAQ ACCORDION SECTION
      ───────────────────────────────────────────── */}
      <section id="faq" style={{
        padding: '5rem 1.5rem',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Questions fréquentes
          </span>
          <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', fontWeight: '800', color: '#fff', marginTop: '0.5rem' }}>
            Tout ce que vous devez savoir
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            {
              q: "Comment fonctionne le code de validation sécurisé (OTP) ?",
              a: "Lors de la création d'une commande par un vendeur, un code à 6 chiffres est généré. Seul le client final et le vendeur y ont accès. Lorsque le livreur remet le colis, il saisit ce code dans son application livreur pour prouver sans contestation possible que le colis a bien été remis au destinataire légitime."
            },
            {
              q: "Comment s'inscrire en tant qu'agence de livraison ?",
              a: "Il vous suffit de cliquer sur 'Espace Agence' ou 'Créer un compte Agence', de renseigner les informations de votre entreprise (nom, adresse, téléphone) et de configurer vos livreurs. Vous recevrez immédiatement les demandes de livraison des boutiques environnantes."
            },
            {
              q: "Les clients destinataires doivent-ils créer un compte ?",
              a: "Non ! Les clients n'ont besoin d'aucun compte ni mot de passe. Ils peuvent suivre leur colis en temps réel simplement en cliquant sur le lien public reçu ou en tapant leur référence sur la page d'accueil de Moncolis."
            },
            {
              q: "Comment sont gérés les paiements à la livraison (Cash on Delivery) ?",
              a: "Moncolis intègre le suivi précis des montants collectés par les livreurs à la remise du colis. L'agence et le commerçant disposent d'un grand livre comptable en direct pour effectuer les reversements sans erreur."
            }
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                style={{
                  width: '100%',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <span>{item.q}</span>
                <ChevronDown
                  size={20}
                  color="#22c55e"
                  style={{
                    transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0
                  }}
                />
              </button>
              {openFaq === idx && (
                <div style={{
                  padding: '0 1.5rem 1.25rem 1.5rem',
                  color: '#94a3b8',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingTop: '1rem'
                }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          8. CALL TO ACTION BANNER
      ───────────────────────────────────────────── */}
      <section style={{
        padding: '5rem 1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(59, 130, 246, 0.12), rgba(255, 255, 255, 0.02))',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '28px',
          padding: '4rem 2rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
        }}>
          <h2 style={{
            fontSize: 'clamp(2.2rem, 4vw, 3rem)',
            fontWeight: '800',
            color: '#fff',
            marginBottom: '1rem',
            letterSpacing: '-0.02em'
          }}>
            Prêt à révolutionner vos livraisons ?
          </h2>
          <p style={{
            fontSize: '1.15rem',
            color: '#cbd5e1',
            maxWidth: '600px',
            margin: '0 auto 2.5rem auto',
            lineHeight: 1.6
          }}>
            Rejoignez dès aujourd'hui la plateforme qui sécurise les expéditions de milliers de commerçants et transporteurs.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              href="/auth/vendeur/register"
              className="btn btn-primary"
              style={{ padding: '0.9rem 1.8rem', fontSize: '1.05rem', fontWeight: '700' }}
            >
              <Store size={20} style={{ marginRight: '0.5rem' }} />
              Démarrer comme Vendeur
            </Link>
            <Link
              href="/auth/agence/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.9rem 1.8rem',
                fontSize: '1.05rem',
                fontWeight: '700',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Truck size={20} style={{ marginRight: '0.5rem' }} />
              Rejoindre en tant qu'Agence
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          9. FOOTER
      ───────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#040609',
        padding: '4rem 1.5rem 2rem 1.5rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '3rem',
          marginBottom: '3rem'
        }}>
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000'
              }}>
                <Package size={18} />
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>Moncolis</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: '1.6', margin: 0 }}>
              La plateforme logistique nouvelle génération qui interconnecte vendeurs, agences de transport et clients avec traçabilité 100% garantie.
            </p>
          </div>

          {/* Espaces d'accès */}
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff', marginBottom: '1rem' }}>
              Espaces Utilisateurs
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem', color: '#94a3b8' }}>
              <li><Link href="/auth/vendeur/login" style={{ transition: 'color 0.2s' }}>Connexion Vendeur</Link></li>
              <li><Link href="/auth/agence/login" style={{ transition: 'color 0.2s' }}>Connexion Agence</Link></li>
              <li><Link href="/livreur" style={{ transition: 'color 0.2s' }}>Portail Livreur Mobile</Link></li>
              <li><Link href="/track/c1" style={{ transition: 'color 0.2s' }}>Suivi Public de Colis</Link></li>
              <li><Link href="/admin-x9k2" style={{ transition: 'color 0.2s', opacity: 0.5 }}>Portail Super Admin</Link></li>
            </ul>
          </div>

          {/* Plateforme */}
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff', marginBottom: '1rem' }}>
              Plateforme
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem', color: '#94a3b8' }}>
              <li><a href="#fonctionnalites">Fonctionnalités</a></li>
              <li><a href="#solutions">Solutions Vendeurs & Agences</a></li>
              <li><a href="#comment-ca-marche">Comment ça marche</a></li>
              <li><a href="#faq">Foire aux questions</a></li>
            </ul>
          </div>

          {/* Contact & Status */}
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff', marginBottom: '1rem' }}>
              Statut & Support
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#4ade80', marginBottom: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span>Tous les systèmes opérationnels</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5' }}>
              Besoin d'aide ou d'un devis entreprise ? Contactez notre support logistique 7j/7.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: '2rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.8rem',
          color: '#64748b'
        }}>
          <div>
            © {new Date().getFullYear()} Moncolis Inc. Tous droits réservés.
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span>Confidentialité</span>
            <span>Conditions d'utilisation</span>
            <span>Sécurité OTP</span>
          </div>
        </div>
      </footer>

      {/* Embedded style helper for responsive navbar */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
        }
        .nav-link:hover {
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
