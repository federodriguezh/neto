import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';

type Route = 'dashboard' | 'transactions' | 'settings';

export default function App() {
  const [route, setRoute] = useState<Route>('dashboard');

  return (
    <Layout current={route} onNavigate={setRoute}>
      {route === 'dashboard' && <Dashboard />}
      {route === 'transactions' && <Transactions />}
      {route === 'settings' && <Settings />}
    </Layout>
  );
}
