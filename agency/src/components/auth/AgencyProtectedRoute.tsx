import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SESSION_KEYS } from '../../services/agencyAuthHelper.ts';

/**
 * AgencyProtectedRoute
 * Guards all agency routes. Requires a valid token AND role === 'agency'.
 * If check fails, hard-navigates to the user app login page at /login.
 */
export const AgencyProtectedRoute: React.FC = () => {
  const token = localStorage.getItem(SESSION_KEYS.token);
  const role  = localStorage.getItem(SESSION_KEYS.role);

  if (!token || role !== 'agency') {
    // Hard navigate back to the user app's login page
    window.location.href = '/login';
    return null;
  }

  return <Outlet />;
};
