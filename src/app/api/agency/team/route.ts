import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { hasAgencyPermission, normalizeAgencyRole, AgencyRole } from '@/lib/agencyPermissions';
import bcrypt from 'bcryptjs';

/**
 * Génère un identifiant staff unique lié à l'agence.
 * Format : MC-[3 lettres agence]-[4 chiffres auto-incrément]
 * Ex: MC-KIN-0042
 */
async function generateStaffId(agencyId: string): Promise<string> {
  // Récupérer le nom de l'agence pour les 3 lettres
  const { data: agency } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', agencyId)
    .maybeSingle();

  const agencyCode = (agency?.name || 'AGC')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');

  // Compter les membres existants pour le numéro séquentiel global
  const { count } = await supabaseAdmin
    .from('agency_members')
    .select('id', { count: 'exact', head: true })
    .not('staff_id', 'is', null);

  const seq = String((count || 0) + 1).padStart(4, '0');
  const candidate = `MC-${agencyCode}-${seq}`;

  // Vérifier l'unicité et incrémenter si collision
  const { data: existing } = await supabaseAdmin
    .from('agency_members')
    .select('id')
    .eq('staff_id', candidate)
    .maybeSingle();

  if (existing) {
    // Collision rare : ajouter un suffixe aléatoire
    const rand = Math.floor(Math.random() * 90 + 10);
    return `MC-${agencyCode}-${seq}${rand}`;
  }

  return candidate;
}

/**
 * GET /api/agency/team
 * Liste les membres de l'équipe de l'agence connectée
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data: members, error } = await supabaseAdmin
      .from('agency_members')
      .select('id, agency_id, email, phone, name, role, staff_id, is_active, last_login_at, created_at')
      .eq('agency_id', session.agencyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[GET /api/agency/team] DB error:', error);
      return NextResponse.json({ error: 'Erreur lors de la récupération des membres' }, { status: 500 });
    }

    // Si la table est encore vide pour cette agence, renvoyer au moins le directeur connecté
    if (!members || members.length === 0) {
      return NextResponse.json({
        members: [{
          id: session.userId,
          agency_id: session.agencyId,
          email: session.email || '',
          phone: session.phone || '',
          name: session.name || 'Directeur Agence',
          role: 'directeur',
          staff_id: null,
          is_active: true,
          last_login_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }]
      });
    }

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[GET /api/agency/team]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/agency/team
 * Invite / crée un nouvel agent dans l'équipe
 * Seul le directeur a cette permission (canManageTeam)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérification stricte des permissions côté serveur
    if (!hasAgencyPermission(session.agencyRole, 'canManageTeam')) {
      return NextResponse.json({ error: 'Seul le directeur peut ajouter des membres à l’équipe' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone, role, password } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Nom, email et rôle sont obligatoires' }, { status: 400 });
    }

    const validRoles: AgencyRole[] = ['directeur', 'gestionnaire', 'agent_comptoir', 'comptable', 'lecture_seule'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Vérifier si cet email est déjà utilisé dans cette agence
    const { data: existing } = await supabaseAdmin
      .from('agency_members')
      .select('id')
      .eq('agency_id', session.agencyId)
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Un membre avec cet e-mail existe déjà dans votre agence' }, { status: 409 });
    }

    // Mot de passe initial (soit fourni, soit généré temporairement)
    const initialPassword = password && password.length >= 6 ? password : Math.random().toString(36).slice(-8) + 'A1!';
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    // Générer un staff_id uniquement pour les non-directeurs
    const staffId = role !== 'directeur' ? await generateStaffId(session.agencyId) : null;

    const { data: newMember, error: insertError } = await supabaseAdmin
      .from('agency_members')
      .insert({
        agency_id: session.agencyId,
        email: cleanEmail,
        phone: phone || null,
        name: name.trim(),
        role,
        staff_id: staffId,
        password_hash: passwordHash,
        is_active: true,
        invited_by: session.userId,
      })
      .select('id, agency_id, email, phone, name, role, staff_id, is_active, created_at')
      .single();

    if (insertError) {
      console.error('[POST /api/agency/team] Insert error:', insertError);
      return NextResponse.json({ error: 'Erreur lors de l’ajout du membre' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      member: newMember,
      staffId: newMember?.staff_id || null,
      initialPassword: password ? undefined : initialPassword,
    });

  } catch (err) {
    console.error('[POST /api/agency/team]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * PATCH /api/agency/team
 * Modifie le rôle, le statut actif ou les coordonnées d'un agent
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!hasAgencyPermission(session.agencyRole, 'canManageTeam')) {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });
    }

    const body = await req.json();
    const { id, role, is_active, phone, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'Identifiant du membre requis' }, { status: 400 });
    }

    // Empêcher de se désactiver soi-même
    if (id === session.userId && is_active === false) {
      return NextResponse.json({ error: 'Vous ne pouvez pas désactiver votre propre compte' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (role) {
      const validRoles: AgencyRole[] = ['directeur', 'gestionnaire', 'agent_comptoir', 'comptable', 'lecture_seule'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
      }
      updates.role = role;
    }

    if (typeof is_active === 'boolean') {
      updates.is_active = is_active;
    }

    if (phone !== undefined) {
      updates.phone = phone;
    }

    if (password && password.length >= 6) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('agency_members')
      .update(updates)
      .eq('id', id)
      .eq('agency_id', session.agencyId)
      .select('id, agency_id, email, phone, name, role, is_active, updated_at')
      .single();

    if (error) {
      console.error('[PATCH /api/agency/team] Update error:', error);
      return NextResponse.json({ error: 'Erreur de mise à jour' }, { status: 500 });
    }

    return NextResponse.json({ success: true, member: updated });

  } catch (err) {
    console.error('[PATCH /api/agency/team]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
