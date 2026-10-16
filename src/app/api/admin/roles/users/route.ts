/**
 * GET /api/admin/roles/users
 * Retourne tous les utilisateurs avec leur rôle, statut, et informations.
 * Les livreurs incluent leur agencyId pour le regroupement côté admin.
 *
 * POST /api/admin/roles/users
 * Actions : toggle-status, change-role
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';
import { requireAdminSession } from '@/lib/adminSession';


export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  try {
    // 1. Tous les profils
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, role, phone, is_active, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    // 2. Agences (statut + données)
    const { data: agencies } = await supabase
      .from('agencies')
      .select('id, status, phone, address');

    // 3. Table drivers — contient agency_id qui lie le livreur à son agence
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, agency_id, phone, available');

    // 4. Agents point relais
    const { data: dpAgents } = await supabase
      .from('drop_point_agents')
      .select('id, name, agent_number, drop_point_id, is_active, created_at');

    // 5. Points relais
    const { data: dropPoints } = await supabase
      .from('drop_points')
      .select('id, name, commune');

    const agencyMap  = new Map((agencies   || []).map((a)  => [a.id, a]));
    const driverMap  = new Map((drivers    || []).map((d)  => [d.id, d]));
    const dpMap      = new Map((dropPoints || []).map((dp) => [dp.id, dp]));

    const users: UserEntry[] = [];

    // Profils standard
    for (const p of profiles || []) {
      const agencyInfo = agencyMap.get(p.id);
      const driverInfo = driverMap.get(p.id); // si ce profil est un livreur

      users.push({
        id:          p.id,
        name:        p.name  || '—',
        email:       p.email || '—',
        phone:       p.phone || driverInfo?.phone || '—',
        role:        p.role as UserRole,
        status:      p.is_active === false
                       ? 'suspended'
                       : agencyInfo?.status === 'PENDING'  ? 'pending'
                       : agencyInfo?.status === 'REJECTED' ? 'rejected'
                       : 'active',
        agencyStatus: agencyInfo?.status,
        // Pour les livreurs : lien vers l'agence parente
        agencyId:    driverInfo?.agency_id || undefined,
        joinedDate:  new Date(p.created_at).toLocaleDateString('fr-FR'),
        type:        'profile',
      });
    }

    // Agents point relais
    for (const agent of dpAgents || []) {
      const dp = dpMap.get(agent.drop_point_id);
      users.push({
        id:                agent.id,
        name:              agent.name,
        email:             '—',
        phone:             '—',
        role:              'point_relais',
        status:            agent.is_active ? 'active' : 'suspended',
        dropPointName:     dp?.name,
        dropPointCommune:  dp?.commune,
        agentNumber:       agent.agent_number,
        joinedDate:        new Date(agent.created_at).toLocaleDateString('fr-FR'),
        type:              'drop_point_agent',
      });
    }

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[roles/users GET] error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

export interface UserEntry {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending' | 'rejected';
  agencyStatus?: string;
  agencyId?: string;           // Pour les livreurs : ID de l'agence parente
  dropPointName?: string;
  dropPointCommune?: string;
  agentNumber?: string;
  joinedDate: string;
  type: 'profile' | 'drop_point_agent';
}

export type UserRole = 'vendeur' | 'agence' | 'livreur' | 'point_relais' | 'superadmin';

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, userId, userType, isActive, newRole } = body as {
      action: 'toggle-status' | 'change-role';
      userId: string;
      userType: 'profile' | 'drop_point_agent';
      isActive?: boolean;
      newRole?: string;
    };

    if (!action || !userId) {
      return NextResponse.json({ error: 'action et userId requis.' }, { status: 400 });
    }

    if (action === 'toggle-status') {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive requis.' }, { status: 400 });
      }

      if (userType === 'drop_point_agent') {
        const { error } = await supabase
          .from('drop_point_agents')
          .update({ is_active: isActive })
          .eq('id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: isActive })
          .eq('id', userId);
        if (error) throw error;

        // Pour les agences : mettre aussi à jour agencies.status
        const { data: p } = await supabase
          .from('profiles').select('role').eq('id', userId).single();
        if (p?.role === 'agence') {
          await supabase
            .from('agencies')
            .update({ status: isActive ? 'APPROVED' : 'SUSPENDED' })
            .eq('id', userId);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Compte ${isActive ? 'activé' : 'suspendu'} avec succès.`,
      });
    }

    if (action === 'change-role') {
      if (!newRole || userType === 'drop_point_agent') {
        return NextResponse.json({ error: 'Changement de rôle non supporté pour ce type.' }, { status: 400 });
      }
      const validRoles = ['vendeur', 'agence', 'livreur'];
      if (!validRoles.includes(newRole)) {
        return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;

      return NextResponse.json({ success: true, message: `Rôle modifié en "${newRole}".` });
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (err) {
    console.error('[roles/users POST] error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
