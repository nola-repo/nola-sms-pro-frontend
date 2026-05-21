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

const persistTokenForNewTabs = (token: string) => {
  sessionSafeStorage.setItem(SESSION_KEYS.token, token);
  safeStorage.setItem(SESSION_KEYS.token, token);
  try { sessionStorage.setItem(SESSION_KEYS.token, token); } catch { /* storage may be blocked in embedded views */ }
  try { localStorage.setItem(SESSION_KEYS.token, token); } catch { /* storage may be blocked in embedded views */ }
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

        // Clean up only the token so GHL/location prefill params can still flow through the app.
        params.delete('token');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, document.title, nextUrl);
      }
    } catch (e) {
      console.error("[AuthContext] Error parsing URL token:", e);
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
