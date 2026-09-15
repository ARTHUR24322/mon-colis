'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Store,
  Truck,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Building2,
  Check
} from 'lucide-react';

const KINSHASA_COMMUNES = [
  'Gombe',
  'Limete',
  'Lemba',
  'Bandalungwa',
  'Ngaliema',
  'Kintambo',
  'Matete',
  'Kalamu',
  'Lingwala',
  'Barumbu',
  'Kinshasa',
  'Ngaba',
  'Mont-Ngafula',
  'Selembao',
  'Masina',
  'Ndjili',
];

export default function GlobalRegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'vendeur' | 'agence'>('vendeur');
  const [name, setName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [fleetSize, setFleetSize] = useState('3');
  const [selectedZones, setSelectedZones] = useState<string[]>(['Gombe', 'Limete']);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [agencySubmitted, setAgencySubmitted] = useState(false);

  const toggleZone = (commune: string) => {
    if (selectedZones.includes(commune)) {
      if (selectedZones.length > 1) {
        setSelectedZones(selectedZones.filter(z => z !== commune));
      }
    } else {
      setSelectedZones([...selectedZones, commune]);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          name,
          managerName: role === 'agence' ? managerName : undefined,
          email,
          phone,
          address: role === 'agence' ? address : undefined,
          password,
          coverageZones: role === 'agence' ? selectedZones : undefined,
          fleetSize: role === 'agence' ? parseInt(fleetSize, 10) || 1 : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Erreur lors de la création du compte.');
        setLoading(false);
        return;
      }

      if (role === 'agence') {
        // Demande soumise avec succès, en attente de validation Superadmin
        setAgencySubmitted(true);
      } else {
        // Vendeur connecté immédiatement
        router.push('/dashboard/vendeur');
      }
    } catch {
      setErrorMsg('Une erreur réseau est survenue. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Écran de confirmation de demande d'adhésion agence
  // -------------------------------------------------------------
  if (agencySubmitted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        background: 'radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.12), transparent 60%), #07090e'
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '24px',
          padding: '2.5rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            color: '#fff',
            boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)'
          }}>
            <Clock size={36} />
          </div>

          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
              Demande d'Adhésion Transmise !
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
              Merci d'avoir postulé pour devenir Agence Partenaire Moncolis. Votre dossier a été enregistré et est en attente de vérification par le <strong style={{ color: '#60a5fa' }}>Superadmin</strong>.
            </p>
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '16px',
            padding: '1.25rem',
            textAlign: 'left',
            fontSize: '0.85rem',
            color: '#cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}>
            <div style={{ fontWeight: '700', color: '#93c5fd', fontSize: '0.88rem' }}>
              📋 Récapitulatif de votre candidature :
            </div>
            <div>• <strong>Agence :</strong> {name}</div>
            <div>• <strong>Email :</strong> {email}</div>
            <div>• <strong>Téléphone :</strong> {phone}</div>
            <div>• <strong>Flotte déclarée :</strong> {fleetSize} livreurs / motos</div>
            <div>• <strong>Zones couvertes :</strong> {selectedZones.join(', ')}</div>
          </div>

          <div style={{
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            fontSize: '0.8rem',
            color: '#fde047',
            textAlign: 'left'
          }}>
            💡 Vous recevrez un appel ou un message de confirmation une fois la validation effectuée. Vous pourrez ensuite vous connecter avec vos identifiants pour gérer vos tournées.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Link
              href="/"
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              Retour à l'accueil
            </Link>

            <Link
              href="/auth/agence/login"
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              Page de Connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Formulaire d'inscription
  // -------------------------------------------------------------
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
        maxWidth: '540px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Back Link */}
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          color: '#94a3b8',
          textDecoration: 'none',
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
            
            <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
              {role === 'vendeur' ? 'Compte Vendeur & Boutique' : 'Demande d\'Adhésion Agence'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
              {role === 'vendeur'
                ? 'Expédiez et encaissez vos commandes en toute sécurité à Kinshasa.'
                : 'Les comptes agence sont activés après validation par le Superadmin.'}
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
            marginBottom: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              type="button"
              onClick={() => { setRole('vendeur'); setErrorMsg(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.88rem',
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
              onClick={() => { setRole('agence'); setErrorMsg(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.88rem',
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
              Agence (Sur Demande)
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.85rem 1rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '12px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                {role === 'vendeur' ? 'Nom de la Boutique / Entreprise *' : 'Nom Commercial de l\'Agence *'}
              </label>
              <div style={{ position: 'relative' }}>
                <User size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
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

            {role === 'agence' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                  Nom complet du Gérant / Responsable *
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ex: Christian Mukendi"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    style={{ paddingLeft: '2.75rem' }}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                Adresse Email professionnelle *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
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
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                Numéro de Téléphone (WhatsApp/Appels) *
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
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
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                    Adresse du Siège / Dépôt Principal *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ex: Boulevard du 30 Juin, n°14, Gombe"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      style={{ paddingLeft: '2.75rem' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                    Taille estimée de votre flotte (Livreurs / Motos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    placeholder="Ex: 5"
                    value={fleetSize}
                    onChange={(e) => setFleetSize(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                    Communes de Kinshasa desservies ({selectedZones.length} sélectionnée(s))
                  </label>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    {KINSHASA_COMMUNES.map(commune => {
                      const selected = selectedZones.includes(commune);
                      return (
                        <button
                          key={commune}
                          type="button"
                          onClick={() => toggleZone(commune)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '20px',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            background: selected ? '#2563eb' : 'rgba(255,255,255,0.07)',
                            color: selected ? '#fff' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          {selected && <Check size={12} />}
                          {commune}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: '#cbd5e1' }}>
                Mot de passe sécurisé *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="password"
                  className="input-field"
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            {role === 'agence' && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                fontSize: '0.78rem',
                color: '#93c5fd',
                lineHeight: 1.5
              }}>
                ℹ️ <strong>Protocole de sécurité :</strong> Pour garantir la traçabilité des fonds encaissés, toute nouvelle agence fait l'objet d'un examen par le Superadmin avant d'obtenir son habilitation.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>En vous inscrivant, vous acceptez les conditions générales d'utilisation et la politique de Moncolis.</span>
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
                fontWeight: '700',
                fontSize: '0.98rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#fff',
                background: role === 'vendeur'
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: role === 'vendeur'
                  ? '0 4px 14px rgba(34, 197, 94, 0.4)'
                  : '0 4px 14px rgba(37, 99, 235, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? (
                'Traitement du dossier...'
              ) : role === 'vendeur' ? (
                'Créer mon compte Vendeur'
              ) : (
                <>
                  <Send size={16} />
                  Soumettre ma demande d'adhésion
                </>
              )}
            </button>
          </form>

          {/* Login switch */}
          <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.88rem', color: '#94a3b8' }}>
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
          <span>Plateforme certifiée Moncolis RDC</span>
        </div>
      </div>
    </div>
  );
}
