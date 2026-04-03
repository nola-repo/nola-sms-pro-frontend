import { safeStorage } from '../utils/safeStorage';
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
  const token = safeStorage.getItem(SESSION_KEYS.token);
  const role  = safeStorage.getItem(SESSION_KEYS.role);
  if (!token || role !== 'agency') return null;
  return {
    token,
    role:      'agency',
    companyId: safeStorage.getItem(SESSION_KEYS.companyId),
    user:      JSON.parse(safeStorage.getItem(SESSION_KEYS.user) ?? 'null'),
  };
};

export const clearAgencySession = (): void => {
  Object.values(SESSION_KEYS).forEach(k => safeStorage.removeItem(k));
};

export const login = async (email: string, password: string): Promise<any> => {
  const res = await fetch(`/api/auth/login.php`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? json.message ?? 'Login failed');
  
  if (json.role !== 'agency') {
    throw new Error('Not an agency account. Please login at app.nolasmspro.com');
  }

  safeStorage.setItem(SESSION_KEYS.token, json.token);
  safeStorage.setItem(SESSION_KEYS.role, json.role);
  if (json.company_id) safeStorage.setItem(SESSION_KEYS.companyId, json.company_id);
  if (json.user) safeStorage.setItem(SESSION_KEYS.user, JSON.stringify(json.user));

  return json;
};
