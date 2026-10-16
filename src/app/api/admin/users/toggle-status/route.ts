import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session-server';
import { z } from 'zod';

// 1. Définition du schéma Zod pour valider les entrées de manière stricte
const toggleStatusSchema = z.object({
  userId: z.string().uuid("L'ID de l'utilisateur doit être un UUID valide"),
  isActive: z.boolean({ message: "isActive doit être un booléen (true ou false)" }),
});

export async function POST(request: NextRequest) {
  try {
    // 2. Vérification sécurisée de la session (au lieu d'un header statique facilement piratable)
    const session = await getSession();
    
    if (!session || !['superadmin', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // 3. Validation des entrées avec Zod pour se protéger contre l'injection de mauvaises données
    const body = await request.json();
    const parsedData = toggleStatusSchema.safeParse(body);

    if (!parsedData.success) {
      // Retourne une erreur 400 claire avec les détails de validation
      return NextResponse.json(
        { error: 'Données invalides', details: parsedData.error.issues }, 
        { status: 400 }
      );
    }

    const { userId, isActive } = parsedData.data;

    // 4. Initialisation du client admin
    // C'est sécurisé ici CAR nous avons formellement vérifié que la personne est superadmin (étape 2)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Mettre à jour is_active dans la table profiles
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (error) {
      console.error('[toggle-status] Supabase update error:', error);
      if (error.code === 'PGRST204') {
        return NextResponse.json({
          error: 'Migration requise : la colonne "is_active" n\'existe pas encore dans la table "profiles". Exécutez : ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;'
        }, { status: 503 });
      }
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du statut' }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, isActive });
  } catch (err) {
    console.error('[toggle-status] handler error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
