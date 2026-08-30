import { createClient } from '@supabase/supabase-js';

// Configuration du client Supabase
// Remplacez ces variables par celles de votre projet Supabase dans le fichier .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
