/**
 * agencyAuthHelper.ts
 * Thin read-only helper for the agency app to read the auth session
 * that was written by the user app's authService on login.
 * The agency app never writes tokens — the user app does that.
 */

export const SESSION_KEYS = {
  token:      'nola_auth_token',
  role:       'nola_auth_role',
  companyId:  'nola_company_id',
  locationId: 'nola_location_id',
  user:       'nola_auth_user',
} as const;

export interface AgencyAuthUser {
  firstName: string;
  lastName:  string;
  email:     string;
}

export interface AgencySession {
  token:      string;
  role:       'agency';
  companyId:  string | null;
  user:       AgencyAuthUser | null;
}

export const getAgencySession = (): AgencySession | null => {
  const token = localStorage.getItem(SESSION_KEYS.token);
  const role  = localStorage.getItem(SESSION_KEYS.role);
  if (!token || role !== 'agency') return null;
  return {
    token,
    role:      'agency',
    companyId: localStorage.getItem(SESSION_KEYS.companyId),
    user:      JSON.parse(localStorage.getItem(SESSION_KEYS.user) ?? 'null'),
  };
};

export const clearAgencySession = (): void => {
  Object.values(SESSION_KEYS).forEach(k => localStorage.removeItem(k));
};
