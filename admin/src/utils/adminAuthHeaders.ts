export const getAdminAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('nola_admin_token') ?? '';

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};
