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
import {
  detectLocationFromCurrentUrl,
  detectLocationFromPostMessage,
  normalizeLocationCandidate,
  type LocationDetectionResult,
  type LocationSource,
} from '../utils/ghlLocationDetection';

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

function isLikelyGhlEmbedded(): boolean {
  try {
    return window.self !== window.top || sessionStorage.getItem('nola_is_ghl_frame') === 'true';
  } catch {
    return true;
  }
}

function getStoredLocationId(): LocationDetectionResult | null {
  try {
    const session = getSession();
    const sessionLocationId = normalizeLocationCandidate(session?.locationId);
    if (sessionLocationId) return { locationId: sessionLocationId, source: 'storage', path: 'storage.session.locationId' };
  } catch {
    // ignore unavailable session storage
  }

  const sessionLocationId = normalizeLocationCandidate(safeStorage.getItem('nola_location_id'));
  if (sessionLocationId) {
    return { locationId: sessionLocationId, source: 'storage', path: 'storage.nola_location_id' };
  }

  try {
    const authUser = JSON.parse(safeStorage.getItem('nola_auth_user') || 'null');
    const authUserLocationId = normalizeLocationCandidate(authUser?.location_id);
    if (authUserLocationId) return { locationId: authUserLocationId, source: 'storage', path: 'storage.nola_auth_user.location_id' };
    const authUserActiveLocationId = normalizeLocationCandidate(authUser?.active_location_id);
    if (authUserActiveLocationId) return { locationId: authUserActiveLocationId, source: 'storage', path: 'storage.nola_auth_user.active_location_id' };

    const nolaUser = JSON.parse(safeStorage.getItem('nola_user') || 'null');
    const nolaUserLocationId = normalizeLocationCandidate(nolaUser?.location_id);
    if (nolaUserLocationId) return { locationId: nolaUserLocationId, source: 'storage', path: 'storage.nola_user.location_id' };
    const nolaUserActiveLocationId = normalizeLocationCandidate(nolaUser?.active_location_id);
    if (nolaUserActiveLocationId) return { locationId: nolaUserActiveLocationId, source: 'storage', path: 'storage.nola_user.active_location_id' };
  } catch {
    // ignore parsing errors
  }

  const settingsLocationId = normalizeLocationCandidate(getAccountSettings().ghlLocationId);
  return settingsLocationId
    ? { locationId: settingsLocationId, source: 'storage', path: 'storage.accountSettings.ghlLocationId' }
    : null;
}
export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locationId, setLocationIdState] = useState<string>(() => {
    // Priority 1: URL param on initial load
    const fromUrl = detectLocationFromCurrentUrl();
    if (fromUrl) {
      // Synchronously write to localStorage so children reading getAccountSettings on mount see it immediately
      const settings = getAccountSettings();
      if (settings.ghlLocationId !== fromUrl.locationId) {
        saveAccountSettings({ ...settings, ghlLocationId: fromUrl.locationId });
      }
      devLog.log(`[LocationContext] Resolved GHL location from ${fromUrl.path}`);
      return fromUrl.locationId;
    }
    
    // Storage is only safe outside a live GHL iframe/context.
    if (isLikelyGhlEmbedded()) return '';

    const fromStorage = getStoredLocationId();
    if (fromStorage) devLog.log(`[LocationContext] Resolved GHL location from ${fromStorage.path}`);
    return fromStorage?.locationId ?? '';
  });
  const [isLocationResolving, setIsLocationResolving] = useState<boolean>(() => {
    return !detectLocationFromCurrentUrl() && isLikelyGhlEmbedded();
  });

  // Persist and broadcast whenever locationId changes
  const setLocationId = useCallback((newId: string, source: LocationSource = 'manual', sourcePath: string = source) => {
    if (!newId || newId === locationId) return;

    // Persist to localStorage
    const settings = getAccountSettings();
    if (settings.ghlLocationId !== newId) {
      saveAccountSettings({ ...settings, ghlLocationId: newId });
    }

    setLocationIdState(newId);
    setIsLocationResolving(false);
    devLog.log(`[LocationContext] Updated GHL location from ${sourcePath}: ${newId}`);

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
        const fromUrl = detectLocationFromCurrentUrl();
        if (fromUrl) setLocationId(fromUrl.locationId, fromUrl.source, fromUrl.path);
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
      const fromUrl = detectLocationFromCurrentUrl();
      if (fromUrl) {
        setLocationId(fromUrl.locationId, fromUrl.source, fromUrl.path);
        return;
      }
    };

    checkForLocation();
    const pollTimer = window.setInterval(checkForLocation, 250);
    const fallbackTimer = window.setTimeout(() => {
      setIsLocationResolving(false);
      window.clearInterval(pollTimer);
    }, 8000);

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
      const fromMessage = detectLocationFromPostMessage(event);
      if (fromMessage) setLocationId(fromMessage.locationId, fromMessage.source, fromMessage.path);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setLocationId]);

  // ── Source 3: Listen for manual location changes from Settings ────────────
  useEffect(() => {
    const handleManual = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.locationId) setLocationId(detail.locationId, 'manual', 'event.ghl-location-set');
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
