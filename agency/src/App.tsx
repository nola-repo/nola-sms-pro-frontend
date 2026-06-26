import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AgencyProvider } from './context/AgencyContext.tsx';
import { AppRoutes } from './routes.tsx';

const AgencyTitleSync = () => {
  const location = useLocation();

  React.useEffect(() => {
    const pathTitle: Record<string, string> = {
      '/': 'Agency Dashboard',
      '/subaccounts': 'Subaccounts',
      '/billing': 'Billing',
      '/subscription': 'Subscription',
      '/settings': 'Settings',
      '/login': 'Agency Login',
      '/forgot-password': 'Reset Password',
      '/oauth/callback': 'GoHighLevel Connection',
      '/register-from-install': 'Agency Setup',
    };
    document.title = `${pathTitle[location.pathname] || 'Agency Dashboard'} | NOLA SMS Pro Agency`;
  }, [location.pathname]);

  return null;
};

const App = () => (
  <AgencyProvider>
    <BrowserRouter>
      <AgencyTitleSync />
      <AppRoutes />
    </BrowserRouter>
  </AgencyProvider>
);

export default App;
