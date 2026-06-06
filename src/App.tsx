import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import Layout from './components/Layout';
import { getPreference } from './db';
import { runDateRepair } from './utils/repairDates';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Settings = lazy(() => import('./pages/Settings'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Income = lazy(() => import('./pages/Income'));
const Households = lazy(() => import('./pages/Households'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Balances = lazy(() => import('./pages/Balances'));

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="text-sm text-slate-500">Loading...</div>
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  return <AppContent />;
}

function AppContent() {
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean | null>(null);
  useSupabaseSync();

  useEffect(() => {
    runDateRepair().catch(console.error);
  }, []);

  useEffect(() => {
    getPreference('onboardingDismissed').then((pref) => {
      setOnboardingDismissed(pref?.value === true);
    });
  }, []);

  if (onboardingDismissed === null) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout showOnboarding={!onboardingDismissed} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/income" element={<Income />} />
          <Route path="/households" element={<Households />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/balances" element={<Balances />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/onboarding" element={
            onboardingDismissed ? <Navigate to="/" replace /> : <Onboarding />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function PublicRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  return user ? <ProtectedRoute /> : <PublicRoute />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
