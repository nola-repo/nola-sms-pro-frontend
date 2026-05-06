import { useEffect, useState } from 'react';
import { getSession } from '../services/authService';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export interface UserProfile {
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  location_id?: string;
  company_id?: string;
  location_name?: string;
  company_name?: string;
}

export const useUserProfile = () => {
  const session = getSession();
  const [user, setUser] = useState<UserProfile | null>(session?.user || null);

  useEffect(() => {
    const fetchFreshProfile = async () => {
      try {
        const token = session?.token || localStorage.getItem('nola_auth_token');
        if (!token) {
          console.warn('[useUserProfile] No auth token found. Cannot fetch profile.');
          return;
        }

        console.log('[useUserProfile] Fetching profile with token...', token.substring(0, 15) + '...');
        const res = await fetch(`${API_BASE}/api/auth/me.php`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('[useUserProfile] Response status:', res.status);

        if (res.ok) {
          const data = await res.json();
          console.log('[useUserProfile] Fetched data:', data);
          if (data.user) {
            setUser(data.user);
            // Self-heal: Update localStorage so it's fresh for next page load
            localStorage.setItem('nola_auth_user', JSON.stringify(data.user));
          }
        } else {
          console.error('[useUserProfile] API Error:', res.status, await res.text());
        }
      } catch (err) {
        console.error("Failed to fetch fresh user profile", err);
      }
    };

    fetchFreshProfile();
  }, [session?.token]);

  return user;
};
