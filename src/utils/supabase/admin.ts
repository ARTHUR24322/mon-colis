/**
 * Client Supabase Admin (service role) — Server-side ONLY
 * Bypasse toutes les politiques RLS.
 * NE PAS utiliser côté client (browser).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  // Fallback sur la clé anon si service role non configurée
  console.warn('[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY manquant — utilisation de la clé anon (RLS active)');
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          cache: 'no-store'
        });
      },
    },
  }
);
