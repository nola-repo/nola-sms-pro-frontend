/**
 * authHeaders.ts
 * Shared helper that builds the Authorization header from the current session.
 * Import and spread into every fetch() options.headers instead of hand-rolling
 * the Bearer token string in every API file.
 *
 * Usage:
 *   import { getAuthHeaders } from '../utils/authHeaders';
 *   const res = await fetch(url, {
 *     headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
 *   });
 */

import { sessionSafeStorage } from './sessionSafeStorage';

/** The localStorage key where the auth JWT is stored. */
const TOKEN_KEY = 'nola_auth_token';

/**
 * Returns { Authorization: 'Bearer <token>' } when a token is present,
 * or an empty object when no token exists (e.g. GHL iframe auto-login).
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = sessionSafeStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};
