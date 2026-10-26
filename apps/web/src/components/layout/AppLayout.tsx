import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Role } from '@depositdesk/shared';
import { useAuth } from '../../context/AuthContext';
import { api, NotificationItem } from '../../lib/api';
import {
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardCheck,
  FileCheck2,
  AlertOctagon,
  History,
  FileDown,
  Settings,
  Bell,
  LogOut,
  Building2,
  ChevronDown,
  Check,
  Shield,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout, switchDemoRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Fetch notifications
  useEffect(() => {
    if (user) {
      api.notifications
        .list()
        .then((items) => setNotifications(items))
        .catch(() => {
          // Provide mock demo notifications if backend is offline
          setNotifications([
            {
              id: 'n1',
              userId: user.id,
              title: 'Maturity Alert: FDR #FDR-2024-0012',
              message: 'Instrument is expiring in 14 days (Nov 9, 2026). Renewal action required.',
              linkUrl: '/instruments',
              isRead: false,
              createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: 'n2',
              userId: user.id,
              title: 'Release Request Approved',
              message: 'Release Request #REL-8821 for IIT Delhi has been approved by Regional Officer.',
              linkUrl: '/releases',
              isRead: false,
              createdAt: new Date(Date.now() - 7200000).toISOString(),
            },
          ]);
        });
    }
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: [Role.INSTITUTION_USER, Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN] },
    { label: 'FDR / Deposit Registry', path: '/instruments', icon: FileSpreadsheet, roles: [Role.INSTITUTION_USER, Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN] },
    { label: 'Scrutiny Queue', path: '/scrutiny', icon: ClipboardCheck, roles: [Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN] },
    { label: 'Release Requests', path: '/releases', icon: FileCheck2, roles: [Role.INSTITUTION_USER, Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN] },
    { label: 'Discrepancies', path: '/discrepancies', icon: AlertOctagon, roles: [Role.INSTITUTION_USER, Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN] },
    { label: 'Reports & Export', path: '/reports', icon: FileDown, roles: [Role.INSTITUTION_USER, Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN] },
    { label: 'Audit Trail', path: '/audit', icon: History, roles: [Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN] },
    { label: 'Settings & Admin', path: '/admin', icon: Settings, roles: [Role.SYSTEM_ADMIN] },
  ];

  const roleLabels: Record<Role, { title: string; badge: string; color: string }> = {
    [Role.INSTITUTION_USER]: { title: 'Institution User', badge: 'IU', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    [Role.SCRUTINY_OFFICER]: { title: 'Scrutiny Officer', badge: 'SO', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    [Role.APPROVING_AUTHORITY]: { title: 'Approving Authority', badge: 'AA', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    [Role.SYSTEM_ADMIN]: { title: 'System Admin', badge: 'SA', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  };

  const currentRoleConfig = user ? roleLabels[user.role] : roleLabels[Role.INSTITUTION_USER];

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans">
      {/* Top Demo Banner with Instant Role Switcher */}
      <div className="bg-slate-900 text-slate-100 px-4 py-2 flex flex-wrap items-center justify-between text-xs border-b border-slate-800 z-40 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-slate-200">DepositDesk Prototype</span>
          <span className="text-slate-400 hidden sm:inline">· AICTE Security Deposit & FDR Management</span>
        </div>

        {/* Quick Role Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-slate-400 font-medium mr-1 hidden md:inline">Quick Role:</span>
          {(Object.keys(roleLabels) as Role[]).map((r) => {
            const isActive = user?.role === r;
            return (
              <button
                key={r}
                onClick={() => switchDemoRole(r)}
                className={`px-2 py-0.5 rounded text-2xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {roleLabels[r].badge} : {roleLabels[r].title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-border flex flex-col shrink-0 fixed top-[37px] bottom-0 left-0 z-30">
          {/* Logo & Header */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">DepositDesk</h2>
              <p className="text-2xs text-muted-foreground font-mono">AICTE PS ID 26265</p>
            </div>
          </div>

          {/* Current Scope Banner (for IU: Institution; for SO/AA: Scope) */}
          {user?.institution && (
            <div className="mx-3 mt-3 p-2.5 rounded-md bg-slate-50 border border-border/70 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1 font-medium text-2xs uppercase tracking-wider">
                <Building2 className="w-3 h-3 text-blue-600" />
                <span>My Institution</span>
              </div>
              <p className="font-semibold text-foreground text-xs leading-tight line-clamp-1">{user.institution.name}</p>
              {user.institution.aicteId && (
                <p className="text-2xs text-muted-foreground mt-0.5 font-mono">AICTE: {user.institution.aicteId}</p>
              )}
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems
              .filter((item) => (user ? item.roles.includes(user.role) : false))
              .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
          </nav>

          {/* User Profile in Sidebar Footer */}
          <div className="p-3 border-t border-border bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center text-xs font-semibold shrink-0">
                  {user?.name?.slice(0, 2).toUpperCase() || 'US'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{user?.name || 'Guest User'}</p>
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-2xs font-semibold border ${currentRoleConfig.color}`}
                  >
                    {currentRoleConfig.title}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-slate-200/50 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Content Area with Top Navigation Bar */}
        <div className="ml-64 flex-1 flex flex-col min-w-0">
          {/* Sub-header / Topbar */}
          <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 sticky top-[37px] z-20">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">DepositDesk</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-xs font-semibold text-foreground capitalize">
                {location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).replace('-', ' ')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick FDR Creation Button (for IU & SA) */}
              {(user?.role === Role.INSTITUTION_USER || user?.role === Role.SYSTEM_ADMIN) && (
                <button
                  onClick={() => navigate('/instruments/new')}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New FDR / Deposit</span>
                </button>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-md hover:bg-slate-100 text-muted-foreground hover:text-foreground relative transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-border p-3 z-50">
                    <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                      <span className="text-xs font-semibold text-foreground">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-2xs text-blue-600 hover:underline font-medium"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-3 text-center">No notifications</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-2 rounded-md text-xs cursor-pointer transition-colors ${
                              n.isRead ? 'bg-slate-50 text-muted-foreground' : 'bg-blue-50/60 text-foreground font-medium'
                            }`}
                            onClick={() => {
                              if (n.linkUrl) navigate(n.linkUrl);
                              setShowNotifications(false);
                            }}
                          >
                            <p className="font-semibold text-xs">{n.title}</p>
                            <p className="text-2xs text-muted-foreground mt-0.5">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Body */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
