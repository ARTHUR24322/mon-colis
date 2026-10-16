import { supabase } from '@/utils/supabase/client';
import { notFound } from 'next/navigation';
import React from 'react';

export default async function TestDatabasePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  let agences = [];
  let erreur = null;

  try {
    // 1. On tente de récupérer la liste des agences via le client Supabase
    // On sélectionne toutes les agences et on fait une jointure avec la table profiles
    const { data, error } = await supabase
      .from('agencies')
      .select('*, profiles(*)');

    if (error) throw error;
    agences = data || [];
  } catch (e: any) {
    erreur = e.message;
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-8 font-sans text-neutral-900">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-blue-600">
          Test de Connexion Supabase Natif
        </h1>
        
        {erreur ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-600 border border-red-200">
            <h2 className="font-semibold mb-2">Erreur de connexion :</h2>
            <p className="font-mono text-sm">{erreur}</p>
          </div>
        ) : (
          <div>
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-700 border border-green-200">
              <span className="font-semibold">Connexion réussie !</span> Supabase répond parfaitement.
            </div>

            <h2 className="mb-4 text-xl font-semibold">Agences trouvées ({agences.length}) :</h2>
            
            {agences.length === 0 ? (
              <p className="text-neutral-500 italic bg-neutral-50 p-4 rounded-lg">
                La base de données est vide. Allez sur le site de Supabase pour ajouter quelques données !
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {agences.map((agence: any) => (
                  <div key={agence.id} className="rounded-lg border border-neutral-200 p-4 hover:shadow-md transition bg-blue-50/50">
                    <p className="font-bold text-lg">{agence.profiles?.name || 'Nom Inconnu'}</p>
                    <p className="text-sm text-neutral-600 font-mono mt-1">{agence.phone || 'Aucun numéro'}</p>
                    <p className="text-sm text-neutral-500 mt-2 line-clamp-1">{agence.address || 'Aucune adresse'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
