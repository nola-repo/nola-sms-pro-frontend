import { getAdminAuthHeaders } from './adminAuthHeaders';

export const ADMIN_AUTH_REQUIRED_EVENT = 'nola-admin-auth-required';

const AUTH_401_MESSAGES = [
  'admin token missing',
  'admin token invalid or expired',
];

const INACTIVE_403_MESSAGES = [
  'admin account is inactive or no longer exists',
];

const normalizeMessage = (message: unknown) =>
  String(message ?? '').trim().toLowerCase();

const responseMessage = async (response: Response): Promise<string> => {
  const clone = response.clone();

  try {
    const body = await clone.json();
    return normalizeMessage(body?.message ?? body?.error ?? body?.status);
  } catch {
    try {
      return normalizeMessage(await response.clone().text());
    } catch {
      return '';
    }
  }
};

const shouldRedirectToAdminLogin = async (response: Response) => {
  if (response.status !== 401 && response.status !== 403) return false;

  const message = await responseMessage(response);

  if (response.status === 401) {
    return AUTH_401_MESSAGES.some(expected => message.includes(expected));
  }

  return INACTIVE_403_MESSAGES.some(expected => message.includes(expected));
};

const emitAdminAuthRequired = () => {
  window.dispatchEvent(new CustomEvent(ADMIN_AUTH_REQUIRED_EVENT));
};

const mergeAdminHeaders = (headers?: HeadersInit) => {
  const merged = new Headers(headers);

  Object.entries(getAdminAuthHeaders()).forEach(([key, value]) => {
    if (!merged.has(key)) merged.set(key, value);
  });

  return merged;
};

export const adminFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const response = await fetch(input, {
    ...init,
    headers: mergeAdminHeaders(init.headers),
  });

  if (await shouldRedirectToAdminLogin(response)) {
    emitAdminAuthRequired();
  }

  return response;
};
