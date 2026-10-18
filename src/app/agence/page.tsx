import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session-server';

/**
 * /agence — Point d'entrée secret de l'espace agence.
 * - Non indexé (noindex dans metadata + header X-Robots-Tag dans middleware)
 * - Non listé dans robots.txt ni sitemap
 * - Redirige vers le dashboard si session agence active
 * - Redirige vers /agence/login sinon
 */
export default async function AgenceRoot() {
  const session = await getSession();
  if (session?.role === 'agence') {
    redirect('/agence/dashboard');
  }
  redirect('/agence/login');
}

export const metadata = {
  robots: 'noindex, nofollow, noarchive',
};
