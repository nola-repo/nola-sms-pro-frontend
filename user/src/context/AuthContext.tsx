import React, { createContext, useContext, useState, useCallback } from 'react';
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

        // Clean up the URL so the token doesn't linger in browser history
        window.history.replaceState({}, document.title, window.location.pathname);
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
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
