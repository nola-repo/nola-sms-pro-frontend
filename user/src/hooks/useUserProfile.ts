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

/**
 * Read the best available cached user from localStorage.
 * Checks both keys: 'nola_auth_user' (written by authService/me endpoint)
 * and 'nola_user' (written by auth-handoff.html after GHL install).
 */
function getCachedUser(): UserProfile | null {
  try {
    const fromAuthUser = JSON.parse(localStorage.getItem('nola_auth_user') || 'null');
    if (fromAuthUser?.email) return fromAuthUser;
    const fromNolaUser = JSON.parse(localStorage.getItem('nola_user') || 'null');
    if (fromNolaUser?.email) return fromNolaUser;
  } catch { /* ignore parse errors */ }
  return null;
}

/**
 * Get the auth token from any known storage key.
 * auth-handoff.html writes 'nola_auth_token' directly to localStorage.
 * getSession() reads via safeStorage which also checks localStorage.
 */
function getToken(): string | null {
  try {
    // Try safeStorage-aware session first
    const sessionToken = getSession()?.token;
    if (sessionToken) return sessionToken;
    // Fallback: raw localStorage (handles GHL iframe / auth-handoff users)
    return localStorage.getItem('nola_auth_token');
  } catch { return null; }
}

export const useUserProfile = () => {
  // Initialize from cache immediately so the UI shows data on first render
  const [user, setUser] = useState<UserProfile | null>(getCachedUser);

  useEffect(() => {
    const fetchFreshProfile = async () => {
      try {
        const token = getToken();
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
            // Self-heal: write to both keys so all code paths find fresh data
            localStorage.setItem('nola_auth_user', JSON.stringify(data.user));
            localStorage.setItem('nola_user', JSON.stringify(data.user));
          }
        }
      } catch (err) {
        console.error('[useUserProfile] Failed to fetch fresh user profile', err);
      }
    };

    fetchFreshProfile();
    // Run once on mount — token doesn't change mid-session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return user;
};
