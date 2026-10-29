'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { useCurrency } from '@/components/CurrencyContext';
import {
  LayoutDashboard,
  Package,
  QrCode,
  Truck,
  Wallet,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Search,
  LogOut,
  Building2,
  Bell,
  Clock,
  Command,
  Check,
  ShieldCheck,
  X,
  ExternalLink,
  Boxes
} from 'lucide-react';
import { AGENCY_ROLE_LABELS, normalizeAgencyRole, hasAgencyPermission, AgencyRole } from '@/lib/agencyPermissions';
import './../../app/agence/agency.css';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  permission?: keyof typeof import('@/lib/agencyPermissions').AGENCY_ROLE_PERMISSIONS.directeur;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', href: '/agence/dashboard', icon: LayoutDashboard },
  { label: 'Gestion Colis', href: '/agence/colis', icon: Package, permission: 'canViewPackages' },
  { label: 'Réception & Scan', href: '/agence/reception', icon: QrCode, permission: 'canScanPackages' },
  { label: 'Entrepôt & Stock', href: '/agence/entrepot', icon: Boxes, permission: 'canScanPackages' },
  { label: 'Flotte Livreurs', href: '/agence/livreurs', icon: Truck, permission: 'canManageDrivers' },
  { label: 'Versements & Caisse', href: '/agence/versements', icon: Wallet, permission: 'canViewFinances' },
  { label: 'Équipe & Accès', href: '/agence/equipe', icon: Users, permission: 'canManageTeam' },
  { label: 'Rapports & Exports', href: '/agence/rapports', icon: BarChart3, permission: 'canExportReports' },
  { label: 'Paramètres Agence', href: '/agence/parametres', icon: Settings, permission: 'canManageSettings' },
];

export default function AgencyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth('agence');
  const { currency, setCurrency } = useCurrency();

  // Collapsible sidebar state (persisted in localStorage)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mc_agency_sidebar_collapsed') === 'true';
    }
    return false;
  });

  // Theme state: light by default as required, with toggle to dark
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Command palette modal (Ctrl+K)
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications temps réel agence
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; read: boolean; created_at: string }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchAgencyNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silencieux
    }
  };

  const markAllAgencyNotifsAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silencieux
    }
  };

  useEffect(() => {
    if (user) {
      fetchAgencyNotifications();
      const interval = setInterval(fetchAgencyNotifications, 25000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Clock in Kinshasa timezone (UTC+1)
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    // Read persisted theme
    const savedTheme = localStorage.getItem('mc_agency_theme') as 'light' | 'dark' | null;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mc_agency_theme', next);
    }
  };

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mc_agency_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Kinshasa digital clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut listener (Ctrl+K for palette, Ctrl+B for sidebar toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(v => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute active user role & details
  const userAgencyRole = normalizeAgencyRole(user?.agencyRole);
  const roleMeta = AGENCY_ROLE_LABELS[userAgencyRole];

  // Filter navigation items by role permissions
  const filteredNav = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      return hasAgencyPermission(userAgencyRole, item.permission);
    });
  }, [userAgencyRole]);

  // Compute breadcrumbs
  const breadcrumbItems = useMemo(() => {
    const matched = NAV_ITEMS.find(item => pathname === item.href || (item.href !== '/agence' && pathname.startsWith(item.href)));
    return [
      { label: 'Espace Agence', href: '/agence/dashboard' },
      ...(matched ? [{ label: matched.label, href: matched.href }] : [])
    ];
  }, [pathname]);

  // Filtered command palette links
  const commandResults = useMemo(() => {
    if (!searchQuery.trim()) return filteredNav;
    const q = searchQuery.toLowerCase().trim();
    return filteredNav.filter(item => item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q));
  }, [searchQuery, filteredNav]);

  const handleCommandNavigate = (href: string) => {
    setCommandOpen(false);
    setSearchQuery('');
    router.push(href);
  };

  const handleTrackingSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setCommandOpen(false);
    router.push(`/agence/colis?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery('');
  };

  return (
    <div className={`agency-layout agency-theme-${theme}`}>
      {/* ─── SIDEBAR GAUCHE ────────────────────────────────────────────────── */}
      <aside
        style={{
          width: collapsed ? '72px' : '260px',
          minWidth: collapsed ? '72px' : '260px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: 'var(--ag-sidebar-bg)',
          borderRight: '1px solid var(--ag-sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 40,
          boxShadow: 'var(--ag-card-shadow)',
        }}
      >
        {/* En-tête Agence */}
        <div
          style={{
            height: '64px',
            padding: collapsed ? '0 12px' : '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--ag-sidebar-border)',
          }}
        >
          <Link
            href="/agence/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--ag-brand), #b45309)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: '900',
                fontSize: '1.1rem',
                flexShrink: 0,
                boxShadow: '0 2px 8px var(--ag-brand-glow)',
              }}
            >
              <Building2 size={20} />
            </div>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--ag-text-primary)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                  {user?.name || 'Mon Colis Agence'}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--ag-brand)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Espace Pro Desk
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation principale */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {!collapsed && (
            <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px 8px' }}>
              Menu Opérations
            </div>
          )}

          {filteredNav.map(item => {
            const isActive = pathname === item.href || (item.href !== '/agence/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: collapsed ? '10px 0' : '10px 14px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? 'var(--ag-brand)' : 'var(--ag-sidebar-text)',
                  backgroundColor: isActive ? 'var(--ag-sidebar-active-bg)' : 'transparent',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <Icon size={19} style={{ flexShrink: 0, color: isActive ? 'var(--ag-brand)' : 'inherit' }} />
                {!collapsed && (
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '15%',
                      bottom: '15%',
                      width: '3px',
                      backgroundColor: 'var(--ag-brand)',
                      borderRadius: '0 4px 4px 0',
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pied de sidebar : Profil Agent + Replier */}
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid var(--ag-sidebar-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Badge Agent connecté */}
          <div
            style={{
              padding: collapsed ? '8px 0' : '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--ag-surface-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: roleMeta.badgeBg,
                  color: roleMeta.badgeColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '0.8rem',
                  flexShrink: 0,
                }}
              >
                {(user?.name || 'A')[0].toUpperCase()}
              </div>
              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--ag-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user?.name || 'Agent'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: roleMeta.badgeColor, fontWeight: '700' }}>
                    {roleMeta.label}
                  </span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={logout}
                title="Déconnexion"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--ag-text-muted)',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>

          {/* Bouton Replier / Agrandir */}
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Agrandir le menu (Ctrl+B)' : 'Réduire le menu (Ctrl+B)'}
            style={{
              width: '100%',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid var(--ag-border)',
              backgroundColor: 'var(--ag-surface)',
              color: 'var(--ag-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: '600',
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Réduire menu</span></>}
          </button>
        </div>
      </aside>

      {/* ─── ZONE PRINCIPALE (HEADER + CONTENU) ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar fixe */}
        <header
          style={{
            height: '64px',
            position: 'sticky',
            top: 0,
            background: 'var(--ag-topbar-bg)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--ag-topbar-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            zIndex: 30,
          }}
        >
          {/* Fil d'Ariane */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
            {breadcrumbItems.map((crumb, idx) => (
              <React.Fragment key={crumb.href}>
                {idx > 0 && <span style={{ color: 'var(--ag-text-muted)' }}>/</span>}
                <Link
                  href={crumb.href}
                  style={{
                    color: idx === breadcrumbItems.length - 1 ? 'var(--ag-text-primary)' : 'var(--ag-text-muted)',
                    fontWeight: idx === breadcrumbItems.length - 1 ? '700' : '500',
                    textDecoration: 'none',
                  }}
                >
                  {crumb.label}
                </Link>
              </React.Fragment>
            ))}
          </div>

          {/* Outils & Actions Topbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Bouton Recherche Globale / Ctrl+K */}
            <button
              onClick={() => setCommandOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '10px',
                border: '1px solid var(--ag-border)',
                backgroundColor: 'var(--ag-surface)',
                color: 'var(--ag-text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Search size={14} />
              <span>Recherche colis ou commande...</span>
              <kbd
                style={{
                  background: 'var(--ag-surface-hover)',
                  border: '1px solid var(--ag-border)',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  color: 'var(--ag-text-secondary)',
                }}
              >
                Ctrl K
              </kbd>
            </button>

            {/* Sélecteur de Devise USD / CDF */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--ag-surface)',
                border: '1px solid var(--ag-border)',
                borderRadius: '8px',
                padding: '2px',
              }}
            >
              <button
                onClick={() => setCurrency('USD')}
                style={{
                  border: 'none',
                  background: currency === 'USD' ? 'var(--ag-brand)' : 'transparent',
                  color: currency === 'USD' ? '#fff' : 'var(--ag-text-secondary)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                USD $
              </button>
              <button
                onClick={() => setCurrency('CDF')}
                style={{
                  border: 'none',
                  background: currency === 'CDF' ? 'var(--ag-brand)' : 'transparent',
                  color: currency === 'CDF' ? '#fff' : 'var(--ag-text-secondary)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                CDF FC
              </button>
            </div>

            {/* Heure Kinshasa & Live Polling Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--ag-surface)',
                border: '1px solid var(--ag-border)',
                fontSize: '0.75rem',
                color: 'var(--ag-text-secondary)',
                fontWeight: '600',
              }}
            >
              <span className="animate-ag-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--ag-success)' }} />
              <Clock size={13} style={{ color: 'var(--ag-text-muted)' }} />
              <span>{timeStr || 'Kinshasa'}</span>
            </div>

            {/* Cloche Notifications Agence */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                title="Notifications de l'agence"
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid var(--ag-border)',
                  backgroundColor: 'var(--ag-surface)',
                  color: 'var(--ag-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    backgroundColor: '#ef4444', color: '#fff', borderRadius: '10px',
                    fontSize: '0.62rem', fontWeight: '800', padding: '1px 5px',
                    border: '2px solid var(--ag-topbar-bg)'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown des Notifications */}
              {notifOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '46px', width: '360px',
                  maxHeight: '440px', backgroundColor: 'var(--ag-surface)',
                  border: '1px solid var(--ag-border)', borderRadius: '16px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.25)', zIndex: 100,
                  display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--ag-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bell size={16} style={{ color: 'var(--ag-brand)' }} />
                      <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--ag-text-primary)' }}>
                        Notifications ({notifications.length})
                      </span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAgencyNotifsAsRead}
                        style={{
                          background: 'none', border: 'none', color: 'var(--ag-brand)',
                          fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', padding: 0
                        }}
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  <div style={{ padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px' }}>
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--ag-text-muted)' }}>
                        <p style={{ margin: 0, fontSize: '0.8rem' }}>Aucune notification récente.</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          style={{
                            padding: '10px 12px', borderRadius: '10px',
                            backgroundColor: n.read ? 'transparent' : 'var(--ag-surface-hover)',
                            border: n.read ? '1px solid transparent' : '1px solid var(--ag-border)',
                            display: 'flex', flexDirection: 'column', gap: '3px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: n.read ? 'var(--ag-text-secondary)' : 'var(--ag-text-primary)' }}>
                              {n.title}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--ag-text-muted)' }}>
                              {new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ag-text-muted)', lineHeight: 1.4 }}>
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Switch Mode Sombre / Clair */}
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Activer mode sombre' : 'Activer mode clair'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--ag-border)',
                backgroundColor: 'var(--ag-surface)',
                color: 'var(--ag-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} color="#f59e0b" />}
            </button>
          </div>
        </header>

        {/* Corps de page */}
        <main
          style={{
            flex: 1,
            padding: '28px 32px',
            maxWidth: '1920px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </main>
      </div>

      {/* ─── MODAL PALETTE DE COMMANDES (CTRL+K) ───────────────────────────── */}
      {commandOpen && (
        <div
          onClick={() => setCommandOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--ag-modal-overlay)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '580px',
              backgroundColor: 'var(--ag-surface-elevated)',
              border: '1px solid var(--ag-border)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              animation: 'agFadeIn 0.15s ease-out',
            }}
          >
            {/* Input de recherche */}
            <form onSubmit={handleTrackingSearchSubmit} style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--ag-border)' }}>
              <Search size={18} style={{ color: 'var(--ag-brand)', marginRight: '12px' }} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher un code colis (ex: MC-...) ou naviguer..."
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--ag-text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
              <kbd style={{ fontSize: '0.7rem', color: 'var(--ag-text-muted)', border: '1px solid var(--ag-border)', padding: '2px 6px', borderRadius: '4px' }}>ESC</kbd>
            </form>

            {/* Liste de résultats */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
              {searchQuery.trim().length > 0 && (
                <div
                  onClick={handleTrackingSearchSubmit}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--ag-surface-hover)',
                    cursor: 'pointer',
                    marginBottom: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Package size={16} color="var(--ag-brand)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                      Rechercher le colis « <strong>{searchQuery}</strong> »
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ag-brand)', fontWeight: '700' }}>Entrée ↵</span>
                </div>
              )}

              <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 12px 4px' }}>
                Accès Rapide aux Pages
              </div>

              {commandResults.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.href}
                    onClick={() => handleCommandNavigate(item.href)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--ag-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Icon size={16} style={{ color: 'var(--ag-text-secondary)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--ag-text-primary)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)' }}>{item.href}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
