import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard.tsx';
import { SubaccountSIMs } from './pages/SubaccountSIMs.tsx';

export const AppRoutes = () => (
  <Routes>
    <Route path="/"                  element={<Dashboard />} />
    <Route path="/subaccount-sims"   element={<SubaccountSIMs />} />
    {/* Catch-all → dashboard */}
    <Route path="*"                  element={<Navigate to="/" replace />} />
  </Routes>
);
