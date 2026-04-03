import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard.tsx';
import { Subaccounts } from './pages/Subaccounts.tsx';
import { AgencyProtectedRoute } from './components/auth/AgencyProtectedRoute.tsx';
import AgencyLogin from './pages/AgencyLogin.tsx';

export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AgencyLogin />} />
    
    {/* All agency routes require a valid agency-role token */}
    <Route element={<AgencyProtectedRoute />}>
      <Route path="/"             element={<Dashboard />} />
      <Route path="/subaccounts"  element={<Subaccounts />} />
    </Route>
    {/* Catch-all → dashboard (the guard will redirect to /login if not authed) */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
