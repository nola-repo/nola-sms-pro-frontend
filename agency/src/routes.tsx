import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard.tsx';
import { Subaccounts } from './pages/Subaccounts.tsx';

export const AppRoutes = () => (
  <Routes>
    <Route path="/"                  element={<Dashboard />} />
    <Route path="/subaccounts"       element={<Subaccounts />} />
    {/* Catch-all → dashboard */}
    <Route path="*"                  element={<Navigate to="/" replace />} />
  </Routes>
);
