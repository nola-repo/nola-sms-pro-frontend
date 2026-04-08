import { safeStorage } from '../../utils/safeStorage';
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SESSION_KEYS } from '../../services/agencyAuthHelper.ts';
import { useAgency } from '../../context/AgencyContext.tsx';

/**
 * AgencyProtectedRoute
 * Mirrors the user app ProtectedRoute exactly:
 *
 * - companyId in URL (GHL iframe) → render dashboard immediately, no login
 * - No companyId + valid JWT       → render dashboard (standalone)
 * - No companyId + no JWT          → redirect to /login (standalone)
 */
export const AgencyProtectedRoute: React.FC = () => {
  const { isGhlFrame } = useAgency();

  // GHL iframe — bypass auth entirely, same as user app on locationId
  if (isGhlFrame) {
    return <Outlet />;
  }

  // Standalone — require a valid JWT
  const token = safeStorage.getItem(SESSION_KEYS.token);
  const role  = safeStorage.getItem(SESSION_KEYS.role);

  if (!token || role !== 'agency') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
