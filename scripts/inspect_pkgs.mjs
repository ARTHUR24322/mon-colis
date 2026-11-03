import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: pkgs } = await supabase
    .from('packages')
    .select('id, tracking_code, status, agency_id, driver_id, updated_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('PACKAGES:', pkgs);

  const { data: drivers } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('role', 'livreur');
  console.log('DRIVERS:', drivers);
}

test();

