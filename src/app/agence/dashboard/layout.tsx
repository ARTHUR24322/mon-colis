'use client';

import { useAuth } from '@/lib/use-auth';
import { useRouter } from 'next/navigation';
import AgenceSidebar from './AgenceSidebar';

/**
 * Layout client pour toutes les pages /agence/dashboard/*.
 * Affiche la sidebar et le contenu principal côte à côte.
 * Desktop-first : 1280px → 1920px.
 */
export default function AgenceDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth('agence');
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/agence/login');
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#07090e',
      color: '#e2e8f0',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <AgenceSidebar
        agencyName={user?.name || 'Agence'}
        onLogout={handleLogout}
      />
      <main style={{
        flex: 1,
        minWidth: 0,
        overflowX: 'hidden',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  );
}
