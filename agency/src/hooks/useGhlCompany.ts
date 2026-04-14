import { useEffect, useState, useRef, useCallback } from 'react';
import { safeStorage } from '../utils/safeStorage';

export interface GhlCompanyState {
  companyId: string | null;
  isGhlFrame: boolean;
  status: 'loading' | 'success' | 'error' | 'idle';
}

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

  const finalize = useCallback((cid: string, source: string) => {
    console.log(`[NOLA SMS] ✅ Company ID resolved [${source}]: ${cid}`);
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
   * GHL strips query params from the iframe URL entirely — the app is always
   * loaded as https://agency.nolasmspro.com/ with no query parameters.
   * The ONLY way to get the companyId is via postMessage from GHL.
   *
   * We listen for ALL postMessages and log them so we can identify exactly
   * which message type / field contains the agency-level companyId.
   *
   * Priority:
   *  1. USER_DATA_RESPONSE + encrypted payload → server-side AES decrypt
   *  2. Any message with companyId field where companyId != location_id
   *     (plain unencrypted company data that GHL sends on some versions)
   */
  useEffect(() => {
    if (!state.isGhlFrame) return;

    const handleGhlMessage = async (event: MessageEvent) => {
      const raw = event.data;
      if (!raw || typeof raw !== 'object') return;

      // ── DEBUG: Log every GHL postMessage so we can see exactly what's sent ──
      console.log('[NOLA SMS] 📨 Incoming postMessage:', {
        message: raw.message,
        type: raw.type,
        action: raw.action,
        hasPayload: !!raw.payload,
        companyId: raw.companyId ?? raw.company_id ?? '(none)',
        locationId: raw.locationId ?? raw.location_id ?? '(none)',
        keys: Object.keys(raw),
      });

      // ── PATH A: Encrypted SSO handshake ───────────────────────────────────
      if (raw.message === 'USER_DATA_RESPONSE' && raw.payload) {
        console.log('[NOLA SMS] 🔒 SSO encrypted payload received, decrypting...');
        try {
          const res = await fetch('/api/agency/ghl_sso_decrypt.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedPayload: raw.payload }),
          });
          const data = await res.json();
          console.log('[NOLA SMS] 🔒 SSO Decrypt Response:', data);

          if (data.companyId) {
            finalize(data.companyId, 'SSO_DECRYPT');
          } else {
            console.warn('[NOLA SMS] ⚠️ SSO decrypt succeeded but no companyId in payload:', data);
          }
        } catch (err) {
          console.error('[NOLA SMS] SSO Decryption Error:', err);
        }
        return;
      }

      // ── PATH B: Plain companyId in any GHL postMessage ────────────────────
      // GHL sometimes sends plain (unencrypted) messages containing companyId.
      // We accept these ONLY if companyId is present and is NOT the same value
      // as the location_id in the same message. This distinguishes agency-level
      // IDs from subaccount-level IDs that also appear in GHL postMessages.
      const cid = raw.companyId ?? raw.company_id ?? null;
      const lid = raw.locationId ?? raw.location_id ?? null;

      if (cid && typeof cid === 'string' && cid !== lid) {
        // Only accept if we haven't already resolved via SSO (SSO takes priority)
        setState(prev => {
          if (prev.status === 'success') return prev; // SSO already resolved — don't overwrite
          finalize(cid, `PLAIN_MESSAGE:${raw.message ?? raw.type ?? 'unknown'}`);
          return prev; // finalize calls setState itself
        });
      }
    };

    window.addEventListener('message', handleGhlMessage);
    return () => window.removeEventListener('message', handleGhlMessage);
  }, [state.isGhlFrame, finalize]);

  /**
   * One-shot initialisation (runs once, inside iframe only).
   */
  useEffect(() => {
    if (!state.isGhlFrame || initDoneRef.current) return;
    initDoneRef.current = true;

    // URL Dump — GHL is known to strip query params before loading the iframe.
    // The URL will almost always be just the base URL with no params.
    console.log('[NOLA SMS] 🔍 Iframe URL at mount:', {
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
    });

    // ── URL fast-path (works only if GHL preserves query params) ─────────────
    const companyKeys = ['companyId', 'company_id', 'agency_id', 'agencyId'];
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = window.location.hash.includes('?')
      ? new URLSearchParams(window.location.hash.split('?')[1])
      : null;

    let foundViaUrl = false;
    outer: for (const key of companyKeys) {
      const vals = [
        ...(searchParams.getAll(key) ?? []),
        ...(hashParams?.getAll(key) ?? []),
      ];
      for (const val of vals) {
        if (val && val.trim() !== '' && !val.includes('{{')) {
          finalize(val, `URL_PARAM:${key}`);
          foundViaUrl = true;
          break outer;
        }
      }
    }

    if (!foundViaUrl) {
      console.log('[NOLA SMS] ⚡ No companyId in URL — waiting for GHL postMessage SSO...');
    }

    // ── Fire SSO handshake — response handled by persistent listener ──────────
    try {
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
      console.log('[NOLA SMS] 📤 Sent REQUEST_USER_DATA to GHL parent frame');
    } catch {
      console.warn('[NOLA SMS] Could not send REQUEST_USER_DATA — not in cross-origin iframe?');
    }

    // ── Timeout: 10 s to allow GHL time to respond ────────────────────────────
    // GHL sometimes takes several seconds to fire postMessages after the iframe
    // is loaded. 2 s was too short — extended to 10 s.
    const fallbackTimer = setTimeout(() => {
      setState(s => {
        if (s.status !== 'success') {
          console.error('[NOLA SMS] ❌ Timeout: No companyId received after 10s. Check GHL postMessages above.');
          return { ...s, status: 'error' };
        }
        return s;
      });
    }, 10000);

    return () => clearTimeout(fallbackTimer);
  }, [state.isGhlFrame, finalize]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
