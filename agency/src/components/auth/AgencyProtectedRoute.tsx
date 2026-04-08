import { safeStorage } from '../../utils/safeStorage';
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SESSION_KEYS } from '../../services/agencyAuthHelper.ts';
import { useAgency } from '../../context/AgencyContext.tsx';

/**
 * AgencyProtectedRoute
 * Guards all agency routes. Behaviour differs depending on context:
 *
 * 1. INSIDE GHL iframe (companyId in URL params):
 *    - Bypass login entirely — companyId is the implicit auth (matches user app pattern)
 *    - 'loading' → show a "Connecting to GHL…" splash (UX polish)
 *    - 'error'   → show a helpful error card (no login redirect)
 *    - 'success' → render the dashboard
 *
 * 2. OUTSIDE GHL (isGhlFrame = false):
 *    - No valid token  → redirect to /login
 *    - Valid token     → render the dashboard
 */
export const AgencyProtectedRoute: React.FC = () => {
  const { isGhlFrame, autoLoginStatus, autoLoginError } = useAgency();

  // ── Inside GHL iframe: bypass login, companyId IS the auth ────────────────
  if (isGhlFrame) {
    // Show connecting splash while auto-login runs (UX polish only)
    if (autoLoginStatus === 'loading') {
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

    // Auto-login failed — show error card (never redirect to login inside GHL)
    if (autoLoginStatus === 'error') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0b] px-4">
          <div className="w-full max-w-sm p-8 rounded-3xl bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16 8 8 0 000-16z" />
              </svg>
            </div>
            <div>
              <p className="text-[16px] font-bold text-gray-900 dark:text-white">GHL Connection Failed</p>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {autoLoginError ?? 'Could not authenticate your agency account.'}
              </p>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Make sure your agency account is linked to this GoHighLevel company in your NOLA SMS Pro settings.
            </p>
          </div>
        </div>
      );
    }

    // GHL frame detected (idle or success) — render dashboard directly
    // companyId from URL is the auth source, same as the user app
    return <Outlet />;
  }

  // ── Outside GHL: require a valid JWT ──────────────────────────────────────
  const token = safeStorage.getItem(SESSION_KEYS.token);
  const role  = safeStorage.getItem(SESSION_KEYS.role);

  if (!token || role !== 'agency') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

