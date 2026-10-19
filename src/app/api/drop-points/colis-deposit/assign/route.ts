/**
 * POST /api/drop-points/colis-deposit/assign
 * Assign an agency to a ColisItem that was deposited by a vendor at a drop point
 */
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/data-service';

export async function POST() {
  return NextResponse.json({
    error: 'Action non autorisée : seul le vendeur peut choisir l’agence de livraison. Le point relais ne peut pas modifier l’agence attribuée.'
  }, { status: 403 });
}
