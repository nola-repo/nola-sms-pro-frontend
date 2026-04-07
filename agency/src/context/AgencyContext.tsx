import { safeStorage } from '../utils/safeStorage';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAgencySession, clearAgencySession, type AgencySession } from '../services/agencyAuthHelper.ts';
import { useGhlCompany, type GhlAutoLoginStatus } from '../hooks/useGhlCompany.ts';

interface AgencyContextValue {
  // Auth session
  agencySession:   AgencySession | null;
  agencyId:        string | null;   // company_id from GHL (or env/query fallback for dev)
  logout:          () => void;
  disconnectGhl:   () => void;

  // GHL iframe state
  isGhlFrame:      boolean;
  autoLoginStatus: GhlAutoLoginStatus;
  autoLoginError:  string | null;

  // UI
  darkMode:        boolean;
  toggleDarkMode:  () => void;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

/**
 * AgencyProvider
 * Provides agencyId and the auth session + logout helper.
 * Handles both manual login and GHL iframe auto-login.
 */
export const AgencyProvider = ({ children }) => {
  // ── GHL iframe detection + auto-login ─────────────────────────────────────
  const { companyId: ghlCompanyId, isGhlFrame, autoLoginStatus, autoLoginError } = useGhlCompany();

  // ── Auth session ────────────────────────────────────────────────────────────
  // Re-evaluate after auto-login completes (autoLoginStatus changes)
  const [agencySession, setAgencySession] = useState<AgencySession | null>(() => getAgencySession());

  useEffect(() => {
    if (autoLoginStatus === 'success') {
      // Re-read session from storage after auto-login writes the JWT
      setAgencySession(getAgencySession());
    }
  }, [autoLoginStatus]);

  // ── Agency ID resolution ────────────────────────────────────────────────────
  // Priority: 1. GHL iframe URL param  2. JWT companyId  3. env var  4. localStorage
  const [agencyId, setAgencyId] = useState<string | null>(() => {
    // 1. GHL iframe (highest priority)
    if (ghlCompanyId) return ghlCompanyId;

    // 2. From auth session JWT
    const session = getAgencySession();
    if (session?.companyId) return session.companyId;

    // 3. Env var (dev)
    const envId = import.meta.env.VITE_AGENCY_ID;
    if (envId && envId !== 'your_agency_id_here') return envId;

    // 4. Query param fallback (dev testing without GHL keys)
    const params = new URLSearchParams(window.location.search);
    const qpId = params.get('agency_id') || params.get('companyId') || params.get('locationId');
    if (qpId) return qpId;

    // 5. Persisted from a previous session
    return safeStorage.getItem('nola_agency_id') || null;
  });

  // Persist agencyId for convenience
  useEffect(() => {
    if (agencyId) safeStorage.setItem('nola_agency_id', agencyId);
  }, [agencyId]);

  // ── Logout & Disconnect ────────────────────────────────────────────────────
  const logout = () => {
    clearAgencySession();
    safeStorage.removeItem('nola_agency_id');
    window.location.href = '/login';
  };

  const disconnectGhl = () => {
    setAgencyId(null);
    safeStorage.removeItem('nola_agency_id');
  };

  // ── Dark mode ────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = safeStorage.getItem('agency_darkMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    safeStorage.setItem('agency_darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev: boolean) => !prev);

  return (
    <AgencyContext.Provider value={{
      agencySession,
      agencyId,
      logout,
      disconnectGhl,
      isGhlFrame,
      autoLoginStatus,
      autoLoginError,
      darkMode,
      toggleDarkMode,
    }}>
      {children}
    </AgencyContext.Provider>
  );
};

export const useAgency = () => {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgency must be used within <AgencyProvider>');
  return ctx;
};
