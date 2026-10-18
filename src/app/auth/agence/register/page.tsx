import { redirect } from 'next/navigation';

/**
 * Ancienne route d'inscription agence — redirig\u00e9e vers /agence.
 * La demande d'adh\u00e9sion agence se fait uniquement depuis /agence.
 */
export default function AgenceRegisterRedirect() {
  redirect('/agence');
}

export const metadata = {
  robots: 'noindex, nofollow',
};
