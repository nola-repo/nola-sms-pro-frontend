import { devLog } from '../utils/devLog';
/**
 * LocationContext — Reactive GHL Location ID for the User Panel
 *
 * Provides the current GHL location_id as React state so all child components
 * re-render automatically whenever the subaccount changes. This is the single
 * source of truth for location_id across the entire user panel.
 *
 * Detection sources (in priority order):
 *  1. URL query/hash params (e.g. ?location_id=xxx) — GHL iframe direct load
 *  2. postMessage from GHL parent frame — fires when GHL switches subaccounts
 *  3. localStorage via getAccountSettings() — persisted fallback
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAccountSettings, saveAccountSettings } from '../utils/settingsStorage';
import { safeStorage } from '../utils/safeStorage';
import { getSession, clearAuthSession, saveSession } from '../services/authService';
import { apiFetch } from '../utils/apiFetch';

interface LocationContextValue {
  locationId: string;
  isLocationResolving: boolean;
  setLocationId: (id: string) => void;
}

const LocationContext = createContext<LocationContextValue>({
  locationId: '',
  isLocationResolving: false,
  setLocationId: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useLocationId = () => useContext(LocationContext);

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractLocationFromUrl(): string | null {
  const keys = ['location_id', 'locationId', 'location', 'id'];
  const search = window.location.search;
  const hash   = window.location.hash;

  const getParam = (query: string, key: string) =>
    new URLSearchParams(query).get(key);

  for (const k of keys) {
    const val = getParam(search, k);
    if (val && val.length > 4) return val;
  }

  if (hash.includes('?')) {
    const hashQuery = hash.split('?')[1];
    for (const k of keys) {
      const val = getParam('?' + hashQuery, k);
      if (val && val.length > 4) return val;
    }
  }

  return null;
}

function extractLocationFromMessage(event: MessageEvent): string | null {
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (!data || typeof data !== 'object') return null;

    // GHL sends different payloads depending on version/event
    const candidates = [
      data.locationId,
      data.location_id,
      data.location?.id,
      data.payload?.locationId,
      data.payload?.location_id,
      data.data?.locationId,
      data.data?.location_id,
    ];

    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 4) return c;
    }
  } catch {
    // Not JSON or irrelevant message
  }
  return null;
}

function isLikelyGhlEmbedded(): boolean {
  try {
    return window.self !== window.top || sessionStorage.getItem('nola_is_ghl_frame') === 'true';
  } catch {
    return true;
  }
}

function getStoredLocationId(): string {
  const sessionLocationId = safeStorage.getItem('nola_location_id');
  if (sessionLocationId && sessionLocationId.length > 4) {
    return sessionLocationId;
  }

  try {
    const authUser = JSON.parse(safeStorage.getItem('nola_auth_user') || 'null');
    if (authUser?.location_id) return authUser.location_id;
    if (authUser?.active_location_id) return authUser.active_location_id;

    const nolaUser = JSON.parse(safeStorage.getItem('nola_user') || 'null');
    if (nolaUser?.location_id) return nolaUser.location_id;
    if (nolaUser?.active_location_id) return nolaUser.active_location_id;
  } catch {
    // ignore parsing errors
  }

  return getAccountSettings().ghlLocationId || '';
}

// ── Provider ─────────────────────────────────────────────────────────────────

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locationId, setLocationIdState] = useState<string>(() => {
    // Priority 1: URL param on initial load
    const fromUrl = extractLocationFromUrl();
    if (fromUrl) {
      // Synchronously write to localStorage so children reading getAccountSettings on mount see it immediately
      const settings = getAccountSettings();
      if (settings.ghlLocationId !== fromUrl) {
        saveAccountSettings({ ...settings, ghlLocationId: fromUrl });
      }
      return fromUrl;
    }
    
    // Priority 2-4: explicit session, cached user profile, persisted storage.
    return getStoredLocationId();
  });
  const [isLocationResolving, setIsLocationResolving] = useState<boolean>(() => {
    return !extractLocationFromUrl() && !getStoredLocationId() && isLikelyGhlEmbedded();
  });

  // Persist and broadcast whenever locationId changes
  const setLocationId = useCallback((newId: string) => {
    if (!newId || newId === locationId) return;

    // Persist to localStorage
    const settings = getAccountSettings();
    if (settings.ghlLocationId !== newId) {
      saveAccountSettings({ ...settings, ghlLocationId: newId });
    }

    setLocationIdState(newId);
    setIsLocationResolving(false);

    // Broadcast so Dashboard and other listeners can reset state
    window.dispatchEvent(
      new CustomEvent('ghl-location-changed', { detail: { locationId: newId } })
    );
  }, [locationId]);

  // ── Source 1: URL polling (handles iframe src changes) ────────────────────
  useEffect(() => {
    let lastUrl = window.location.href;

    const checkUrl = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const fromUrl = extractLocationFromUrl();
        if (fromUrl) setLocationId(fromUrl);
      }
    };

    const timer = setInterval(checkUrl, 1000);
    return () => clearInterval(timer);
  }, [setLocationId]);

  // ── Source 2: GHL postMessage (handles subaccount switching in iframe) ────
  useEffect(() => {
    if (locationId) {
      setIsLocationResolving(false);
      return;
    }

    if (!isLikelyGhlEmbedded()) {
      setIsLocationResolving(false);
      return;
    }

    setIsLocationResolving(true);

    const checkForLocation = () => {
      const fromUrl = extractLocationFromUrl();
      if (fromUrl) {
        setLocationId(fromUrl);
        return;
      }

      const fromStorage = getStoredLocationId();
      if (fromStorage) {
        setLocationId(fromStorage);
      }
    };

    checkForLocation();
    const pollTimer = window.setInterval(checkForLocation, 250);
    const fallbackTimer = window.setTimeout(() => {
      setIsLocationResolving(false);
      window.clearInterval(pollTimer);
    }, 3500);

    window.addEventListener('popstate', checkForLocation);
    window.addEventListener('hashchange', checkForLocation);

    return () => {
      window.clearInterval(pollTimer);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('popstate', checkForLocation);
      window.removeEventListener('hashchange', checkForLocation);
    };
  }, [locationId, setLocationId]);

  // ?? Source 3: GHL postMessage (handles subaccount switching in iframe) ????
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from any origin since GHL parent is on a different domain
      const fromId = extractLocationFromMessage(event);
      if (fromId) setLocationId(fromId);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setLocationId]);

  // ── Source 3: Listen for manual location changes from Settings ────────────
  useEffect(() => {
    const handleManual = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.locationId) setLocationId(detail.locationId);
    };

    window.addEventListener('ghl-location-set', handleManual);
    return () => window.removeEventListener('ghl-location-set', handleManual);
  }, [setLocationId]);

  const autoLoginInFlightRef = React.useRef(false);

  // ── Source 4: Silent Sub-Account Auto-Login (Option A) ──────────────────────
  useEffect(() => {
    const session = getSession();
    const hasLocationId = !!locationId && locationId.length > 4;

    const isUnauthenticated = !session;
    const isMismatch = session && session.role !== 'agency' && session.locationId !== locationId;

    if (hasLocationId && (isUnauthenticated || isMismatch)) {
      if (autoLoginInFlightRef.current) return;
      autoLoginInFlightRef.current = true;

      devLog.log(
        `[LocationContext] Triggering silent auto-login for location: ${locationId}. Reason: ${
          isUnauthenticated ? 'Unauthenticated' : 'Session mismatch'
        }`
      );

      const autoLoginParams = new URLSearchParams({ location_id: locationId });
      apiFetch(`/api/auth/ghl_autologin?${autoLoginParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GHL-Location-ID': locationId,
        },
        body: JSON.stringify({
          location_id: locationId,
          locationId,
          active_location_id: locationId,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (res.ok) {
            if (data?.token) {
              devLog.log(`[LocationContext] Silent auto-login succeeded for ${locationId}. Saving session and reloading.`);
              clearAuthSession();
              saveSession(data);
              window.location.reload();
              return;
            }
          }

          const message = data?.message || data?.error || data?.details || res.statusText;
          devLog.warn(`[LocationContext] Silent auto-login failed for location ${locationId}. Status: ${res.status}`, message);
          autoLoginInFlightRef.current = false;

          if (isMismatch) {
            clearAuthSession();
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.set('location_id', locationId);
            searchParams.set('locationId', locationId);
            window.location.href = `/login?${searchParams.toString()}`;
          }
        })
        .catch((err) => {
          devLog.error('[LocationContext] Silent auto-login error:', err);
          autoLoginInFlightRef.current = false;
          if (isMismatch) {
            clearAuthSession();
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.set('location_id', locationId);
            searchParams.set('locationId', locationId);
            window.location.href = `/login?${searchParams.toString()}`;
          }
        });
    }
  }, [locationId]);

  return (
    <LocationContext.Provider value={{ locationId, isLocationResolving, setLocationId }}>
      {children}
    </LocationContext.Provider>
  );
};
