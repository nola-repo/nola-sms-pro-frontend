import { devLog } from '../utils/devLog';
import React, { createContext, useState, useCallback, useEffect } from 'react';
import {
  getSession,
  saveSession,
  clearSession,
  SESSION_KEYS,
  type AuthSession,
  type LoginResponse,
} from '../services/authService';
import { safeStorage } from '../utils/safeStorage';
import { sessionSafeStorage } from '../utils/sessionSafeStorage';

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthContextValue extends Partial<AuthSession> {
  isAuthenticated: boolean;
  isAgency:  boolean;
  isUser:    boolean;
  login:     (data: LoginResponse) => void;
  logout:    () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const persistSessionHintsFromToken = (token: string) => {
  const payload = decodeJwtPayload(token);
  if (!payload) return;

  const role = typeof payload.role === 'string' ? payload.role : 'user';
  const companyId =
    typeof payload.company_id === 'string' ? payload.company_id :
    typeof payload.companyId === 'string' ? payload.companyId :
    null;
  const locationId =
    typeof payload.location_id === 'string' ? payload.location_id :
    typeof payload.locationId === 'string' ? payload.locationId :
    typeof payload.active_location_id === 'string' ? payload.active_location_id :
    null;

  safeStorage.setItem(SESSION_KEYS.role, role);

  if (companyId) {
    safeStorage.setItem(SESSION_KEYS.companyId, companyId);
  }

  if (locationId) {
    safeStorage.setItem(SESSION_KEYS.locationId, locationId);
    safeStorage.setItem('nola_settings_account', JSON.stringify({
      ghlLocationId: locationId,
      displayName: '',
    }));
  }
};

const persistTokenForNewTabs = (token: string) => {
  sessionSafeStorage.setItem(SESSION_KEYS.token, token);
  safeStorage.setItem(SESSION_KEYS.token, token);
  try { sessionStorage.setItem(SESSION_KEYS.token, token); } catch { /* storage may be blocked in embedded views */ }
  try { localStorage.setItem(SESSION_KEYS.token, token); } catch { /* storage may be blocked in embedded views */ }
  persistSessionHintsFromToken(token);
};

// ── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => {
    // Check URL for token first to bypass iframe localStorage restrictions
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');

      if (urlToken) {
        Object.values(SESSION_KEYS).forEach(k => {
          safeStorage.removeItem(k);
          sessionSafeStorage.removeItem(k);
        });
        safeStorage.removeItem('nola_user');
        safeStorage.removeItem('nola_settings_account');
        // Store token in every available browser scope so new tabs can restore the session.
        persistTokenForNewTabs(urlToken);

        // Clean up token + post_auth_redirect from URL so they don't leak.
        const postAuthRedirect = params.get('post_auth_redirect') || '';
        params.delete('token');
        params.delete('post_auth_redirect');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, document.title, nextUrl);

        // If there's a post-auth redirect destination (e.g. GHL embedded page or standalone dashboard),
        // navigate there now. This fires after localStorage is written so the embedded app has a token.
        if (postAuthRedirect) {
          try {
            // Allow relative paths (/v2/...) or same-origin absolute URLs only to prevent open-redirect.
            const resolved = postAuthRedirect.startsWith('/')
              ? `${window.location.origin}${postAuthRedirect}`
              : postAuthRedirect;
            const resolvedUrl = new URL(resolved);
            const allowedHosts = ['app.nolacrm.io', 'app.nolasmspro.com', window.location.hostname];
            if (allowedHosts.includes(resolvedUrl.hostname)) {
              window.location.replace(resolved);
            }
          } catch {
            // Invalid URL — skip redirect
          }
        }
      }
    } catch (e) {
      devLog.error("[AuthContext] Error parsing URL token:", e);
    }

    const initialSession = getSession();
    return initialSession;
  });

  useEffect(() => {
    if (!session?.token) return;
    persistTokenForNewTabs(session.token);
  }, [session?.token]);

  const login = useCallback((data: LoginResponse) => {
    saveSession(data);
    setSession(getSession());
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    window.location.href = '/login';
  }, []);

  const value: AuthContextValue = {
    ...session,
    isAuthenticated: !!session?.token,
    isAgency:  session?.role === 'agency',
    isUser:    session?.role === 'user',
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ── Hook ─────────────────────────────────────────────────────────────────────
