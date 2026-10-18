import { redirect } from 'next/navigation';

/**
 * Ancienne route publique /auth/agence/login.
 * Redirige silencieusement vers la route secrète /agence.
 * Pas de rendu côté client, pas de contenu indexable.
 */
export default function AgenceLoginRedirect() {
  redirect('/agence');
}

export const metadata = {
  robots: 'noindex, nofollow',
};
