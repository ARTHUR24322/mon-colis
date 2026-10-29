/**
 * POST /api/agency/drivers
 * Body: { name, phone, vehicle, pinCode }
 * Creates a new driver associated with the logged-in agency.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const driverSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  phone: z.string().min(6, 'Le numéro de téléphone est requis.'),
  vehicle: z.string().optional(),
  pinCode: z.string().length(4, 'Le code PIN doit contenir exactement 4 chiffres.'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const result = driverSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, phone, vehicle, pinCode } = result.data;
    const hashedPin = await bcrypt.hash(pinCode, 10);

    // 1. Créer d'abord le profil (le nom est dans profiles, pas dans drivers)
    const newId = crypto.randomUUID();
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newId,
        role: 'livreur',
        name,
        phone,
      });

    if (profileError) {
      console.error('Error inserting driver profile:', profileError);
      return NextResponse.json({ error: 'Erreur lors de la création du profil livreur.' }, { status: 500 });
    }

    // 2. Créer le livreur avec l'ID du profil
    const { data: newDriver, error } = await supabaseAdmin
      .from('drivers')
      .insert({
        id: newId,
        agency_id: session.agencyId,
        phone,
        pin_code: hashedPin,
        available: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting driver:', error);
      await supabaseAdmin.from('profiles').delete().eq('id', newId);
      return NextResponse.json({ error: 'Erreur lors de la création du livreur.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      driver: {
        id: newDriver.id,
        name,
        phone,
        vehicle,
      },
    });
  } catch (err) {
    console.error('[POST /api/agency/drivers]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

/**
 * GET /api/agency/drivers
 * Retourne tous les livreurs de l'agence avec :
 * - Nombre de livraisons effectuées
 * - Courses actives en cours
 * - Cash collecté (COD)
 * - Historique des versements
 * - Cash actuellement dû à l'agence
 * - Statistiques globales de la flotte
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'agence' || !session.agencyId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    // 1. Récupérer les données en parallèle
    const [driversRes, packagesRes, cashReqsRes, sysRes] = await Promise.all([
      supabaseAdmin
        .from('drivers')
        .select('id, agency_id, phone, available, created_at, profiles:profiles(id, name, phone)')
        .eq('agency_id', session.agencyId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('packages')
        .select('id, tracking_code, driver_id, status, package_price, delivery_price, is_prepaid, paid_by_client, client_name, client_commune, created_at, updated_at')
        .eq('agency_id', session.agencyId)
        .not('driver_id', 'is', null)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('driver_cash_requests')
        .select('id, driver_id, amount, status, note, type, created_at, resolved_at')
        .eq('agency_id', session.agencyId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('system_settings')
        .select('exchange_rate')
        .eq('id', 'global')
        .maybeSingle(),
    ]);

    if (driversRes.error) {
      console.error('[GET /api/agency/drivers] Drivers Error:', driversRes.error);
      return NextResponse.json({ error: 'Erreur récupération livreurs.' }, { status: 500 });
    }

    const rate = sysRes.data?.exchange_rate || 2400;
    const allPackages = packagesRes.data || [];
    const allCashRequests = cashReqsRes.data || [];

    // Indexer les colis par driver_id
    const packagesByDriver = new Map<string, any[]>();
    for (const p of allPackages) {
      if (!p.driver_id) continue;
      const list = packagesByDriver.get(p.driver_id) || [];
      list.push(p);
      packagesByDriver.set(p.driver_id, list);
    }

    // Indexer les demandes de versement par driver_id
    const cashReqsByDriver = new Map<string, any[]>();
    for (const cr of allCashRequests) {
      if (!cr.driver_id) continue;
      const list = cashReqsByDriver.get(cr.driver_id) || [];
      list.push(cr);
      cashReqsByDriver.set(cr.driver_id, list);
    }

    // Calculs par livreur
    let totalFleetDeliveries = 0;
    let totalFleetActiveCourses = 0;
    let totalFleetCashOwed = 0;
    let totalFleetCashDeposited = 0;
    let totalFleetPendingDeposits = 0;

    const formatted = (driversRes.data || []).map((d: any) => {
      const driverProfile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
      const driverPkgs = packagesByDriver.get(d.id) || [];
      const driverReqs = cashReqsByDriver.get(d.id) || [];

      // Livraisons réussies
      const deliveredPkgs = driverPkgs.filter(p => p.status === 'DELIVERED');
      const totalDeliveries = deliveredPkgs.length;

      // Courses actives en cours
      const activePkgs = driverPkgs.filter(p => ['ASSIGNED_TO_DRIVER', 'IN_TRANSIT'].includes(p.status));
      const activeCourses = activePkgs.length;

      // Cash collecté en main propre chez les clients (COD)
      const totalCollectedCash = deliveredPkgs.reduce((sum, p) => {
        const itemCash = p.is_prepaid ? 0 : (Number(p.package_price) || 0);
        const rawLiv = Number(p.delivery_price) || 0;
        const normLiv = rawLiv > 50 ? parseFloat((rawLiv / rate).toFixed(2)) : rawLiv;
        const deliveryCash = p.paid_by_client !== false ? normLiv : 0;
        return sum + itemCash + deliveryCash;
      }, 0);

      // Total des dépôts validés / encaissés par l'agence
      const depositedCash = driverReqs
        .filter(cr => cr.status === 'PAID')
        .reduce((sum, cr) => sum + (Number(cr.amount) || 0), 0);

      // Total des dépôts en attente au guichet
      const pendingDeposits = driverReqs
        .filter(cr => cr.status === 'PENDING')
        .reduce((sum, cr) => sum + (Number(cr.amount) || 0), 0);

      // Montant dû à l'agence (Cash en main non encore déposé)
      const cashOwed = Math.max(0, parseFloat((totalCollectedCash - depositedCash).toFixed(2)));

      // Accumuler les totaux flotte
      totalFleetDeliveries += totalDeliveries;
      totalFleetActiveCourses += activeCourses;
      totalFleetCashOwed += cashOwed;
      totalFleetCashDeposited += depositedCash;
      totalFleetPendingDeposits += pendingDeposits;

      // Activités récentes (courses)
      const recentCourses = driverPkgs.slice(0, 25).map(p => {
        const rawLiv = Number(p.delivery_price) || 0;
        const normLiv = rawLiv > 50 ? parseFloat((rawLiv / rate).toFixed(2)) : rawLiv;
        const collected = (p.is_prepaid ? 0 : (Number(p.package_price) || 0)) + (p.paid_by_client !== false ? normLiv : 0);
        return {
          id: p.id,
          trackingCode: p.tracking_code || ('MC-' + p.id.slice(0, 8).toUpperCase()),
          clientName: p.client_name || 'Client',
          clientCommune: p.client_commune || '—',
          status: p.status,
          packagePrice: Number(p.package_price) || 0,
          deliveryPrice: normLiv,
          collectedAmount: collected,
          isPrepaid: p.is_prepaid || false,
          paidByClient: p.paid_by_client !== false,
          date: p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—',
        };
      });

      // Historique des dépôts de caisse
      const versementsHistory = driverReqs.map(cr => ({
        id: cr.id,
        amount: Number(cr.amount) || 0,
        status: cr.status,
        type: cr.type || 'MANUAL',
        note: cr.note || '—',
        created_at: cr.created_at,
        resolved_at: cr.resolved_at,
      }));

      return {
        id: d.id,
        name: driverProfile?.name || 'Livreur',
        phone: d.phone || driverProfile?.phone || '',
        available: d.available !== false,
        created_at: d.created_at,
        totalDeliveries,
        activeCourses,
        totalCollectedCash: parseFloat(totalCollectedCash.toFixed(2)),
        totalDepositedCash: parseFloat(depositedCash.toFixed(2)),
        cashOwedToAgency: cashOwed,
        pendingDeposits: parseFloat(pendingDeposits.toFixed(2)),
        recentCourses,
        versementsHistory,
      };
    });

    const statsGlobales = {
      totalDrivers: formatted.length,
      availableDrivers: formatted.filter(d => d.available).length,
      totalFleetDeliveries,
      totalFleetActiveCourses,
      totalFleetCashOwed: parseFloat(totalFleetCashOwed.toFixed(2)),
      totalFleetCashDeposited: parseFloat(totalFleetCashDeposited.toFixed(2)),
      totalFleetPendingDeposits: parseFloat(totalFleetPendingDeposits.toFixed(2)),
    };

    return NextResponse.json({
      drivers: formatted,
      stats: statsGlobales,
    });
  } catch (err) {
    console.error('[GET /api/agency/drivers]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
