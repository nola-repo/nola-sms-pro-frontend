import { safeStorage } from '../../utils/safeStorage';
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SESSION_KEYS } from '../../services/agencyAuthHelper.ts';
import { useAgency } from '../../context/AgencyContext.tsx';

/**
 * AgencyProtectedRoute
 * Guards all agency routes. Behaviour differs depending on context:
 *
 * 1. INSIDE GHL iframe (isGhlFrame = true):
 *    - 'loading' → show a "Connecting to GHL…" splash
 *    - 'error'   → show a GHL-specific error card (no login redirect)
 *    - 'success' → render the dashboard
 *
 * 2. OUTSIDE GHL (isGhlFrame = false):
 *    - No valid token  → redirect to /login
 *    - Valid token     → render the dashboard
 */
export const AgencyProtectedRoute: React.FC = () => {
  const { isGhlFrame, autoLoginStatus, autoLoginError } = useAgency();

  const token = safeStorage.getItem(SESSION_KEYS.token);
  const role  = safeStorage.getItem(SESSION_KEYS.role);

  // ── Inside GHL iframe ──────────────────────────────────────────────────────
  if (isGhlFrame) {
    // Still fetching the JWT — show connecting splash
    if (autoLoginStatus === 'idle' || autoLoginStatus === 'loading') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0b] gap-5">
          <div className="w-14 h-14 rounded-full border-4 border-[#2b83fa]/20 border-t-[#2b83fa] animate-spin" />
          <div className="text-center">
            <p className="text-[15px] font-bold text-gray-900 dark:text-white">Connecting to GoHighLevel…</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">Loading your agency dashboard</p>
          </div>
        </div>
      );
    }

    // Auto-login failed — gracefully fall back to manual login (as per spec)
    if (autoLoginStatus === 'error') {
      return <Navigate to="/login" replace />;
    }

    // Auto-login succeeded — render the dashboard directly
    if (autoLoginStatus === 'success') {
      return <Outlet />;
    }
  }

  // ── Outside GHL (or inside GHL after success — unreachable but safe) ────────
  if (!token || role !== 'agency') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
