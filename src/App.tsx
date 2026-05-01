import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import { getPreference } from './db';

type Route = 'dashboard' | 'transactions' | 'settings' | 'onboarding';

export default function App() {
  const [route, setRoute] = useState<Route>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    async function check() {
      const pref = await getPreference('onboardingDismissed');
      const dismissed = pref?.value === true;
      setShowOnboarding(!dismissed);
      if (!dismissed) {
        setRoute('onboarding');
      }
    }
    check();
  }, []);

  return (
    <Layout current={route} onNavigate={setRoute} showOnboarding={showOnboarding}>
      {route === 'dashboard' && <Dashboard />}
      {route === 'transactions' && <Transactions />}
      {route === 'settings' && <Settings />}
      {route === 'onboarding' && <Onboarding />}
    </Layout>
  );
}
