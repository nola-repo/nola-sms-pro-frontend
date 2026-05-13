/**
 * adminAuthHeaders.ts
 * Builds the auth headers for admin API requests.
 *
 * The admin session is stored in sessionStorage after login.
 * If the backend returned a token at login time it is sent as Bearer.
 * If not (legacy), we fall back to a custom X-Admin-Auth header so the
 * PHP backend at least has something to validate against.
 */

export const getAdminAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('nola_admin_token') ?? '';
  const user  = sessionStorage.getItem('nola_admin_user')  ?? '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (user) {
    // Fallback until backend issues real JWTs
    headers['X-Admin-Auth'] = 'true';
    headers['X-Admin-User'] = user;
  }

  return headers;
};
