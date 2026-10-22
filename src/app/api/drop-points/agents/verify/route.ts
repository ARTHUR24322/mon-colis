/**
 * POST /api/drop-points/agents/verify
 * Body: { agentNumber: string }
 * Used by the driver to verify an agent's 9-digit number before depositing a parcel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataService, DEFAULT_DROP_POINTS } from '@/lib/data-service';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let rawInput = String(body.agentNumber || body.code || body.qrData || '').trim();

    if (!rawInput) {
      return NextResponse.json({ error: 'Code ou numéro agent requis.' }, { status: 400 });
    }

    // Si c'est du JSON scanné depuis un QR code
    if (rawInput.startsWith('{') && rawInput.endsWith('}')) {
      try {
        const parsed = JSON.parse(rawInput);
        if (parsed.agentNumber) rawInput = String(parsed.agentNumber).trim();
        else if (parsed.dropPointId) rawInput = String(parsed.dropPointId).trim();
      } catch {}
    }

    // Cas 1 : Extraire 9 chiffres consécutifs si présents
    const digitsOnly = rawInput.replace(/\D/g, '');
    let candidateAgentNumber: string | null = null;
    if (digitsOnly.length === 9) {
      candidateAgentNumber = digitsOnly;
    } else if (digitsOnly.length > 9) {
      // Chercher si les 9 derniers chiffres ou premiers chiffres correspondent
      candidateAgentNumber = digitsOnly.slice(0, 9);
    }

    if (candidateAgentNumber) {
      const agent = await dataService.verifyAgentNumber(candidateAgentNumber);
      if (agent) {
        return NextResponse.json({ agent });
      }
    }

    // Cas 2 : Chercher par Drop Point ID ou nom dans drop_point_agents
    const { data: agentRecord } = await supabase
      .from('drop_point_agents')
      .select('id, agent_number, name, drop_point_id, is_active')
      .or(`drop_point_id.eq.${rawInput},agent_number.eq.${rawInput}`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (agentRecord) {
      const dp = dataService.getDropPointById(agentRecord.drop_point_id);
      return NextResponse.json({
        agent: {
          id: agentRecord.id,
          agentNumber: agentRecord.agent_number,
          name: agentRecord.name,
          dropPointId: agentRecord.drop_point_id,
          dropPointName: dp?.name || agentRecord.drop_point_id,
          dropPointCommune: dp?.commune || '',
          isActive: true,
        }
      });
    }

    // Cas 3 : Chercher dans la table drop_points
    const { data: dpRecord } = await supabase
      .from('drop_points')
      .select('id, name, commune, manager_name, phone')
      .or(`id.eq.${rawInput},phone.eq.${rawInput}`)
      .limit(1)
      .maybeSingle();

    if (dpRecord) {
      const { data: linkedAgent } = await supabase
        .from('drop_point_agents')
        .select('id, agent_number, name')
        .eq('drop_point_id', dpRecord.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        agent: {
          id: linkedAgent?.id || dpRecord.id,
          agentNumber: linkedAgent?.agent_number || (digitsOnly.length === 9 ? digitsOnly : '100000001'),
          name: linkedAgent?.name || dpRecord.manager_name || 'Responsable Relais',
          dropPointId: dpRecord.id,
          dropPointName: dpRecord.name,
          dropPointCommune: dpRecord.commune || '',
          isActive: true,
        }
      });
    }

    // Cas 4 : Fallback Drop points par défaut
    const defaultDp = DEFAULT_DROP_POINTS.find(d => d.id === rawInput || d.phone === rawInput);
    if (defaultDp) {
      return NextResponse.json({
        agent: {
          id: defaultDp.id,
          agentNumber: '100000001',
          name: defaultDp.managerName,
          dropPointId: defaultDp.id,
          dropPointName: defaultDp.name,
          dropPointCommune: defaultDp.commune,
          isActive: true,
        }
      });
    }

    return NextResponse.json({
      error: 'Numéro agent ou point relais introuvable. Vérifiez les 9 chiffres avec le point relais.'
    }, { status: 404 });
  } catch (err) {
    console.error('[POST /api/drop-points/agents/verify]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
