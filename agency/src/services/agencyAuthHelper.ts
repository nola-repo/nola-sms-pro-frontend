import { safeStorage } from '../utils/safeStorage';
/**
 * agencyAuthHelper.ts
 * Auth session helper for the Agency panel.
 * Reads the JWT written on login and provides fallback helpers for
 * cases where company_id is missing from the token (backend not ready yet).
 */

export const SESSION_KEYS = {
  token:      'nola_auth_token',
  role:       'nola_auth_role',
  companyId:  'nola_company_id',
  locationId: 'nola_location_id',
  user:       'nola_auth_user',
} as const;

/** Saves (or overwrites) the GHL Company ID independently of a full login. */
export const saveCompanyId = (companyId: string): void => {
  safeStorage.setItem(SESSION_KEYS.companyId, companyId);
  // Also mirror into the agency-specific key used by AgencyContext
  safeStorage.setItem('nola_agency_id', companyId);
};

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

export class MissingCompanyIdError extends Error {
  constructor() {
    super('MISSING_COMPANY_ID');
    this.name = 'MissingCompanyIdError';
  }
}

export const login = async (email: string, password: string): Promise<any> => {
  const res = await fetch(`/api/auth/login.php`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? json.message ?? 'Login failed');

  if (json.role !== 'agency') {
    throw new Error('Not an agency account. Please use the sub-account login instead.');
  }

  safeStorage.setItem(SESSION_KEYS.token, json.token);
  safeStorage.setItem(SESSION_KEYS.role, json.role);
  if (json.user) safeStorage.setItem(SESSION_KEYS.user, JSON.stringify(json.user));

  if (json.company_id) {
    safeStorage.setItem(SESSION_KEYS.companyId, json.company_id);
    safeStorage.setItem('nola_agency_id', json.company_id);
  } else {
    // Token valid but company_id not yet linked — surface a specific error
    // so the login page can offer the manual "Enter GHL Company ID" step.
    throw new MissingCompanyIdError();
  }

  return json;
};
