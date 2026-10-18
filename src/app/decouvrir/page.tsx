'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Package, Truck, Store, MapPin, ShieldCheck, ChevronDown, ChevronUp,
  ArrowRight, CheckCircle2, MessageCircle, Smartphone, DollarSign,
  Clock, ShieldAlert, Award, QrCode
} from 'lucide-react';

export default function DecouvrirPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const WHATSAPP_NUMBER = '243890000000'; // Numéro support Kinshasa
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Bonjour Moncolis, j\'aimerais avoir des informations sur la plateforme de livraison à Kinshasa.')}`;

  const faqItems = [
    {
      q: 'Comment fonctionne la livraison avec Point Relais à Kinshasa ?',
      a: 'Le vendeur dépose son colis au point relais le plus proche de sa boutique. Un livreur vient le récupérer ou le client destinataire peut aller le retirer directement à proximité de son quartier grâce à son code secret OTP reçu par SMS ou WhatsApp.'
    },
    {
      q: 'Comment le vendeur récupère-t-il l\'argent de ses ventes ?',
      a: 'L\'agence ou le livreur encaisse l\'acheteur au moment de la livraison (Cash ou Mobile Money : M-Pesa, Airtel Money, Orange Money). Le solde net est crédité sur le compte du vendeur, qui peut demander son versement direct depuis son tableau de bord.'
    },
    {
      q: 'Que se passe-t-il si un colis est endommagé ou contesté ?',
      a: 'Le point relais peut refuser le colis avec motif obligatoire (le livreur est immédiatement notifié pour le récupérer). De plus, le vendeur peut poser une réclamation en un clic depuis son smartphone, ce qui bloque instantanément le retrait par l\'acheteur jusqu\'à arbitrage du Super Admin.'
    },
    {
      q: 'Dans quelles communes de Kinshasa opérez-vous ?',
      a: 'Moncolis couvre les 24 communes de Kinshasa, de Gombe et Kintambo jusqu\'à Lemba, Limete, Masina et Ngaliema. Les points relais permettent de livrer même dans les zones enclavées ou difficiles d\'accès en cas de pluie.'
    },
    {
      q: 'Les destinataires ont-ils besoin de créer un compte ?',
      a: 'Non ! Les acheteurs suivent l\'acheminement de leur colis gratuitement et en temps réel grâce à leur code de suivi unique ou le lien partagé par le vendeur, sans aucun compte requis.'
    }
  ];

  const etapes = [
    {
      num: '1',
      title: 'Enregistrement rapide',
      desc: 'Le vendeur saisit le client, l\'adresse dans la commune de Kinshasa et le montant à percevoir.'
    },
    {
      num: '2',
      title: 'Dépôt ou Prise en charge',
      desc: 'Le vendeur dépose le colis au point relais de quartier ou l\'agence envoie un livreur le ramasser.'
    },
    {
      num: '3',
      title: 'Acheminement & Sécurité',
      desc: 'Le colis est transporté en toute sécurité avec traçabilité complète de chaque étape.'
    },
    {
      num: '4',
      title: 'Remise par Code OTP',
      desc: 'Le colis est remis au client uniquement après validation de son code secret OTP.'
    }
  ];

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#07090e',
      color: '#f8fafc',
      fontFamily: 'inherit',
      paddingBottom: '90px', // espace pour le bouton fixe en bas
      maxWidth: '480px',
      margin: '0 auto',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* ─── EN-TÊTE COMPACT ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(7, 9, 14, 0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000'
          }}>
            <Package size={18} strokeWidth={2.5} />
          </div>
          <div>
            <span style={{ fontSize: '1.15rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em', display: 'block', lineHeight: 1 }}>
              Moncolis
            </span>
            <span style={{ fontSize: '0.62rem', color: '#4ade80', fontWeight: '700', textTransform: 'uppercase' }}>
              Kinshasa Logistics
            </span>
          </div>
        </Link>

        <Link
          href="/"
          style={{
            fontSize: '0.8rem', fontWeight: '700', color: '#22c55e', textDecoration: 'none',
            padding: '0.4rem 0.75rem', borderRadius: '8px', background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.3)'
          }}
        >
          Se connecter
        </Link>
      </header>

      {/* ─── SECTION 1 : HERO KINSHASA ─── */}
      <section style={{ padding: '1.5rem 1rem 1rem', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.75rem', borderRadius: '20px',
          background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#4ade80', fontSize: '0.72rem', fontWeight: '800', marginBottom: '0.75rem'
        }}>
          <MapPin size={13} /> DÉPLOYÉ DANS LES 24 COMMUNES DE KINSHASA
        </div>

        <h1 style={{
          fontSize: '1.65rem', fontWeight: '900', color: '#ffffff',
          lineHeight: 1.25, margin: '0 0 0.75rem', letterSpacing: '-0.03em'
        }}>
          La logistique urbaine fiable pour commerçants et livreurs
        </h1>

        <p style={{
          fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5,
          margin: '0 auto 1.25rem', maxWidth: '380px'
        }}>
          Gérez vos expéditions, sécurisez vos paiements à la livraison et déposez vos colis dans le réseau de Points Relais de votre quartier.
        </p>

        {/* 3 piliers réels et vérifiables */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.65rem 0.3rem' }}>
            <div style={{ color: '#4ade80', fontWeight: '900', fontSize: '1.05rem' }}>OTP</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Code secret client</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.65rem 0.3rem' }}>
            <div style={{ color: '#60a5fa', fontWeight: '900', fontSize: '1.05rem' }}>Relais</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Dépôt de quartier</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.65rem 0.3rem' }}>
            <div style={{ color: '#fbbf24', fontWeight: '900', fontSize: '1.05rem' }}>USD / FC</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Mobile Money & Cash</div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2 : LES POINTS RELAIS (RÉALITÉ DU TERRAIN KINOIS) ─── */}
      <section style={{ padding: '1rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.08))',
          border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '18px', padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.5rem' }}>
            <QrCode size={20} />
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
              Le Réseau des Points Relais
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 0.85rem' }}>
            À Kinshasa, la pluie et les embouteillages ralentissent souvent les courses à domicile. Avec nos Points Relais partenaires :
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>
            <li><strong>Vendeurs :</strong> Déposez vos colis le matin près de chez vous sans attendre le livreur.</li>
            <li><strong>Acheteurs :</strong> Retirez en toute liberté avec votre code OTP à deux pas de chez vous.</li>
            <li><strong>Livreurs :</strong> Déposez en lieu sûr si la route est impraticable ou le client absent.</li>
          </ul>
        </div>
      </section>

      {/* ─── SECTION 3 : COMMENT ÇA MARCHE (4 ÉTAPES MAXIMUM) ─── */}
      <section style={{ padding: '1rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#fff', margin: '0 0 0.85rem', textAlign: 'center' }}>
          Comment ça marche
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {etapes.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px', padding: '0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
              }}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#22c55e', color: '#000', fontWeight: '900', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {item.num}
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.2rem', fontSize: '0.92rem', fontWeight: '800', color: '#fff' }}>
                  {item.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── SECTION 4 : SÉCURITÉ FINANCIÈRE & MOBILE MONEY ─── */}
      <section style={{ padding: '1rem' }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '18px', padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
            <DollarSign size={20} />
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
              Paiement & Sécurité
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 0.75rem' }}>
            Finies les contestations : chaque montant est enregistré de manière exacte en USD avec conversion automatique en Francs Congolais (FC) selon le taux du jour.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '10px' }}>
              <CheckCircle2 size={14} color="#4ade80" style={{ display: 'inline', marginRight: '4px' }} />
              M-Pesa, Orange & Airtel Money
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '10px' }}>
              <CheckCircle2 size={14} color="#4ade80" style={{ display: 'inline', marginRight: '4px' }} />
              Versement direct sur demande
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5 : FAQ EN ACCORDÉON (RÉPONSES REPLIÉES) ─── */}
      <section style={{ padding: '1rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#fff', margin: '0 0 0.85rem', textAlign: 'center' }}>
          Questions fréquentes
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {faqItems.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px', overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%', minHeight: '48px', padding: '0.75rem 1rem', background: 'none',
                    border: 'none', color: '#fff', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.85rem', fontWeight: '700'
                  }}
                >
                  <span style={{ paddingRight: '0.5rem' }}>{item.q}</span>
                  {isOpen ? <ChevronUp size={18} color="#22c55e" style={{ flexShrink: 0 }} /> : <ChevronDown size={18} color="#94a3b8" style={{ flexShrink: 0 }} />}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 1rem 0.85rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── SECTION 6 : CONTACT DIRECT WHATSAPP KINSHASA ─── */}
      <section style={{ padding: '1rem', textAlign: 'center' }}>
        <div style={{
          background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.25)',
          borderRadius: '16px', padding: '1.25rem'
        }}>
          <h3 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: '800', color: '#25D366' }}>
            Une question ou besoin d'assistance ?
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            Notre équipe d'assistance locale à Kinshasa est disponible sur WhatsApp.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              minHeight: '46px', padding: '0 1.5rem', borderRadius: '12px',
              background: '#25D366', color: '#000', fontWeight: '900', fontSize: '0.88rem',
              textDecoration: 'none', boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)'
            }}
          >
            <MessageCircle size={18} /> Écrire sur WhatsApp
          </a>
        </div>
      </section>

      {/* ─── BOUTON FIXE EN BAS DE L'ÉCRAN : SE CONNECTER / CRÉER UN COMPTE ─── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(7, 9, 14, 0.95)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        padding: '0.65rem 1rem calc(0.65rem + env(safe-area-inset-bottom, 0px))',
        boxShadow: '0 -6px 20px rgba(0,0,0,0.6)',
        display: 'flex', justifyContent: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', gap: '0.5rem' }}>
          <Link
            href="/"
            style={{
              flex: 1, minHeight: '48px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#000', fontWeight: '900', fontSize: '0.95rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              textDecoration: 'none', boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)'
            }}
          >
            Se connecter <ArrowRight size={18} />
          </Link>
          <Link
            href="/register"
            style={{
              minHeight: '48px', padding: '0 1rem', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontWeight: '700', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none'
            }}
          >
            S'inscrire
          </Link>
        </div>
      </div>
    </div>
  );
}
