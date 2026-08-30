'use client';

import { useState } from 'react';

export default function LivreurDashboard() {
  const [courses, setCourses] = useState([
    {
      id: 'COL-1029',
      clientName: 'Alice Dubois',
      clientAddress: '15 Rue de la Paix, Paris',
      clientPhone: '06 12 34 56 78',
      status: 'À livrer',
    }
  ]);
  
  const [valCode, setValCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleValidate = (courseId: string) => {
    // Dans un vrai cas, on vérifie ce code avec le Backend/Supabase (c.otp == valCode)
    if (valCode.length < 6) {
      setErrorMsg('Le code doit contenir 6 chiffres.');
      return;
    }
    
    // Simulation
    setErrorMsg('');
    setSuccessMsg('Colis livré avec succès !');
    
    setCourses(courses.map(c => c.id === courseId ? { ...c, status: 'Livré' } : c));
  };

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '1rem' }}>
        <h1 style={{ fontWeight: '700' }}>Vue <span style={{ color: 'var(--success)' }}>Livreur</span></h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {courses.map(c => (
          <div key={c.id} className="glass-panel animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.2rem' }}>{c.id}</strong>
              <span style={{ 
                background: c.status === 'Livré' ? 'var(--success)' : 'var(--primary)', 
                color: 'white', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' 
              }}>
                {c.status}
              </span>
            </div>
            
            <div style={{ opacity: 0.9 }}>
              <p>👤 {c.clientName}</p>
              <p>📍 {c.clientAddress}</p>
              <p>📞 <a href={`tel:${c.clientPhone}`} style={{ color: 'var(--primary)' }}>{c.clientPhone}</a></p>
            </div>

            {c.status === 'À livrer' && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
                <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Code de validation du client :</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Ex: 124590"
                    maxLength={6}
                    value={valCode}
                    onChange={(e) => setValCode(e.target.value)}
                    style={{ letterSpacing: '4px', fontWeight: 'bold', textAlign: 'center' }}
                  />
                  <button className="btn btn-primary" onClick={() => handleValidate(c.id)}>
                    Valider
                  </button>
                </div>
                {errorMsg && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{errorMsg}</p>}
              </div>
            )}

            {c.status === 'Livré' && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '1rem', borderRadius: '12px', textAlign: 'center', marginTop: '0.5rem' }}>
                ✅ {successMsg || 'Livraison terminée'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
