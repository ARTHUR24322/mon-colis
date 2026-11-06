'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RotateCw,
  Truck,
  ShieldCheck,
  Check
} from 'lucide-react';

const KINSHASA_COMMUNES = [
  'Gombe', 'Limete', 'Ngaliema', 'Kintambo', 'Lingwala', 'Barumbu',
  'Kinshasa', 'Kasa-Vubu', 'Bandalungwa', 'Selembao', 'Bumbu', 'Makala',
  'Ngaba', 'Kalamu', 'Lemba', 'Matete', 'Kisenso', 'Ndjili', 'Masina',
  'Kimbanseke', 'Nsele', 'Mont-Ngafula', 'Maluku'
];

export default function AgenceRejoindrePage() {
  const router = useRouter();

  // Form states
  const [agencyName, setAgencyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedZones, setSelectedZones] = useState<string[]>(['Gombe', 'Limete']);
  const [fleetSize, setFleetSize] = useState<number>(3);
  const [maxWeightKg, setMaxWeightKg] = useState<number>(30);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleZone = (commune: string) => {
    if (selectedZones.includes(commune)) {
      if (selectedZones.length > 1) {
        setSelectedZones(selectedZones.filter(z => z !== commune));
      }
    } else {
      setSelectedZones([...selectedZones, commune]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (selectedZones.length === 0) {
      setError('Veuillez sélectionner au moins une commune desservie.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agencyName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
          address: address.trim(),
          role: 'agence',
          coverageZones: selectedZones,
          fleetSize,
          maxWeightKg,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l’envoi de votre candidature.');
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(245,158,11,0.07), transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.05), transparent 50%), #07090e',
      padding: '2.5rem 1rem',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#fff',
    }}>
      <div style={{ width: '100%', maxWidth: '580px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header Agence */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Building2 size={28} color="#f59e0b" />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 0.35rem' }}>
            Devenir Agence Partenaire
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
            Rejoignez le réseau logistique Moncolis et développez votre activité de livraison
          </p>
        </div>

        {submitted ? (
          /* Confirmation après soumission */
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px', padding: '2.5rem 2rem', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={36} color="#10b981" />
            </div>

            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 0.5rem', color: '#fff' }}>
                Demande d&apos;adhésion enregistrée !
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                Votre agence <strong>« {agencyName} »</strong> a été enregistrée avec succès.
                Elle est désormais en cours de validation par notre équipe d&apos;administration.
                Vous recevrez une notification d&apos;activation par e-mail dès son approbation.
              </p>
            </div>

            <Link
              href="/agence/login"
              style={{
                width: '100%', height: '48px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                color: '#fff', fontWeight: '800', fontSize: '0.92rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none', marginTop: '0.5rem',
              }}
            >
              Retour à l&apos;espace de connexion
            </Link>
          </div>
        ) : (
          /* Formulaire de candidature */
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '2rem',
          }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '10px', padding: '0.75rem', marginBottom: '1.5rem',
                color: '#fca5a5', fontSize: '0.82rem',
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Nom Agence */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Nom officiel de l&apos;agence *
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Express Logistics Kinshasa"
                    value={agencyName}
                    onChange={e => setAgencyName(e.target.value)}
                    style={{
                      width: '100%', height: '46px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      paddingLeft: '2.5rem', paddingRight: '0.85rem',
                      color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Grid Email & Téléphone */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Adresse e-mail professionnelle *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      required
                      placeholder="contact@votre-agence.cd"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%', height: '46px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                        paddingLeft: '2.5rem', paddingRight: '0.85rem',
                        color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Numéro de téléphone *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="tel"
                      required
                      placeholder="+243 812 345 678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      style={{
                        width: '100%', height: '46px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                        paddingLeft: '2.5rem', paddingRight: '0.85rem',
                        color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Adresse physique */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Adresse physique du bureau ou entrepôt *
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    placeholder="N° 14, Avenue de la Paix, Gombe, Kinshasa"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    style={{
                      width: '100%', height: '46px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      paddingLeft: '2.5rem', paddingRight: '0.85rem',
                      color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Flotte & Poids max */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Nombre de livreurs actifs
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={fleetSize}
                    onChange={e => setFleetSize(parseInt(e.target.value, 10) || 1)}
                    style={{
                      width: '100%', height: '46px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      padding: '0 0.85rem', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Poids max accepté (kg)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={maxWeightKg}
                    onChange={e => setMaxWeightKg(parseFloat(e.target.value) || 30)}
                    style={{
                      width: '100%', height: '46px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      padding: '0 0.85rem', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Communes desservies */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Communes desservies ({selectedZones.length} sélectionnée{selectedZones.length > 1 ? 's' : ''}) *
                </label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '140px',
                  overflowY: 'auto', padding: '8px', background: 'rgba(0,0,0,0.2)',
                  borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {KINSHASA_COMMUNES.map(c => {
                    const isSelected = selectedZones.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleZone(c)}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600',
                          border: isSelected ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                          background: isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.03)',
                          color: isSelected ? '#fcd34d' : '#94a3b8',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        {isSelected && <Check size={12} />}
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mots de passe */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Mot de passe (min. 6 caractères) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{
                        width: '100%', height: '46px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                        paddingLeft: '2.5rem', paddingRight: '2.5rem',
                        color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Confirmer le mot de passe *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{
                        width: '100%', height: '46px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                        paddingLeft: '2.5rem', paddingRight: '0.85rem',
                        color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Bouton de soumission */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: '50px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  color: '#fff', fontWeight: '800', fontSize: '0.95rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  marginTop: '0.5rem', transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <>
                    <RotateCw size={16} className="animate-spin" />
                    <span>Envoi de votre candidature...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Soumettre ma demande d&apos;adhésion</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Retour connexion */}
        <div style={{ textAlign: 'center' }}>
          <Link
            href="/agence/login"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              color: '#94a3b8', fontSize: '0.82rem', textDecoration: 'none', fontWeight: '600',
            }}
          >
            <ArrowLeft size={14} />
            <span>Déjà partenaire ? Se connecter</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
