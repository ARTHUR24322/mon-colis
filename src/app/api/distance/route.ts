/**
 * GET /api/distance?from=<adresse agence>&to=<adresse client>
 * Utilise OpenStreetMap Nominatim pour géocoder les deux adresses,
 * puis calcule la distance Haversine (vol d'oiseau) × 1.3 (facteur route urbaine).
 */
import { NextRequest, NextResponse } from 'next/server';

// Haversine formula: distance en km entre deux coordonnées GPS
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // rayon Terre en km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function cleanAddress(addr: string): string {
  let clean = addr;
  // Enlever le pays/ville s'il a été ajouté manuellement avant
  clean = clean.replace(/,\s*kinshasa\s*republique\s*democratique\s*du\s*congo/gi, '');
  clean = clean.replace(/,\s*kinshasa/gi, '');
  
  // Enlever les références entre parenthèses (ex: Réf: 7ème rue)
  clean = clean.replace(/\([^)]*\)/g, '');
  
  // Enlever les numéros de parcelle N° xx
  clean = clean.replace(/N°\s*\d+[a-zA-Z]*/gi, '');
  clean = clean.replace(/No\s*\d+[a-zA-Z]*/gi, '');
  clean = clean.replace(/N\s*\d+[a-zA-Z]*/gi, '');

  // Remplacer les abréviations connues
  clean = clean.replace(/Av\.\s*/gi, 'Avenue ');
  clean = clean.replace(/Q\.\s*/gi, 'Quartier ');
  
  // Nettoyage des virgules
  clean = clean.replace(/\s*,\s*/g, ', ').replace(/(,\s*)+/g, ', ').trim();
  clean = clean.replace(/^,|,$/g, '').trim();
  
  return clean;
}

async function geocode(address: string, isFallback = false): Promise<{ lat: number; lon: number; display: string } | null> {
  const cleaned = cleanAddress(address);
  // On précise "Kinshasa, RDC" pour améliorer la précision de Nominatim
  const query = `${cleaned}, Kinshasa, République Démocratique du Congo`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Moncolis-App/1.0 (contact@moncolis.cd)',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          display: data[0].display_name,
        };
      }
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  // Fallback: si l'adresse exacte n'est pas trouvée, on essaie de trouver uniquement avec le premier élément (qui est souvent la Commune ou l'Avenue)
  if (!isFallback) {
    const parts = cleaned.split(',');
    if (parts.length > 1) {
      // Ex: on prend juste "Limete"
      return geocode(parts[0], true);
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      { error: 'Paramètres "from" et "to" requis.' },
      { status: 400 }
    );
  }

  // Géocodage des deux adresses en parallèle
  const [origin, destination] = await Promise.all([
    geocode(from),
    geocode(to),
  ]);

  if (!origin) {
    return NextResponse.json(
      { error: `Impossible de localiser l'adresse de départ : "${from}". Vérifiez l'adresse de votre agence dans les paramètres.` },
      { status: 422 }
    );
  }

  if (!destination) {
    return NextResponse.json(
      { error: `Impossible de localiser l'adresse de destination : "${to}". L'adresse du client est peut-être trop imprécise.` },
      { status: 422 }
    );
  }

  // Distance à vol d'oiseau
  const distanceBirdFly = haversine(origin.lat, origin.lon, destination.lat, destination.lon);

  // Facteur correctif pour routes urbaines (Kinshasa = 1.35 en moyenne)
  const URBAN_FACTOR = 1.35;
  const distanceKm = parseFloat((distanceBirdFly * URBAN_FACTOR).toFixed(1));

  return NextResponse.json({
    distanceKm,
    distanceBirdFly: parseFloat(distanceBirdFly.toFixed(1)),
    origin: { address: from, lat: origin.lat, lon: origin.lon, display: origin.display },
    destination: { address: to, lat: destination.lat, lon: destination.lon, display: destination.display },
  });
}
