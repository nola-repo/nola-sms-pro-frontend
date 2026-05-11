import { useEffect, useState } from 'react';
import { getSession, SESSION_KEYS, redirectToLogin } from '../services/authService';
import { safeStorage } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Matches the Firestore `users/{uid}` document shape.
 * 1:1 mapping — one user account per GHL sub-account.
 * `location_memberships` is intentionally excluded.
 */
export interface UserProfile {
  // Personal info
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  role?: string;
  active?: boolean;
  source?: string;
  created_at?: string;
  updated_at?: string;

  // Workspace / GHL info
  location_id?: string;        // normalised from active_location_id OR location_id
  active_location_id?: string; // raw Firestore field
  company_id?: string;
  location_name?: string;
  company_name?: string;
}

/**
 * Normalise a raw API/cache response to a clean UserProfile.
 * - Maps `active_location_id` → `location_id` when `location_id` is absent.
 * - Strips `location_memberships` (account is 1:1 with sub-account).
 */
function normalizeProfile(raw: Record<string, unknown>): UserProfile {
  const locationId =
    (raw.location_id as string | undefined) ||
    (raw.active_location_id as string | undefined) ||
    undefined;

  return {
    name:               (raw.name               as string) || '',
    firstName:          (raw.firstName           as string) || undefined,
    lastName:           (raw.lastName            as string) || undefined,
    email:              (raw.email               as string) || '',
    phone:              (raw.phone               as string) || undefined,
    role:               (raw.role                as string) || undefined,
    active:             raw.active !== undefined ? Boolean(raw.active) : undefined,
    source:             (raw.source              as string) || undefined,
    created_at:         (raw.created_at          as string) || undefined,
    updated_at:         (raw.updated_at          as string) || undefined,
    location_id:        locationId,
    active_location_id: (raw.active_location_id  as string) || undefined,
    company_id:         (raw.company_id          as string) || undefined,
    location_name:      (raw.location_name       as string) || undefined,
    company_name:       (raw.company_name        as string) || undefined,
    // location_memberships intentionally omitted (1:1 sub-account model)
  };
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
      return normalizeProfile(fromAuthUser);
    }
    const fromNolaUser = JSON.parse(localStorage.getItem('nola_user') || 'null');
    if (fromNolaUser?.email) {
      console.log("[useUserProfile] Found cached user in nola_user:", fromNolaUser.email);
      return normalizeProfile(fromNolaUser);
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
        if (res.status === 401) {
          console.warn("[useUserProfile] Auth token expired or invalid. Clearing session.");
          redirectToLogin();
          return;
        }

        if (res.ok) {
          const data = await res.json();
          console.log("[useUserProfile] Raw API response:", data);
          if (data.user) {
            const profile = normalizeProfile(data.user);
            console.log("[useUserProfile] Normalized profile — email:", profile.email, "| location_id:", profile.location_id, "| name:", profile.name);
            setUser(profile);
            // Self-heal: write normalised profile to both keys
            localStorage.setItem('nola_auth_user', JSON.stringify(profile));
            localStorage.setItem('nola_user', JSON.stringify(profile));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return user;
};
