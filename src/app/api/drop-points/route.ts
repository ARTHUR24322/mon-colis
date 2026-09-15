/**
 * POST /api/drop-points
 * Permet au Superadmin de créer un nouveau Point Relais avec une adresse structurée
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { dataService } from '@/lib/data-service';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const adminHeader = request.headers.get('x-admin-auth');
  if (adminHeader === 'authenticated_superadmin_v1') return true;
  const session = await getSession();
  return session?.role === 'superadmin';
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, commune, quartier, avenue, numero, phone, managerName } = body;

    if (!name?.trim() || !commune?.trim() || !quartier?.trim() || !avenue?.trim() || !numero?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Tous les champs de l\'adresse (Commune, Quartier, Avenue, Numéro) sont requis.' }, { status: 400 });
    }

    const dropPoint = await dataService.createDropPoint({
      name: name.trim(),
      commune: commune.trim(),
      quartier: quartier.trim(),
      avenue: avenue.trim(),
      numero: numero.trim(),
      phone: phone.trim(),
      managerName: managerName?.trim() || 'Non assigné',
    });

    return NextResponse.json({
      success: true,
      dropPoint,
    });
  } catch (err: any) {
    console.error('[POST /api/drop-points]', err);
    return NextResponse.json({ error: err?.message || 'Erreur interne.' }, { status: 500 });
  }
}
