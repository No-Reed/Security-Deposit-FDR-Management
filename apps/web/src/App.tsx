import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { InstrumentsPage } from './pages/InstrumentsPage';
import { NewInstrumentPage } from './pages/NewInstrumentPage';
import { InstrumentDetailPage } from './pages/InstrumentDetailPage';
import { ScrutinyQueuePage } from './pages/ScrutinyQueuePage';
import { DiscrepanciesPage } from './pages/DiscrepanciesPage';
import { ReleaseRequestsPage } from './pages/ReleaseRequestsPage';
import { MaturitiesPage } from './pages/MaturitiesPage';
import { RenewalsPage } from './pages/RenewalsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { InstitutionsPage } from './pages/InstitutionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { AdminPage } from './pages/AdminPage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage } from './pages/LoginPage';
function Protected({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <p role="status" className="p-10 text-sm text-slate-500">
        Loading DepositDesk…
      </p>
    );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      {roles && !roles.includes(user.role) ? (
        <div className="card-notion">
          <h1>Access restricted</h1>
          <p className="text-sm mt-3">
            This section is not available to your role.
          </p>
          <Link className="btn-outline mt-4" to="/">
            Return to dashboard
          </Link>
        </div>
      ) : (
        children
      )}
    </AppLayout>
  );
}
const staff = ['SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'SYSTEM_ADMIN'];
export default function App() {
  const routes = [
    ['/', <DashboardPage />, undefined],
    ['/instruments', <InstrumentsPage />, undefined],
    ['/instruments/new', <NewInstrumentPage />, ['INSTITUTION_USER']],
    ['/instruments/:id', <InstrumentDetailPage />, undefined],
    ['/scrutiny', <ScrutinyQueuePage />, staff],
    ['/discrepancies', <DiscrepanciesPage />, undefined],
    ['/releases', <ReleaseRequestsPage />, undefined],
    ['/releases/:id', <ReleaseRequestsPage />, undefined],
    ['/maturities', <MaturitiesPage />, undefined],
    ['/renewals', <RenewalsPage />, undefined],
    ['/notifications', <NotificationsPage />, undefined],
    ['/institutions', <InstitutionsPage />, staff],
    ['/reports', <ReportsPage />, undefined],
    ['/audit', <AuditTrailPage />, staff],
    ['/admin', <AdminPage />, ['SYSTEM_ADMIN']],
    ['/about', <AboutPage />, undefined],
  ] as Array<[string, React.ReactNode, string[] | undefined]>;
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {routes.map(([path, element, roles]) => (
          <Route
            key={path}
            path={path}
            element={<Protected roles={roles}>{element}</Protected>}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
