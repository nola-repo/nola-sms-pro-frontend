import { useEffect, useState } from 'react';
import { getSession, SESSION_KEYS } from '../services/authService';
import { safeStorage } from '../utils/safeStorage';

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
    if (fromAuthUser?.email) {
      console.log("[useUserProfile] Found cached user in nola_auth_user:", fromAuthUser.email);
      return fromAuthUser;
    }
    const fromNolaUser = JSON.parse(localStorage.getItem('nola_user') || 'null');
    if (fromNolaUser?.email) {
      console.log("[useUserProfile] Found cached user in nola_user:", fromNolaUser.email);
      return fromNolaUser;
    }
  } catch (e) { 
    console.error("[useUserProfile] Error parsing cached user:", e);
  }
  console.log("[useUserProfile] No cached user found.");
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
    if (sessionToken) {
      console.log("[useUserProfile] Token retrieved via getSession()");
      return sessionToken;
    }
    // Fallback: safeStorage (works even when localStorage is blocked in GHL iframe)
    const rawToken = safeStorage.getItem(SESSION_KEYS.token);
    if (rawToken) {
      console.log("[useUserProfile] Token retrieved via safeStorage fallback");
      return rawToken;
    }
    console.log("[useUserProfile] No token found in any storage.");
    return null;
  } catch (e) { 
    console.error("[useUserProfile] Error getting token:", e);
    return null; 
  }
}

export const useUserProfile = () => {
  // Initialize from cache immediately so the UI shows data on first render
  const [user, setUser] = useState<UserProfile | null>(getCachedUser);

  useEffect(() => {
    const fetchFreshProfile = async () => {
      try {
        console.log("[useUserProfile] Attempting to fetch fresh profile...");
        const token = getToken();
        if (!token) {
          console.warn("[useUserProfile] Cannot fetch profile, no token available.");
          return;
        }

        console.log("[useUserProfile] Making fetch call to /api/auth/me...");
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log("[useUserProfile] Fetch response status:", res.status);
        if (res.ok) {
          const data = await res.json();
          console.log("[useUserProfile] Fetch data received:", !!data.user);
          if (data.user) {
            setUser(data.user);
            // Self-heal: write to both keys so all code paths find fresh data
            localStorage.setItem('nola_auth_user', JSON.stringify(data.user));
            localStorage.setItem('nola_user', JSON.stringify(data.user));
            console.log("[useUserProfile] Profile successfully synced to localStorage");
          }
        } else {
           console.error("[useUserProfile] Fetch failed. Status:", res.status, "Text:", await res.text().catch(() => ""));
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
