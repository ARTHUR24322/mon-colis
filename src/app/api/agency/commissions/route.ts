import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'agence' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const agencyId = session.role === 'agence'
      ? session.agencyId
      : searchParams.get('agencyId') || session.agencyId;

    if (!agencyId) {
      return NextResponse.json({ error: 'Identifiant agence requis.' }, { status: 400 });
    }

    // 1. Récupération des informations de tarification et facturation de l'agence
    const { data: agencyData } = await supabaseAdmin
      .from('agencies')
      .select('id, name, billing_type, billing_value')
      .eq('id', agencyId)
      .single();

    const agencyName = agencyData?.name || 'Votre Agence';
    const billingType: 'Commission' | 'Mensuel' | 'Annuel' = agencyData?.billing_type || 'Commission';
    const billingValue: number = typeof agencyData?.billing_value === 'number' ? agencyData.billing_value : 15;

    // 2. Récupération des colis livrés de l'agence
    const { data: deliveredPackages, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select(`
        id,
        tracking_code,
        client_name,
        client_commune,
        delivery_price,
        package_price,
        status,
        created_at,
        vendeur:profiles!vendeur_id(name, phone)
      `)
      .eq('agency_id', agencyId)
      .in('status', ['DELIVERED', 'Livré'])
      .order('created_at', { ascending: false });

    if (pkgErr) {
      console.warn('Error fetching delivered packages for agency commissions:', pkgErr.message);
    }

    const packagesList = deliveredPackages || [];
    let totalDeliveryGross = 0;
    let totalDeliveryCommissionDue = 0;

    const deliveryItems = packagesList.map((p: any) => {
      const deliveryPrice = Number(p.delivery_price || 0);
      totalDeliveryGross += deliveryPrice;

      // Calcul commission Super Admin sur livraison
      let commRate = 0;
      let commAmount = 0;

      if (billingType === 'Commission') {
        commRate = billingValue;
        commAmount = Number(((deliveryPrice * commRate) / 100).toFixed(2));
      }

      totalDeliveryCommissionDue += commAmount;
      const netAgency = Number((deliveryPrice - commAmount).toFixed(2));

      const vendeurObj = Array.isArray(p.vendeur) ? p.vendeur[0] : p.vendeur;

      return {
        id: p.id,
        tracking_code: p.tracking_code,
        trackingCode: p.tracking_code,
        client_name: p.client_name || 'Client',
        clientName: p.client_name || 'Client',
        client_commune: p.client_commune || '—',
        clientCommune: p.client_commune || '—',
        vendor_name: vendeurObj?.name || 'Vendeur',
        vendorName: vendeurObj?.name || 'Vendeur',
        vendorPhone: vendeurObj?.phone || '',
        delivery_price: deliveryPrice,
        deliveryPrice,
        commission_rate: commRate,
        commissionRate: commRate,
        commission_amount: commAmount,
        commissionAmount: commAmount,
        net_agency: netAgency,
        netAgency,
        delivered_at: p.created_at,
        date: p.created_at,
        currency: 'USD',
      };
    });

    const totalDeliveryNetAgency = Number((totalDeliveryGross - totalDeliveryCommissionDue).toFixed(2));

    // 3. Récupération des abonnements de stockage (Fulfillment / Entrepôt)
    const { data: rawSubscriptions, error: subErr } = await supabaseAdmin
      .from('vendor_storage_subscriptions')
      .select(`
        *,
        space:agency_storage_spaces(*),
        vendor:profiles!vendor_id(id, name, phone, email)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (subErr) {
      console.warn('Error fetching storage subscriptions for agency commissions:', subErr.message);
    }

    const subscriptionsList = rawSubscriptions || [];
    let totalWarehouseGross = 0;
    let totalWarehouseCommissionDue = 0;
    let totalWarehouseNetAgency = 0;

    const warehouseItems = subscriptionsList.map((s: any) => {
      const pricePaid = Number(s.price_paid || 0);
      const spaceObj = Array.isArray(s.space) ? s.space[0] : s.space;
      const vendorObj = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;

      const commRate = typeof s.commission_rate === 'number' && !isNaN(s.commission_rate)
        ? s.commission_rate
        : (typeof spaceObj?.commission_rate === 'number' && !isNaN(spaceObj.commission_rate) ? spaceObj.commission_rate : 10);

      const commAmount = typeof s.commission_amount === 'number' && !isNaN(s.commission_amount) && s.commission_amount > 0
        ? s.commission_amount
        : Number(((pricePaid * commRate) / 100).toFixed(2));

      const netAgency = typeof s.net_agency_amount === 'number' && !isNaN(s.net_agency_amount) && s.net_agency_amount > 0
        ? s.net_agency_amount
        : Number((pricePaid - commAmount).toFixed(2));

      if (s.status === 'ACTIVE') {
        totalWarehouseGross += pricePaid;
        totalWarehouseCommissionDue += commAmount;
        totalWarehouseNetAgency += netAgency;
      }

      return {
        id: s.id,
        vendor_id: s.vendor_id,
        vendorId: s.vendor_id,
        vendor_name: vendorObj?.name || 'Vendeur Partenaire',
        vendorName: vendorObj?.name || 'Vendeur Partenaire',
        vendorPhone: vendorObj?.phone || '',
        space_id: s.storage_space_id,
        spaceId: s.storage_space_id,
        space_title: spaceObj?.name || 'Emplacement',
        spaceName: spaceObj?.name || 'Emplacement',
        slots: s.slots_count || 1,
        slotsCount: s.slots_count || 1,
        price_paid: pricePaid,
        pricePaid,
        currency: s.currency || 'USD',
        status: s.status,
        commission_rate: commRate,
        commissionRate: commRate,
        commission_amount: commAmount,
        commissionAmount: commAmount,
        net_agency_amount: netAgency,
        netAgencyAmount: netAgency,
        start_date: s.start_date,
        startDate: s.start_date,
        end_date: s.end_date,
        endDate: s.end_date,
        created_at: s.created_at,
      };
    });

    const activeWarehouseCount = warehouseItems.filter(s => s.status === 'ACTIVE').length;

    // 4. Synthèse globale
    const totalCommissionDue = Number((totalDeliveryCommissionDue + totalWarehouseCommissionDue).toFixed(2));
    const totalGrossRevenue = Number((totalDeliveryGross + totalWarehouseGross).toFixed(2));
    const totalNetAgency = Number((totalDeliveryNetAgency + totalWarehouseNetAgency).toFixed(2));

    return NextResponse.json({
      success: true,
      agency: {
        id: agencyId,
        name: agencyName,
        billingType,
        billingValue,
        billing_type: billingType,
        billing_value: billingValue,
      },
      summary: {
        totalCommissionDue,
        totalGrossRevenue,
        totalNetAgency,
        currency: 'USD',
      },
      deliveries: {
        billingType,
        billingValue,
        billing_type: billingType,
        billing_value: billingValue,
        count: deliveryItems.length,
        grossRevenue: Number(totalDeliveryGross.toFixed(2)),
        totalDeliveryFees: Number(totalDeliveryGross.toFixed(2)),
        commissionDue: Number(totalDeliveryCommissionDue.toFixed(2)),
        totalDeliveryCommission: Number(totalDeliveryCommissionDue.toFixed(2)),
        netAgency: totalDeliveryNetAgency,
        totalNetDeliveryAgency: totalDeliveryNetAgency,
        items: deliveryItems,
      },
      warehouse: {
        activeCount: activeWarehouseCount,
        count: activeWarehouseCount,
        totalCount: warehouseItems.length,
        grossRevenue: Number(totalWarehouseGross.toFixed(2)),
        totalRentFees: Number(totalWarehouseGross.toFixed(2)),
        commissionDue: Number(totalWarehouseCommissionDue.toFixed(2)),
        totalWarehouseCommission: Number(totalWarehouseCommissionDue.toFixed(2)),
        netAgency: Number(totalWarehouseNetAgency.toFixed(2)),
        totalNetWarehouseAgency: Number(totalWarehouseNetAgency.toFixed(2)),
        items: warehouseItems,
      },
    });
  } catch (err: any) {
    console.error('[GET /api/agency/commissions] Error:', err);
    return NextResponse.json({ error: 'Erreur interne lors du calcul des commissions.' }, { status: 500 });
  }
}
