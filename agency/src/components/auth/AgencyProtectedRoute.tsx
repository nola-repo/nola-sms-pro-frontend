import { safeStorage } from '../../utils/safeStorage';
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SESSION_KEYS } from '../../services/agencyAuthHelper.ts';

/**
 * AgencyProtectedRoute
 * Guards all agency routes. Requires a valid token AND role === 'agency'.
 * If check fails, redirects to the agency login page.
 */
export const AgencyProtectedRoute: React.FC = () => {
  const token = safeStorage.getItem(SESSION_KEYS.token);
  const role  = safeStorage.getItem(SESSION_KEYS.role);

  if (!token || role !== 'agency') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
