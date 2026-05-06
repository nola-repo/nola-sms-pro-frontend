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
        const token = session?.token;
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            // Self-heal: Update localStorage so it's fresh for next page load
            localStorage.setItem('nola_auth_user', JSON.stringify(data.user));
          }
        }
      } catch (err) {
        console.error("Failed to fetch fresh user profile", err);
      }
    };

    fetchFreshProfile();
  }, [session?.token]);

  return user;
};
