/**
 * GET  /api/admin/admins   → liste tous les admins
 * POST /api/admin/admins   → créer un admin
 * PATCH /api/admin/admins  → modifier statut/rôle
 * DELETE /api/admin/admins → supprimer un admin
 *
 * Les admins sont stockés dans system_settings (table Supabase) sous la clé 'admin_accounts'.
 * Seul le superadmin peut accéder à ces routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import { AdminRole, ROLE_PERMISSIONS } from '@/lib/adminPermissions';
import { createHash, randomBytes } from 'crypto';

// ─── Auth guard ───────────────────────────────────────────────────────────────
async function requireSuperAdmin(): Promise<boolean> {
  const admin = await requireAdminSession();
  return admin?.role === 'superadmin';
}


// ─── Types ────────────────────────────────────────────────────────────────────
export interface AdminAccount {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: AdminRole;
  passwordHash: string;   // SHA-256 du mot de passe
  isActive: boolean;
  createdAt: string;
  createdBy: string;      // 'superadmin' ou ID de l'admin créateur
  lastLoginAt?: string;
}

// ─── Helpers stockage (system_settings) ──────────────────────────────────────
async function loadAdmins(): Promise<AdminAccount[]> {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('admin_accounts')
      .eq('id', 'global')
      .single();
      
    if (error) throw error;

    if (data?.admin_accounts) {
      return JSON.parse(data.admin_accounts) as AdminAccount[];
    }
  } catch {/* colonne absente — initialiser */}
  return [];
}

async function saveAdmins(admins: AdminAccount[]): Promise<void> {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Upsert dans system_settings avec la colonne admin_accounts en bypassant RLS
  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert(
      { id: 'global', admin_accounts: JSON.stringify(admins) },
      { onConflict: 'id' }
    );
  if (error) throw error;
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function generateId(): string {
  return 'adm_' + randomBytes(8).toString('hex');
}

// ─── GET — liste des admins ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: 'Accès refusé — Super Admin uniquement.' }, { status: 403 });
  }

  const admins = await loadAdmins();

  // Ne jamais retourner les hashes de mots de passe
  const safe = admins.map(({ passwordHash: _, ...rest }) => rest);

  return NextResponse.json({ admins: safe, total: safe.length });
}

// ─── POST — créer un admin ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: 'Accès refusé — Super Admin uniquement.' }, { status: 403 });
  }

  const body = await req.json() as {
    username: string;
    displayName: string;
    password: string;
    role: AdminRole;
    email?: string;
  };

  const { username, displayName, password, role, email } = body;

  if (!username || !displayName || !password || !role) {
    return NextResponse.json({ error: 'Champs requis : username, displayName, password, role.' }, { status: 400 });
  }

  if (!['admin_agences', 'admin_relais'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide. Valeurs acceptées : admin_agences, admin_relais.' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
  }

  const admins = await loadAdmins();

  if (admins.some(a => a.username.toLowerCase() === username.toLowerCase())) {
    return NextResponse.json({ error: `Le nom d'utilisateur "${username}" est déjà pris.` }, { status: 409 });
  }

  const newAdmin: AdminAccount = {
    id:          generateId(),
    username:    username.trim().toLowerCase(),
    displayName: displayName.trim(),
    email:       email?.trim() || undefined,
    role,
    passwordHash: hashPassword(password),
    isActive:    true,
    createdAt:   new Date().toISOString(),
    createdBy:   'superadmin',
  };

  admins.push(newAdmin);
  await saveAdmins(admins);

  const { passwordHash: _, ...safe } = newAdmin;
  return NextResponse.json({ success: true, admin: safe }, { status: 201 });
}

// ─── PATCH — modifier un admin (statut, role) ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: 'Accès refusé — Super Admin uniquement.' }, { status: 403 });
  }

  const body = await req.json() as {
    id: string;
    action: 'toggle-status' | 'change-role' | 'reset-password';
    isActive?: boolean;
    newRole?: AdminRole;
    newPassword?: string;
  };

  const { id, action } = body;
  if (!id || !action) {
    return NextResponse.json({ error: 'id et action requis.' }, { status: 400 });
  }

  const admins = await loadAdmins();
  const idx = admins.findIndex(a => a.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Admin introuvable.' }, { status: 404 });
  }

  if (action === 'toggle-status') {
    admins[idx].isActive = body.isActive ?? !admins[idx].isActive;
    await saveAdmins(admins);
    return NextResponse.json({ success: true, message: `Admin ${admins[idx].isActive ? 'activé' : 'suspendu'}.` });
  }

  if (action === 'change-role') {
    if (!body.newRole || !['admin_agences', 'admin_relais'].includes(body.newRole)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
    }
    admins[idx].role = body.newRole;
    await saveAdmins(admins);
    return NextResponse.json({ success: true, message: 'Rôle modifié.' });
  }

  if (action === 'reset-password') {
    if (!body.newPassword || body.newPassword.length < 8) {
      return NextResponse.json({ error: 'Nouveau mot de passe trop court (min 8 caractères).' }, { status: 400 });
    }
    admins[idx].passwordHash = hashPassword(body.newPassword);
    await saveAdmins(admins);
    return NextResponse.json({ success: true, message: 'Mot de passe réinitialisé.' });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}

// ─── DELETE — supprimer un admin ──────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: 'Accès refusé — Super Admin uniquement.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id requis.' }, { status: 400 });
  }

  const admins = await loadAdmins();
  const filtered = admins.filter(a => a.id !== id);

  if (filtered.length === admins.length) {
    return NextResponse.json({ error: 'Admin introuvable.' }, { status: 404 });
  }

  await saveAdmins(filtered);
  return NextResponse.json({ success: true, message: 'Admin supprimé.' });
}

// ─── Export helper pour la page de login admins ───────────────────────────────
export { loadAdmins, hashPassword as hashAdminPassword };
