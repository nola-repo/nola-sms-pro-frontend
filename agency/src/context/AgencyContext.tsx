import { safeStorage } from '../utils/safeStorage';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAgencySession, clearAgencySession, type AgencySession } from '../services/agencyAuthHelper.ts';

interface AgencyContextValue {
  // Auth session
  agencySession: AgencySession | null;
  agencyId:      string | null;  // company_id from GHL (or env/query fallback for dev)
  logout:        () => void;

  // UI
  darkMode:       boolean;
  toggleDarkMode: () => void;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

/**
 * AgencyProvider
 * Provides agencyId (company_id from JWT session, then env/query fallback for dev)
 * and the auth session + logout helper.
 */
export const AgencyProvider = ({ children }) => {
  // ── Auth session ────────────────────────────────────────────────────────────
  const [agencySession] = useState<AgencySession | null>(() => getAgencySession());

  // ── Agency ID resolution ────────────────────────────────────────────────────
  // Priority: 1. JWT companyId (production)  2. env var (dev)  3. query param  4. localStorage
  const [agencyId] = useState<string | null>(() => {
    // 1. From auth session
    const session = getAgencySession();
    if (session?.companyId) return session.companyId;

    // 2. Env var (dev)
    const envId = import.meta.env.VITE_AGENCY_ID;
    if (envId && envId !== 'your_agency_id_here') return envId;

    // 3. Query param (GHL SSO iframe / dev testing)
    const params = new URLSearchParams(window.location.search);
    const qpId = params.get('agency_id') || params.get('companyId') || params.get('locationId');
    if (qpId) return qpId;

    // 4. Persisted from a previous session
    return safeStorage.getItem('nola_agency_id') || null;
  });

  // Persist agencyId for convenience
  useEffect(() => {
    if (agencyId) safeStorage.setItem('nola_agency_id', agencyId);
  }, [agencyId]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = () => {
    clearAgencySession();
    safeStorage.removeItem('nola_agency_id');
    window.location.href = '/login';
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
    <AgencyContext.Provider value={{ agencySession, agencyId, logout, darkMode, toggleDarkMode }}>
      {children}
    </AgencyContext.Provider>
  );
};

export const useAgency = () => {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgency must be used within <AgencyProvider>');
  return ctx;
};
