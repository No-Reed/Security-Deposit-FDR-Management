import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Building2,
  ClipboardCheck,
  CalendarClock,
  RefreshCw,
  FileCheck2,
  AlertCircle,
  Bell,
  BarChart3,
  History,
  Settings,
  Search,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, getApiErrorMessage } from '../../lib/api';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, logout, isDemoMode } = useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [unread, setUnread] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const staff = user?.role !== 'INSTITUTION_USER',
    admin = user?.role === 'SYSTEM_ADMIN';
  const nav = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
    {
      label: 'Instrument registry',
      path: '/instruments',
      icon: FolderOpen,
      show: true,
    },
    {
      label: 'Institutions',
      path: '/institutions',
      icon: Building2,
      show: staff,
    },
    { label: 'Scrutiny', path: '/scrutiny', icon: ClipboardCheck, show: staff },
    {
      label: 'Maturities',
      path: '/maturities',
      icon: CalendarClock,
      show: true,
    },
    { label: 'Renewals', path: '/renewals', icon: RefreshCw, show: true },
    {
      label: 'Release requests',
      path: '/releases',
      icon: FileCheck2,
      show: true,
    },
    {
      label: 'Discrepancies',
      path: '/discrepancies',
      icon: AlertCircle,
      show: true,
    },
    { label: 'Notifications', path: '/notifications', icon: Bell, show: true },
    { label: 'Reports', path: '/reports', icon: BarChart3, show: true },
    { label: 'Audit trail', path: '/audit', icon: History, show: staff },
    { label: 'Administration', path: '/admin', icon: Settings, show: admin },
  ];
  useEffect(() => {
    let current = true;
    api.notifications
      .list()
      .then((items) => {
        if (current) setUnread(items.filter((item) => !item.isRead).length);
      })
      .catch(() => {
        if (current) setUnread(0);
      });
    return () => {
      current = false;
    };
  }, [location.pathname, user?.id]);
  useEffect(() => {
    dialog.current?.close();
  }, [location.pathname]);
  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      setError(getApiErrorMessage(error, 'Could not sign out. Please retry.'));
    }
  };
  const menu = (
    <>
      <div className="brand">
        <span className="brand-mark">
          <FolderOpen size={21} />
        </span>
        <div>
          <strong>
            Deposit<span>Desk</span>
          </strong>
          <p>SECURITY DEPOSIT & FDR</p>
        </div>
      </div>
      <p className="px-5 pt-4 pb-2 text-[10px] font-semibold tracking-[.14em] text-slate-400">
        WORKSPACE
      </p>
      <nav
        aria-label="Main navigation"
        className="px-3 pb-4 flex-1 overflow-y-auto space-y-1"
      >
        {nav
          .filter((item) => item.show)
          .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {item.path === '/notifications' && unread > 0 && (
                <span className="ml-auto text-xs rounded bg-orange-100 text-orange-800 px-1.5">
                  {unread}
                </span>
              )}
            </NavLink>
          ))}
      </nav>
      <div className="border-t px-4 py-4 flex items-center gap-2">
        <div className="avatar">{user?.name.slice(0, 1)}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate" title={user?.name}>
            {user?.name}
          </p>
          <p className="text-[10px] text-slate-500">
            {user?.role.split('_').join(' ').toLowerCase()}
          </p>
        </div>
        <button
          className="btn-ghost p-2"
          aria-label="Sign out"
          onClick={signOut}
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  );
  const title = location.pathname.startsWith('/instruments/')
    ? 'Instrument details'
    : nav.find((item) => item.path === location.pathname)?.label || 'Workspace';
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar">{menu}</aside>
      <dialog ref={dialog} className="mobile-navigation">
        <button
          className="absolute right-2 top-3 btn-ghost"
          aria-label="Close navigation"
          onClick={() => dialog.current?.close()}
        >
          <X size={18} />
        </button>
        {menu}
      </dialog>
      <div className="workspace-content">
        <header className="workspace-toolbar">
          <button
            className="lg:hidden btn-ghost"
            aria-label="Open navigation"
            onClick={() => dialog.current?.showModal()}
          >
            <Menu size={20} />
          </button>
          <form
            className="toolbar-search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/instruments?search=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={16} />
            <label htmlFor="workspace-search" className="sr-only">
              Search instruments
            </label>
            <input
              id="workspace-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search instruments, institutions or banks"
            />
            <button
              type="submit"
              className="text-xs font-semibold text-orange-700"
            >
              Search
            </button>
          </form>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/notifications"
              className="relative p-2 text-slate-500"
              aria-label={`Notifications${unread ? ', ' + unread + ' unread' : ''}`}
            >
              <Bell size={18} />
              {unread > 0 && <span className="notification-dot" />}
            </Link>
            <span className="avatar hidden sm:flex" title={user?.name}>
              {user?.name.slice(0, 1)}
            </span>
          </div>
        </header>
        <main id="main-content" className="workspace-main">
          <p className="breadcrumb">
            Workspace <span>/</span> {title}
          </p>
          {error && (
            <p role="alert" className="notice notice-error">
              {error}
            </p>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          DepositDesk · Security Deposit &amp; FDR Management
        </footer>
      </div>
    </div>
  );
};
