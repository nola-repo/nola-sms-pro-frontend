import { safeStorage } from './safeStorage';
import { sessionSafeStorage } from './sessionSafeStorage';
import { getAccountSettings } from './settingsStorage';
import { detectLocationFromCurrentUrl } from './ghlLocationDetection';
import { readActiveGhlLocation } from './ghlLocationStorage';

const SESSION_KEYS = {
  token: 'nola_auth_token',
  role: 'nola_auth_role',
  companyId: 'nola_company_id',
  locationId: 'nola_location_id',
  user: 'nola_auth_user',
} as const;

const PUBLIC_AUTH_PATHS = [
  '/api/auth/login.php',
  '/api/auth/register.php',
  '/api/auth/forgot_password_otp.php',
  '/api/auth/reset_password_otp.php',
  '/api/auth/ghl_autologin',
];

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const getRequestPath = (input: RequestInfo | URL): string => {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  try {
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return raw;
  }
};

const isPublicAuthRequest = (input: RequestInfo | URL): boolean => {
  const path = getRequestPath(input);
  return PUBLIC_AUTH_PATHS.some((publicPath) => path === publicPath || path.startsWith(publicPath + '/'));
};

const getStoredToken = (): string =>
  sessionSafeStorage.getItem(SESSION_KEYS.token) ||
  safeStorage.getItem(SESSION_KEYS.token) ||
  '';

const getCurrentUrlLocationId = (): string => {
  if (typeof window === 'undefined') return '';
  return detectLocationFromCurrentUrl()?.locationId || '';
};
const isCurrentGhlContext = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    return window.self !== window.top || sessionStorage.getItem('nola_is_ghl_frame') === 'true';
  } catch {
    return true;
  }
};

const getStoredLocationId = (): string => {
  const fromCurrentUrl = getCurrentUrlLocationId();
  if (fromCurrentUrl) return fromCurrentUrl;

  const activeGhlLocationId = readActiveGhlLocation();
  if (isCurrentGhlContext()) return activeGhlLocationId;

  try {
    return safeStorage.getItem(SESSION_KEYS.locationId) || getAccountSettings().ghlLocationId || '';
  } catch {
    return safeStorage.getItem(SESSION_KEYS.locationId) || '';
  }
};
const clearStoredAuthSession = (): void => {
  Object.values(SESSION_KEYS).forEach((key) => {
    safeStorage.removeItem(key);
    sessionSafeStorage.removeItem(key);
  });
  safeStorage.removeItem('nola_user');
  safeStorage.removeItem('nola_settings_account');
  safeStorage.removeItem('nola_settings_api');
  safeStorage.removeItem('nola_settings_preferred_sender');
  safeStorage.removeItem('nola_is_ghl_frame');
  try { sessionStorage.removeItem('nola_is_ghl_frame'); } catch { /* ignore */ }
  try { localStorage.removeItem('nola_is_ghl_frame'); } catch { /* ignore */ }
};

export function withRequestId(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);

  if (!merged.has('X-Request-ID')) {
    merged.set('X-Request-ID', createRequestId());
  }

  return merged;
}

export function withApiHeaders(headers?: HeadersInit): Headers {
  const merged = withRequestId(headers);
  const token = getStoredToken();
  const locationId = getStoredLocationId();

  if (token && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`);
  }

  if (locationId && !merged.has('X-GHL-Location-ID')) {
    merged.set('X-GHL-Location-ID', locationId);
  }

  return merged;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const tokenAtRequestStart = getStoredToken();
  const response = await fetch(input, {
    ...init,
    headers: withApiHeaders(init.headers),
  });

  if (response.status === 401 && tokenAtRequestStart && !isPublicAuthRequest(input)) {
    clearStoredAuthSession();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }

  if (response.status === 503 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nola-api-maintenance', { detail: { input: String(input) } }));
  }

  return response;
}
