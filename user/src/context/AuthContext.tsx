import React, { createContext, useState, useCallback } from 'react';
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
        // Store token in sessionStorage (tab-scoped) — not localStorage
        sessionSafeStorage.setItem(SESSION_KEYS.token, urlToken);

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
