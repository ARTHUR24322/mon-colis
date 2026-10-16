import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function logLoginAttempt(
  req: NextRequest,
  emailOrIdentifier: string,
  role: string,
  status: 'success' | 'failed' | 'blocked',
  detail: string
) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
             || req.headers.get('x-real-ip')
             || 'Unknown IP';
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    await supabaseAdmin.from('login_logs').insert({
      email: emailOrIdentifier,
      role,
      ip,
      status,
      detail,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log login attempt:', err);
  }
}
