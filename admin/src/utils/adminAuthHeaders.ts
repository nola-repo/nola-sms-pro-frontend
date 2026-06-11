export const getAdminAuthHeaders = (): Record<string, string> => {
  const token =
    sessionStorage.getItem('nola_admin_token') ||
    localStorage.getItem('nola_admin_token') ||
    '';

  if (token && !sessionStorage.getItem('nola_admin_token')) {
    sessionStorage.setItem('nola_admin_token', token);
    sessionStorage.setItem('nola_admin_auth', 'true');
    const rememberedUser = localStorage.getItem('nola_admin_user');
    if (rememberedUser) {
      sessionStorage.setItem('nola_admin_user', rememberedUser);
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};
