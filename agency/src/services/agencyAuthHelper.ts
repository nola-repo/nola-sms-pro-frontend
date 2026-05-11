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

const parseMaybeJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const compact = (...parts: Array<string | null | undefined>) =>
  parts.map(part => part?.trim()).filter(Boolean).join(' ').trim();

const normalizeAgencyUser = (raw: any): AgencyAuthUser | null => {
  if (!raw || typeof raw !== 'object') return null;

  const firstName = raw.firstName ?? raw.first_name ?? '';
  const lastName = raw.lastName ?? raw.last_name ?? '';
  const name = raw.name ?? raw.full_name ?? compact(firstName, lastName);

  return {
    name: name || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email: raw.email ?? undefined,
    phone: raw.phone ?? raw.phone_number ?? undefined,
    company_name: raw.company_name ?? raw.agency_name ?? undefined,
    company_id: raw.company_id ?? raw.companyId ?? undefined,
    role: raw.role ?? 'agency',
  };
};

const persistAgencyUser = (user: AgencyAuthUser | null): void => {
  if (!user) return;
  safeStorage.setItem(SESSION_KEYS.user, JSON.stringify(user));
  if (user.company_id) saveCompanyId(user.company_id);
};

export const saveCompanyId = (companyId: string): void => {
  safeStorage.setItem(SESSION_KEYS.companyId, companyId);
  // Also mirror into the agency-specific key used by AgencyContext
  safeStorage.setItem('nola_agency_id', companyId);
};

export const linkCompany = async (companyId: string): Promise<void> => {
  const token = safeStorage.getItem(SESSION_KEYS.token);
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/agency/link_company.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ company_id: companyId }),
  });
  
  if (!res.ok) {
    let errorMsg = 'Failed to link Company ID';
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  // If successful, save it locally too
  saveCompanyId(companyId);
};

export const exchangeOAuthCode = async (code: string): Promise<string> => {
  const redirectUri = import.meta.env.VITE_GHL_REDIRECT_URI ?? 'https://agency.nolasmspro.com/oauth/callback';
  const res = await fetch('/api/ghl/oauth_exchange.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? 'GHL OAuth exchange failed');
  }
  // Persist company_id locally
  saveCompanyId(data.company_id);
  return data.company_id as string;
};

/**
 * ghlAutoLogin
 * Called when the Agency app is running inside a GHL iframe.
 * Exchanges a GHL company_id for a NOLA JWT without requiring a password.
 * The backend looks up the agency account linked to this company_id
 * and issues a signed JWT.
 */
export const ghlAutoLogin = async (companyId: string): Promise<AgencySession> => {
  const res = await fetch('/api/agency/ghl_autologin', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ company_id: companyId }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(data.error ?? 'GHL auto-login failed. Ensure your agency is linked to this GHL account.');
  }
  const user = normalizeAgencyUser({
    ...(data.user ?? {}),
    company_id: data.user?.company_id ?? data.company_id ?? companyId,
    company_name: data.user?.company_name ?? data.company_name,
    role: 'agency',
  });

  // Persist session (same keys as normal login)
  safeStorage.setItem(SESSION_KEYS.token,     data.token);
  safeStorage.setItem(SESSION_KEYS.role,      'agency');
  persistAgencyUser(user);

  return {
    token:     data.token,
    role:      'agency',
    companyId: data.company_id ?? companyId,
    user,
  };
};

export interface AgencyAuthUser {
  name?:         string;
  firstName?:    string;
  lastName?:     string;
  email?:        string;
  phone?:        string;
  company_name?: string;
  company_id?:   string;
  role?:         string;
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
    user:      parseMaybeJson<AgencyAuthUser | null>(safeStorage.getItem(SESSION_KEYS.user), null),
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

export const fetchAgencyProfile = async (): Promise<AgencyAuthUser | null> => {
  const token = safeStorage.getItem(SESSION_KEYS.token);
  if (!token) return null;

  const res = await fetch('/api/auth/me', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include',
  });

  if (!res.ok) return null;

  const data = await res.json();
  const rawUser = data.user ?? data.profile ?? data.data?.user ?? data.data ?? data;
  const user = normalizeAgencyUser(rawUser);
  if (user?.role && user.role !== 'agency') return null;

  persistAgencyUser(user);
  return user;
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
    throw new Error('Not an agency account. Please use the sub-account login instead.');
  }

  const user = normalizeAgencyUser({
    ...(json.user ?? {}),
    company_id: json.user?.company_id ?? json.company_id,
    company_name: json.user?.company_name ?? json.company_name,
    role: json.role,
  });

  safeStorage.setItem(SESSION_KEYS.token, json.token);
  safeStorage.setItem(SESSION_KEYS.role, json.role);
  persistAgencyUser(user);

  const companyId = user?.company_id ?? json.company_id;
  if (companyId) {
    saveCompanyId(companyId);
  } else {
    // Token valid but company_id not yet linked — surface a specific error
    // so the login page can offer the manual "Enter GHL Company ID" step.
    throw new MissingCompanyIdError();
  }

  return json;
};
