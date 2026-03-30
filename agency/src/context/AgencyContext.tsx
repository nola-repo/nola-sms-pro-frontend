import React, { createContext, useContext, useState, useEffect } from 'react';

const AgencyContext = createContext(null);

/**
 * Provides agency_id (from env or GHL SSO context).
 * During dev: reads VITE_AGENCY_ID from .env
 * In production: can be extended to read from GHL SSO iframe params
 */
export const AgencyProvider = ({ children }) => {
  const [agencyId, setAgencyId] = useState(() => {
    // 1. Try env var (dev)
    const envId = import.meta.env.VITE_AGENCY_ID;
    if (envId && envId !== 'your_agency_id_here') return envId;

    // 2. Try query param (GHL SSO iframe passes companyId / locationId)
    const params = new URLSearchParams(window.location.search);
    const qpId = params.get('agency_id') || params.get('companyId') || params.get('locationId');
    if (qpId) return qpId;

    // 3. Try localStorage (persisted from a previous session)
    return localStorage.getItem('nola_agency_id') || null;
  });

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('agency_darkMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Persist dark mode preference and apply to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('agency_darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Persist agencyId
  useEffect(() => {
    if (agencyId) localStorage.setItem('nola_agency_id', agencyId);
  }, [agencyId]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  return (
    <AgencyContext.Provider value={{ agencyId, setAgencyId, darkMode, toggleDarkMode }}>
      {children}
    </AgencyContext.Provider>
  );
};

export const useAgency = () => {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgency must be used within <AgencyProvider>');
  return ctx;
};
