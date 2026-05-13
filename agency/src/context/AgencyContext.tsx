import { safeStorage } from '../utils/safeStorage';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getAgencySession, clearAgencySession, type AgencySession, ghlAutoLogin, fetchAgencyProfile } from '../services/agencyAuthHelper.ts';
import { useGhlCompany } from '../hooks/useGhlCompany.ts';

interface AgencyContextValue {
  agencySession: AgencySession | null;
  agencyId:      string | null;
  logout:        () => void;
  disconnectGhl: () => void;
  isGhlFrame:    boolean;
  darkMode:      boolean;
  toggleDarkMode: () => void;
  autoLoginLoading: boolean;
  autoLoginError: string | null;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

export const AgencyProvider = ({ children }: { children: React.ReactNode }) => {
  const { companyId: ghlCompanyId, isGhlFrame, status: ghlStatus } = useGhlCompany();

  const [agencySession, setAgencySession] = useState<AgencySession | null>(() => getAgencySession());
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const attemptedAutoLoginCompanyId = useRef<string | null>(null);

  // Priority: 1. GHL URL param  2. JWT  3. env  4. localStorage
  const [agencyId, setAgencyId] = useState<string | null>(() => {
    // When running inside a GHL iframe, do NOT trust localStorage/session on mount.
    // The correct companyId will arrive via the async SSO handshake (useGhlCompany).
    // Reading stale values here causes the wrong agency's subaccounts to load.
    let isIframe = false;
    try { isIframe = window.self !== window.top; } catch { isIframe = true; }
    if (isIframe) return null;

    // Outside iframe: safe to use the full fallback chain
    if (ghlCompanyId) return ghlCompanyId;
    const session = getAgencySession();
    if (session?.companyId) return session.companyId;
    const envId = import.meta.env.VITE_AGENCY_ID;
    if (envId && envId !== 'your_agency_id_here') return envId;
    const params = new URLSearchParams(window.location.search);
    const qpId = params.get('agency_id') || params.get('locationId');
    if (qpId) return qpId;
    return safeStorage.getItem('nola_agency_id') || null;
  });

  useEffect(() => {
    if (!ghlCompanyId || ghlCompanyId === agencyId) return;

    // Company ID changed — update state and storage
    setAgencyId(ghlCompanyId);
    safeStorage.setItem('nola_agency_id', ghlCompanyId);
    setAutoLoginError(null);

    // If inside a GHL iframe and the agency actually switched (not just initial resolution),
    // clear the stale JWT session so ghlAutoLogin re-runs for the new agency.
    // Without this the old session stays in memory and blocks re-authentication.
    if (isGhlFrame && agencySession && agencySession.companyId !== ghlCompanyId) {
      clearAgencySession();
      setAgencySession(null);
      setAutoLoginError(null);
    }
  }, [ghlCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // If GHL postMessage detection failed and there's no stored agency ID,
  // surface this as an autoLoginError so the route guard exits the loading state.
  useEffect(() => {
    if (ghlStatus === 'error' && !agencyId && !autoLoginError) {
      setAutoLoginError('Could not detect GHL Company ID. Please refresh or re-open the app from the GHL sidebar.');
    }
  }, [ghlStatus, agencyId, autoLoginError]);

  useEffect(() => {
    if (!isGhlFrame || !ghlCompanyId || agencySession) return;
    if (attemptedAutoLoginCompanyId.current === ghlCompanyId) return;

    let isMounted = true;
    attemptedAutoLoginCompanyId.current = ghlCompanyId;
    setAutoLoginLoading(true);

    ghlAutoLogin(ghlCompanyId)
      .then(session => {
        if (!isMounted) return;
        setAgencyId(session.companyId);
        setAgencySession(session);
      })
      .catch(err => {
        if (!isMounted) return;
        // Match the user-side GHL flow: a trusted iframe company ID is enough
        // to load agency data even if the optional JWT auto-login is not linked yet.
        console.warn('[NOLA SMS] Agency auto-login skipped; continuing with GHL company ID:', err);
        setAgencyId(ghlCompanyId);
        setAutoLoginError(null);
      })
      .finally(() => {
        if (isMounted) setAutoLoginLoading(false);
      });

    return () => { isMounted = false; };
  }, [isGhlFrame, ghlCompanyId, agencySession]);

  useEffect(() => {
    if (!agencySession?.token) return;

    let isMounted = true;

    fetchAgencyProfile()
      .then(profile => {
        if (!isMounted || !profile) return;
        setAgencySession(current => {
          if (!current) return current;
          return {
            ...current,
            companyId: profile.company_id ?? current.companyId,
            user: {
              ...(current.user ?? {}),
              ...profile,
            },
          };
        });
        if (profile.company_id && profile.company_id !== agencyId) {
          setAgencyId(profile.company_id);
        }
      })
      .catch(() => {
        // Keep the login/autologin payload if the profile endpoint is unavailable.
      });

    return () => { isMounted = false; };
  }, [agencySession?.token]);

  const logout = () => {
    clearAgencySession();
    safeStorage.removeItem('nola_agency_id');
    window.location.href = '/login';
  };

  const disconnectGhl = () => {
    setAgencyId(null);
    safeStorage.removeItem('nola_agency_id');
  };

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
      autoLoginLoading,
      autoLoginError,
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
