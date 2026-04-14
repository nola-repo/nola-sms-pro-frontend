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
 * Detects the GHL Agency Company ID for the current session.
 *
 * ── WHY this is intentionally different from LocationContext ──────────────────
 * The agency companyId identifies the TOP-LEVEL agency account.
 * It is FIXED for the entire session — it does NOT change when the user
 * navigates between subaccounts/locations in GHL's sidebar.
 *
 * When GHL switches subaccounts it fires a plain postMessage that contains
 * a `companyId` field — but that field holds the SUBACCOUNT's company ID,
 * not the agency-level ID. If we listened to plain postMessages (like
 * LocationContext does for location switching), we would contaminate the
 * agency companyId with a subaccount-level value.
 *
 * ── Detection priority (inside GHL iframe) ────────────────────────────────────
 *  1. URL path segment  /agency/COMPANY_ID  or  /location/COMPANY_ID
 *  2. URL query / hash  companyId= | company_id= | agency_id= | agencyId=
 *     (populated by the GHL custom menu link template {{company.id}})
 *  3. GHL postMessage SSO handshake  USER_DATA_RESPONSE → server-side AES decrypt
 *
 * The SSO decrypt always wins if it resolves after the URL fast-path, because
 * the server-decrypted payload is the authoritative agency-level companyId.
 *
 * ── Detection (outside iframe) ───────────────────────────────────────────────
 *  Falls through to AgencyContext's full fallback chain (session → env → URL).
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
   * finalize — stores and broadcasts a resolved agency companyId.
   * No-ops if the same ID is already set (prevents unnecessary re-renders).
   * Note: the SSO decrypt result can override a URL-param value if they differ,
   * because it is the authoritative source of the agency-level companyId.
   */
  const finalize = useCallback((cid: string) => {
    console.log(`NOLA SMS: Detected GHL Company: ${cid}`);
    safeStorage.setItem('nola_agency_id', cid);
    setState(prev =>
      prev.companyId === cid
        ? prev
        : { ...prev, companyId: cid, status: 'success' }
    );
  }, []);

  /**
   * Persistent GHL postMessage listener.
   *
   * Handles ONLY the encrypted SSO handshake (USER_DATA_RESPONSE + payload).
   *
   * ⚠️  We deliberately do NOT react to plain `companyId` fields found in
   * other GHL postMessages (e.g. LOCATION_CHANGED, subaccount-switch events).
   * Those messages carry the SUBACCOUNT's company ID — reacting to them would
   * replace the correct agency-level companyId with a subaccount-level value.
   */
  useEffect(() => {
    if (!state.isGhlFrame) return;

    const handleGhlMessage = async (event: MessageEvent) => {
      const raw = event.data;
      if (!raw || typeof raw !== 'object') return;

      // Ignore everything except the encrypted SSO payload
      if (raw.message !== 'USER_DATA_RESPONSE' || !raw.payload) return;

      try {
        const res = await fetch('/api/agency/ghl_sso_decrypt.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedPayload: raw.payload }),
        });
        const data = await res.json();
        console.log('[NOLA SMS] 🔒 SSO Decrypt Response:', data);
        
        if (data.companyId) {
          // SSO decrypt gives the TRUE agency-level companyId.
          console.log(`[NOLA SMS] ✅ SSO auth successful! Company ID: ${data.companyId}`);
          finalize(data.companyId);
        } else {
          throw new Error('Decrypt succeeded but companyId is missing from payload');
        }
      } catch (err) {
        console.error('[NOLA] SSO Decryption Error:', err);
        // Do NOT fall back to stale localStorage — the stored value may belong
        // to a different agency from a previous browser session.
        setState(s => (s.status !== 'success' ? { ...s, status: 'error' } : s));
      }
    };

    window.addEventListener('message', handleGhlMessage);
    return () => window.removeEventListener('message', handleGhlMessage);
  }, [state.isGhlFrame, finalize]);

  /**
   * One-shot initialisation (runs once, inside iframe only).
   *
   * Step 1 — URL fast-path:
   *   Reads companyId from URL path / query / hash params.
   *   For an agency-level GHL custom menu link the template variable
   *   {{company.id}} resolves to the agency company ID, giving an instant
   *   (synchronous) resolution without waiting for the SSO handshake.
   *
   *   Only looks for explicit agency/company keys — NOT `location_id` (which
   *   is the subaccount location ID supplied via {{location.id}} in the link
   *   and is NOT the agency-level company ID).
   *
   * Step 2 — SSO handshake:
   *   Fires REQUEST_USER_DATA to the GHL parent frame regardless of whether
   *   a URL param was found. The persistent listener above handles the response
   *   and will override the URL-param value if the server returns a different
   *   (authoritative) companyId.
   *
   * Step 3 — 2-second timeout:
   *   If neither URL params nor SSO resolved a companyId, surfaces an error.
   *   Does NOT read stale nola_agency_id from localStorage.
   */
  useEffect(() => {
    if (!state.isGhlFrame || initDoneRef.current) return;
    initDoneRef.current = true;

    // ── Step 1: URL fast-path ─────────────────────────────────────────────────

    // Check URL path segment: /agency/XYZ or /location/XYZ
    const pathMatch = window.location.pathname.match(
      /\/(?:location|agency)\/([a-zA-Z0-9_-]+)/i
    );
    if (pathMatch?.[1] && !pathMatch[1].includes('{{')) {
      console.log(`[NOLA SMS] ⚡ Fast-path resolved via URL path: ${pathMatch[1]}`);
      finalize(pathMatch[1]);
      // Still fall through to fire the SSO handshake for authoritative confirmation
    }

    // URL Dump for debugging exactly what GHL loaded the iframe with
    console.log('[NOLA SMS] 🔍 Raw Iframe URL Debug:', {
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash
    });

    // Check query / hash params — agency/company keys only
    // (state.companyId is always null here since init runs once on mount;
    //  use a local flag instead of reading stale state)
    if (!pathMatch?.[1]) {
      const companyKeys = ['companyId', 'company_id', 'agency_id', 'agencyId'];
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = window.location.hash.includes('?')
        ? new URLSearchParams(window.location.hash.split('?')[1])
        : null;

      outer: for (const key of companyKeys) {
        const vals = [
          ...(searchParams.getAll(key) ?? []),
          ...(hashParams?.getAll(key) ?? []),
        ];
        for (const val of vals) {
          if (val && val.trim() !== '' && !val.includes('{{')) {
            console.log(`[NOLA SMS] ⚡ Fast-path resolved via param (${key}): ${val}`);
            finalize(val);
            break outer;
          }
        }
      }
    }

    // ── Step 2: SSO handshake ─────────────────────────────────────────────────
    // Always fire this — the response (handled by the persistent listener above)
    // is the authoritative agency-level companyId and will override URL params
    // if they differ.
    try {
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
    } catch {
      // Not in a cross-origin iframe — postMessage unavailable
    }

    // ── Step 3: Timeout ───────────────────────────────────────────────────────
    // After 2 s, if we still don't have a companyId, surface an error.
    // IMPORTANT: Do NOT read safeStorage.getItem('nola_agency_id') here.
    // Inside a GHL iframe that value may belong to a different agency from a
    // previous session in the same browser.
    const fallbackTimer = setTimeout(() => {
      setState(s => (s.status !== 'success' ? { ...s, status: 'error' } : s));
    }, 2000);

    return () => clearTimeout(fallbackTimer);
  }, [state.isGhlFrame, finalize]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
