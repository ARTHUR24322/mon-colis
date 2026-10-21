/**
 * GET /api/agency/cash-requests
 * Retourne toutes les demandes de versement des livreurs pour l'agence connectée.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    // Récupérer les demandes associées à l'agence (soit créées pour elle, soit confirmées par elle)
    let { data: requests, error } = await supabase
      .from('driver_cash_requests')
      .select(`
        id,
        driver_id,
        amount,
        status,
        note,
        reject_reason,
        created_at,
        resolved_at,
        confirmed_by_agency_id,
        driver:drivers(phone, profile:profiles(name))
      `)
      .or(`agency_id.eq.${session.agencyId},confirmed_by_agency_id.eq.${session.agencyId}`)
      .order('created_at', { ascending: false })
      .limit(100);

    // Si la jointure driver:drivers a échoué (par exemple à cause d'un nom de relation non reconnu)
    if (error) {
      console.warn('Jointure drivers échouée, fallback requête simple:', error);
      const simpleRes = await supabase
        .from('driver_cash_requests')
        .select('*')
        .or(`agency_id.eq.${session.agencyId},confirmed_by_agency_id.eq.${session.agencyId}`)
        .order('created_at', { ascending: false })
        .limit(100);
      requests = simpleRes.data;
      error = simpleRes.error;
    }

    if (error) {
      console.error('Cash requests fetch error:', error);
      return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
    }

    // Compléter les informations manquantes des livreurs si besoin
    const driverIds = [...new Set((requests ?? []).map((r: any) => r.driver_id).filter(Boolean))];
    const driverMap = new Map<string, { name: string; phone: string }>();

    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id, phone, profile:profiles(name)')
        .in('id', driverIds);

      (drivers || []).forEach((d: any) => {
        const pName = Array.isArray(d.profile) ? d.profile[0]?.name : d.profile?.name;
        driverMap.set(d.id, { name: pName || 'Livreur', phone: d.phone || '' });
      });

      // Aussi chercher dans profiles directement au cas où driver_id est un profile_id
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', driverIds);

      (profs || []).forEach((p: any) => {
        if (!driverMap.has(p.id) || driverMap.get(p.id)?.name === 'Livreur') {
          driverMap.set(p.id, { name: p.name || 'Livreur', phone: p.phone || '' });
        }
      });
    }

    const enriched = (requests ?? []).map((r: any) => {
      const fallback = driverMap.get(r.driver_id);
      const drv = Array.isArray(r.driver) ? r.driver[0] : r.driver;
      const prof = drv ? (Array.isArray(drv.profile) ? drv.profile[0] : drv.profile) : null;

      return {
        ...r,
        driver: {
          phone: drv?.phone || fallback?.phone || '',
          profile: {
            name: prof?.name || fallback?.name || 'Livreur',
          },
        },
      };
    });

    const pendingCount = enriched.filter(r => r.status === 'PENDING').length;

    return NextResponse.json({ requests: enriched, pendingCount });
  } catch (err) {
    console.error('[GET /api/agency/cash-requests]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
