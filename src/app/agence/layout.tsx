import type { Metadata } from 'next';

/**
 * Layout de la zone secrète /agence.
 * - noindex sur toutes les pages /agence/*
 * - Le header X-Robots-Tag est géré par le middleware
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
  // Pas de titre générique pour ne pas indexer
  title: 'Espace Agence',
};

export default function AgenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
