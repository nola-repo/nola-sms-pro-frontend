import { useEffect, useState, useRef } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { SESSION_KEYS } from '../services/agencyAuthHelper';

export type GhlAutoLoginStatus = 'idle' | 'loading' | 'success' | 'error';

export interface GhlCompanyState {
  companyId:       string | null;
  isGhlFrame:      boolean;
  autoLoginStatus: GhlAutoLoginStatus;
  autoLoginError:  string | null;
}

/**
 * useGhlCompany
 * Detects a GHL company context injected into the iframe URL and
 * automatically exchanges it for a NOLA JWT via the backend.
 *
 * GHL injects the companyId via URL params when the marketplace app loads:
 *   https://agency.nolasmspro.com/?companyId=ABC123
 *
 * If we detect companyId AND there is no current valid JWT, we call
 * POST /api/agency/ghl_autologin to get a token automatically.
 */
export function useGhlCompany(): GhlCompanyState {
  const calledRef = useRef(false);

  // ── Detect companyId from URL (search + hash) ──────────────────────────────
  const resolveCompanyId = (): string | null => {
    const companyKeys = [
      'companyId', 'company_id', 'agency_id', 'agencyId',
      // GHL sometimes passes locationId in agency context
      'locationId', 'location_id',
    ];

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams   = window.location.hash.includes('?')
      ? new URLSearchParams(window.location.hash.split('?')[1])
      : null;

    const getParam = (key: string) =>
      searchParams.get(key) || hashParams?.get(key) || null;

    for (const key of companyKeys) {
      const val = getParam(key);
      // Skip GHL template placeholders that weren't replaced
      if (val && !val.includes('{{')) return val;
    }
    return null;
  };

  const urlCompanyId = resolveCompanyId();
  const isGhlFrame   = !!urlCompanyId;

  const [state, setState] = useState<GhlCompanyState>({
    companyId:       urlCompanyId ?? safeStorage.getItem('nola_agency_id'),
    isGhlFrame,
    autoLoginStatus: 'idle',
    autoLoginError:  null,
  });

  useEffect(() => {
    if (!urlCompanyId) return;          // Not in GHL frame — nothing to do
    if (calledRef.current) return;      // Don't run twice (StrictMode)
    calledRef.current = true;

    // Persist the company id immediately
    safeStorage.setItem('nola_agency_id', urlCompanyId);

    // Already have a valid token? Skip auto-login.
    const existingToken = safeStorage.getItem(SESSION_KEYS.token);
    const existingRole  = safeStorage.getItem(SESSION_KEYS.role);
    if (existingToken && existingRole === 'agency') {
      setState(s => ({ ...s, companyId: urlCompanyId, autoLoginStatus: 'success' }));
      return;
    }

    // ── Trigger auto-login ───────────────────────────────────────────────────
    setState(s => ({ ...s, companyId: urlCompanyId, autoLoginStatus: 'loading' }));

    fetch('/api/agency/ghl_autologin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ company_id: urlCompanyId }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.token) {
          throw new Error(data.error ?? 'Auto-login failed');
        }
        // Save the JWT just like a normal login
        safeStorage.setItem(SESSION_KEYS.token, data.token);
        safeStorage.setItem(SESSION_KEYS.role, 'agency');
        if (data.user) {
          safeStorage.setItem(SESSION_KEYS.user, JSON.stringify(data.user));
        }
        if (data.company_id) {
          safeStorage.setItem(SESSION_KEYS.companyId, data.company_id);
          safeStorage.setItem('nola_agency_id', data.company_id);
        }
        setState(s => ({ ...s, autoLoginStatus: 'success' }));
      })
      .catch((err: Error) => {
        setState(s => ({
          ...s,
          autoLoginStatus: 'error',
          autoLoginError:  err.message,
        }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
