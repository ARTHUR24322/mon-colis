import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';

export async function GET() {
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  
  return NextResponse.json({
    profiles,
    error,
    cryptoSubtleExists: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
  });
}
