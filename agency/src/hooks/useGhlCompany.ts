import { useEffect, useState, useRef, useCallback } from 'react';
import { safeStorage } from '../utils/safeStorage';

export interface GhlCompanyState {
  companyId: string | null;
  isGhlFrame: boolean;
  status: 'loading' | 'success' | 'error' | 'idle';
}

/**
 * useGhlCompany
 *
 * Detects and tracks the GHL Agency Company ID across the entire session.
 * Architecture mirrors LocationContext on the user side — the postMessage
 * listener is persistent (not torn down after first success) so live
 * mid-session agency switches are handled automatically.
 *
 * Detection priority:
 *  1. URL path / query / hash params  (fast-path, sync)
 *  2. GHL postMessage SSO handshake   (async, encrypted → server decrypt)
 *  3. Plain companyId in postMessages (live agency switch events)
 */
export function useGhlCompany(): GhlCompanyState {
  const initDoneRef = useRef(false);

  const [state, setState] = useState<GhlCompanyState>(() => {
    let isIframe = false;
    try {
      isIframe = window.self !== window.top;
    } catch {
      isIframe = true;
    }
    return {
      companyId: null,
      isGhlFrame: isIframe,
      status: isIframe ? 'loading' : 'idle',
    };
  });

  /**
   * finalize — stable callback that stores and broadcasts a resolved companyId.
   * No-ops if the same ID is already set (prevents unnecessary re-renders).
   */
  const finalize = useCallback((cid: string) => {
    console.log(`NOLA SMS: Detected GHL Company: ${cid}`);
    safeStorage.setItem('nola_agency_id', cid);
    setState(prev =>
      prev.companyId === cid ? prev : { ...prev, companyId: cid, status: 'success' }
    );
  }, []);

  /**
   * Effect 1 — Persistent GHL postMessage listener.
   *
   * Stays alive for the entire component lifetime (never torn down on success).
   * Handles two message paths:
   *   A) USER_DATA_RESPONSE with encrypted payload → server-side SSO decrypt
   *   B) Plain companyId fields in any postMessage → live agency-switch events
   *
   * This mirrors how LocationContext handles subaccount switching on the user side.
   */
  useEffect(() => {
    if (!state.isGhlFrame) return;

    const handleGhlMessage = async (event: MessageEvent) => {
      const raw = event.data;
      if (!raw || typeof raw !== 'object') return;

      // Path A: Encrypted SSO payload — requires server-side decryption
      if (raw.message === 'USER_DATA_RESPONSE' && raw.payload) {
        try {
          const res = await fetch('/api/agency/ghl_sso_decrypt.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedPayload: raw.payload }),
          });
          const data = await res.json();
          if (data.companyId) {
            finalize(data.companyId);
          } else {
            throw new Error('Invalid decrypted payload');
          }
        } catch (err) {
          console.error('SSO Decryption Error:', err);
          // Do NOT fall back to stale localStorage — it may belong to a different agency.
          setState(s => (s.status !== 'success' ? { ...s, status: 'error' } : s));
        }
        return; // handled — skip Path B for this message
      }

      // Path B: Plain companyId fields (live agency switch or other GHL events)
      const candidates = [
        raw.companyId,
        raw.company_id,
        raw.agencyId,
        raw.agency_id,
        raw.payload?.companyId,
        raw.payload?.company_id,
        raw.data?.companyId,
        raw.data?.company_id,
      ];
      for (const c of candidates) {
        if (typeof c === 'string' && c.length > 4 && !c.includes('{{')) {
          finalize(c);
          break;
        }
      }
    };

    window.addEventListener('message', handleGhlMessage);
    return () => window.removeEventListener('message', handleGhlMessage);
  }, [state.isGhlFrame, finalize]);

  /**
   * Effect 2 — One-shot initialisation.
   *
   * Runs once when inside an iframe:
   *  1. Checks URL path / query / hash params (synchronous fast-path)
   *  2. Fires REQUEST_USER_DATA to the GHL parent frame
   *  3. Sets a 2-second timeout — if the persistent listener above hasn't resolved
   *     the companyId by then, surfaces an error (never reads stale localStorage).
   */
  useEffect(() => {
    if (!state.isGhlFrame || initDoneRef.current) return;
    initDoneRef.current = true;

    // Fast-path: URL path segment
    const pathMatch = window.location.pathname.match(/\/(?:location|agency)\/([a-zA-Z0-9_-]+)/i);
    if (pathMatch?.[1] && !pathMatch[1].includes('{{')) {
      finalize(pathMatch[1]);
      return;
    }

    // Fast-path: query / hash params
    const companyKeys = ['companyId', 'company_id', 'agency_id', 'agencyId'];
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = window.location.hash.includes('?')
      ? new URLSearchParams(window.location.hash.split('?')[1])
      : null;

    for (const key of companyKeys) {
      const vals = [
        ...(searchParams.getAll(key) ?? []),
        ...(hashParams?.getAll(key) ?? []),
      ];
      for (const val of vals) {
        if (val && val.trim() !== '' && !val.includes('{{')) {
          finalize(val);
          return;
        }
      }
    }

    // No URL param found — fire the SSO handshake.
    // The response will be caught by Effect 1's persistent listener.
    try {
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
    } catch {
      // Not in a cross-origin iframe — postMessage unavailable
    }

    // 2-second safety timeout.
    // IMPORTANT: Do NOT read safeStorage.getItem('nola_agency_id') here.
    // We are inside a GHL iframe and that value may belong to a different
    // agency from a previous browser session. Surface an error instead.
    const fallbackTimer = setTimeout(() => {
      setState(s => (s.status !== 'success' ? { ...s, status: 'error' } : s));
    }, 2000);

    return () => clearTimeout(fallbackTimer);
  }, [state.isGhlFrame, finalize]);

  return state;
}
