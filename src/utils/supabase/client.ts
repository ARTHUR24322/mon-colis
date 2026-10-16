import { createClient } from '@supabase/supabase-js';

// Configuration du client Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl && process.env.NODE_ENV !== 'production') {
  console.warn('Avertissement: NEXT_PUBLIC_SUPABASE_URL est manquante.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

