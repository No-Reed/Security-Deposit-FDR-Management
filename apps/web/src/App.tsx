import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { InstrumentsPage } from './pages/InstrumentsPage';
import { InstrumentDetailPage } from './pages/InstrumentDetailPage';
import { NewInstrumentPage } from './pages/NewInstrumentPage';
import { ScrutinyQueuePage } from './pages/ScrutinyQueuePage';
import { ReleaseRequestsPage } from './pages/ReleaseRequestsPage';
import { DiscrepanciesPage } from './pages/DiscrepanciesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading DepositDesk...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instruments"
          element={
            <ProtectedRoute>
              <InstrumentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instruments/new"
          element={
            <ProtectedRoute>
              <NewInstrumentPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instruments/:id"
          element={
            <ProtectedRoute>
              <InstrumentDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/scrutiny"
          element={
            <ProtectedRoute>
              <ScrutinyQueuePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/releases"
          element={
            <ProtectedRoute>
              <ReleaseRequestsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/discrepancies"
          element={
            <ProtectedRoute>
              <DiscrepanciesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <AuditTrailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
