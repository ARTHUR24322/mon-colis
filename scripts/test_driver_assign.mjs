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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testFixedHandover() {
  const packageId = 'f872b9d1-7745-4e82-8fb2-6e1dd7d9a836'; // MC-168270
  const driverId = '129914bd-c276-4489-8494-044d68c77460'; // Armed (another driver for ALI)
  const agencyId = 'bb1a495b-062f-4e1c-82f6-7d5868033f59'; // ALI
  const actorId = agencyId;
  const actorName = 'ALI';
  const actorRole = 'agence';

  // 1. Load package safely without non-existent columns
  const { data: pkg, error: pkgErr } = await db
    .from('packages')
    .select('id, tracking_code, short_code, status, agency_id, driver_id, updated_at')
    .eq('id', packageId)
    .maybeSingle();

  console.log('Loaded package:', { pkg, pkgErr });

  // 2. Driver profile
  const { data: driverProfile } = await db
    .from('profiles')
    .select('name')
    .eq('id', driverId)
    .maybeSingle();

  const driverName = driverProfile?.name || 'Livreur';
  const nowIso = new Date().toISOString();

  // 3. Update package
  const { data: updatedPkg, error: updErr } = await db
    .from('packages')
    .update({
      driver_id: driverId,
      agency_id: agencyId || pkg.agency_id,
      status: 'ASSIGNED_TO_DRIVER',
      updated_at: nowIso,
    })
    .eq('id', packageId)
    .select()
    .maybeSingle();

  console.log('Updated package:', { updatedPkg: updatedPkg?.tracking_code, updErr });

  // 4. Audit log
  const { error: insErr } = await db.from('package_audit_logs').insert({
    package_id: packageId,
    package_code: pkg.tracking_code || pkg.short_code,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    from_status: pkg.status,
    to_status: 'ASSIGNED_TO_DRIVER',
    action: 'HANDOVER_TO_DRIVER',
    reason: `Remise du colis au livreur ${driverName}`,
    metadata: { driver_id: driverId, driver_name: driverName },
    created_at: nowIso,
  });

  console.log('Audit log inserted:', { insErr });
}

testFixedHandover().catch(console.error);
