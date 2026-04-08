import { safeStorage } from '../utils/safeStorage';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAgencySession, clearAgencySession, type AgencySession } from '../services/agencyAuthHelper.ts';
import { useGhlCompany } from '../hooks/useGhlCompany.ts';

interface AgencyContextValue {
  // Auth session (used for standalone/manual login only)
  agencySession: AgencySession | null;

  // Company ID — from URL when inside GHL, or from JWT when standalone
  agencyId: string | null;
  logout: () => void;
  disconnectGhl: () => void;

  // GHL iframe state
  isGhlFrame: boolean;

  // UI
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

export const AgencyProvider = ({ children }) => {
  // ── GHL iframe detection (URL param only, no backend call) ─────────────────
  const { companyId: ghlCompanyId, isGhlFrame } = useGhlCompany();

  // ── Auth session (standalone login only) ────────────────────────────────────
  const [agencySession, setAgencySession] = useState<AgencySession | null>(() => getAgencySession());

  // ── Agency ID resolution ────────────────────────────────────────────────────
  // Priority: 1. GHL URL param  2. JWT companyId  3. env var  4. localStorage
  const [agencyId, setAgencyId] = useState<string | null>(() => {
    // 1. GHL iframe URL param (highest priority)
    if (ghlCompanyId) {
      safeStorage.setItem('nola_agency_id', ghlCompanyId);
      return ghlCompanyId;
    }

    // 2. From auth session JWT
    const session = getAgencySession();
    if (session?.companyId) return session.companyId;

    // 3. Env var (dev)
    const envId = import.meta.env.VITE_AGENCY_ID;
    if (envId && envId !== 'your_agency_id_here') return envId;

    // 4. Query param fallback (dev testing)
    const params = new URLSearchParams(window.location.search);
    const qpId = params.get('agency_id') || params.get('locationId');
    if (qpId) return qpId;

    // 5. Persisted from a previous session
    return safeStorage.getItem('nola_agency_id') || null;
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
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
