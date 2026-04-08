import { safeStorage } from '../../utils/safeStorage';
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SESSION_KEYS } from '../../services/agencyAuthHelper.ts';
import { useAgency } from '../../context/AgencyContext.tsx';

/**
 * AgencyProtectedRoute
 * Mirrors the user app's ProtectedRoute exactly:
 *
 * - companyId in URL (GHL iframe) → render dashboard, no login needed
 * - No companyId + no valid JWT   → redirect to /login (standalone)
 * - No companyId + valid JWT       → render dashboard (standalone)
 */
export const AgencyProtectedRoute: React.FC = () => {
  const { isGhlFrame } = useAgency();

  // Inside GHL iframe — bypass auth, same as user app bypasses on locationId
  if (isGhlFrame) {
    return <Outlet />;
  }

  // Outside GHL — require a valid JWT
  const token = safeStorage.getItem(SESSION_KEYS.token);
  const role  = safeStorage.getItem(SESSION_KEYS.role);

  if (!token || role !== 'agency') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
