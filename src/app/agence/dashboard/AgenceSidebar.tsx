'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Truck, DollarSign, Settings,
  Building2, LogOut, Bell, ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/agence/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { href: '/agence/dashboard/colis', icon: Package, label: 'Colis & Dispatch' },
  { href: '/agence/dashboard/livreurs', icon: Truck, label: 'Livreurs' },
  { href: '/agence/dashboard/finances', icon: DollarSign, label: 'Finances' },
  { href: '/agence/dashboard/parametres', icon: Settings, label: 'Paramètres' },
];

interface AgenceSidebarProps {
  agencyName: string;
  onLogout: () => void;
  unreadNotifications?: number;
}

export default function AgenceSidebar({ agencyName, onLogout, unreadNotifications = 0 }: AgenceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside style={{
      width: '240px',
      minWidth: '240px',
      height: '100vh',
      background: '#0d1117',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '1.25rem 1.25rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={18} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#fff', lineHeight: 1 }}>Moncolis</div>
            <div style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: '700', marginTop: '1px' }}>AGENCE</div>
          </div>
        </div>
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 0.6rem', borderRadius: '8px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
        }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Connecté en tant que</div>
          <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#fcd34d', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agencyName}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/agence/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 0.75rem', borderRadius: '8px',
                background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                color: isActive ? '#fcd34d' : '#94a3b8',
                textDecoration: 'none', fontSize: '0.85rem', fontWeight: isActive ? '700' : '500',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && <ChevronRight size={12} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '0.75rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.6rem 0.75rem', borderRadius: '8px',
            background: 'transparent', border: '1px solid transparent',
            color: '#64748b', fontSize: '0.82rem', cursor: 'pointer',
            width: '100%', position: 'relative',
          }}
        >
          <Bell size={15} />
          <span>Notifications</span>
          {unreadNotifications > 0 && (
            <span style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: '#ef4444', color: '#fff', borderRadius: '10px',
              fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', minWidth: '16px', textAlign: 'center',
            }}>
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.6rem 0.75rem', borderRadius: '8px',
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
            color: '#f87171', fontSize: '0.82rem', cursor: 'pointer', width: '100%',
          }}
        >
          <LogOut size={15} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
