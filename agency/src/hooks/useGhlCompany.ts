import { useEffect, useState, useRef, useCallback } from 'react';
import { safeStorage } from '../utils/safeStorage';

export interface GhlCompanyState {
  companyId: string | null;
  isGhlFrame: boolean;
  status: 'loading' | 'success' | 'error' | 'idle';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the agency-level company ID from a GHL postMessage event.
 *
 * GHL sends different payloads depending on the version and event type.
 * We scan all known nesting paths where companyId might appear.
 *
 * We deliberately ignore `locationId` / `location_id` fields — those are
 * subaccount-level identifiers and must not be used as the agency companyId.
 */
function extractCompanyFromMessage(event: MessageEvent): string | null {
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (!data || typeof data !== 'object') return null;

    // Log every message for debugging (can be removed once stable)
    console.log('[NOLA SMS] 📨 GHL postMessage received:', {
      message: data.message,
      type:    data.type,
      action:  data.action,
      keys:    Object.keys(data),
      companyId: data.companyId ?? data.company_id ?? '(none)',
    });

    // All known paths where GHL puts the agency-level company ID
    const candidates = [
      data.companyId,
      data.company_id,
      data.payload?.companyId,
      data.payload?.company_id,
      data.data?.companyId,
      data.data?.company_id,
    ];

    // Collect all location/subaccount IDs so we can exclude them
    const locationIds = new Set([
      data.locationId,
      data.location_id,
      data.payload?.locationId,
      data.payload?.location_id,
      data.data?.locationId,
      data.data?.location_id,
    ].filter(Boolean));

    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 4 && !locationIds.has(c)) {
        return c;
      }
    }
  } catch {
    // Not JSON / irrelevant message
  }
  return null;
}

/**
 * Extracts the agency-level company ID from the current URL.
 * GHL sometimes strips params, so this may return null when inside GHL iframe.
 */
function extractCompanyFromUrl(): string | null {
  const keys = ['companyId', 'company_id', 'agency_id', 'agencyId'];
  const search = window.location.search;
  const hash   = window.location.hash;

  const getParam = (query: string, key: string) =>
    new URLSearchParams(query).get(key);

  for (const k of keys) {
    const val = getParam(search, k);
    if (val && val.length > 4 && !val.includes('{{')) return val;
  }

  if (hash.includes('?')) {
    const hashQuery = hash.split('?')[1];
    for (const k of keys) {
      const val = getParam('?' + hashQuery, k);
      if (val && val.length > 4 && !val.includes('{{')) return val;
    }
  }

  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

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
    console.log(`[NOLA SMS] ✅ Agency Company ID resolved [${source}]: ${cid}`);
    safeStorage.setItem('nola_agency_id', cid);
    setState(prev =>
      prev.companyId === cid
        ? prev
        : { ...prev, companyId: cid, status: 'success' }
    );
  }, []);

  // ── Source 1: GHL postMessage (persistent — handles SSO + plain messages) ──
  useEffect(() => {
    if (!state.isGhlFrame) return;

    const handleMessage = async (event: MessageEvent) => {
      const raw = event.data;
      if (!raw || typeof raw !== 'object') return;

      // PATH A: Encrypted SSO handshake (USER_DATA_RESPONSE)
      // This is the most authoritative source — server decrypts the GHL JWT.
      if (raw.message === 'USER_DATA_RESPONSE' && raw.payload) {
        console.log('[NOLA SMS] 🔒 SSO payload received — decrypting...');
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
            console.warn('[NOLA SMS] ⚠️ SSO decrypt OK but no companyId in payload:', data);
          }
        } catch (err) {
          console.error('[NOLA SMS] SSO Decryption failed:', err);
        }
        return; // Handled — don't fall through to PATH B
      }

      // PATH B: Plain companyId from any GHL postMessage
      // GHL sometimes sends unencrypted messages with companyId.
      // The extractCompanyFromMessage helper excludes location/subaccount IDs.
      const cid = extractCompanyFromMessage(event);
      if (cid) {
        setState(prev => {
          if (prev.status === 'success') return prev; // SSO already won — don't overwrite
          finalize(cid, `PLAIN_MESSAGE:${raw.message ?? raw.type ?? 'unknown'}`);
          return prev;
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [state.isGhlFrame, finalize]);

  // ── Source 2: URL polling (mirrors LocationContext — handles URL changes) ──
  useEffect(() => {
    if (!state.isGhlFrame) return;

    let lastUrl = window.location.href;

    const checkUrl = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const fromUrl = extractCompanyFromUrl();
        if (fromUrl) finalize(fromUrl, 'URL_POLL');
      }
    };

    // Immediate check on mount
    const fromUrl = extractCompanyFromUrl();
    if (fromUrl) {
      finalize(fromUrl, 'URL_INIT');
    }

    const timer = setInterval(checkUrl, 1000);
    return () => clearInterval(timer);
  }, [state.isGhlFrame, finalize]);

  // ── One-shot init: fire REQUEST_USER_DATA + set timeout ─────────────────────
  useEffect(() => {
    if (!state.isGhlFrame || initDoneRef.current) return;
    initDoneRef.current = true;

    console.log('[NOLA SMS] 🔍 Iframe URL at mount:', {
      href:   window.location.href,
      search: window.location.search,
      hash:   window.location.hash,
    });

    // Request GHL SSO data — response handled by persistent listener above
    try {
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
      console.log('[NOLA SMS] 📤 Sent REQUEST_USER_DATA to GHL parent frame');
    } catch {
      console.warn('[NOLA SMS] Could not send REQUEST_USER_DATA — not in cross-origin iframe?');
    }

    // 10-second timeout — GHL can be slow to respond
    const fallbackTimer = setTimeout(() => {
      setState(s => {
        if (s.status !== 'success') {
          console.error('[NOLA SMS] ❌ Timeout: No company ID received after 10s. See postMessage logs above.');
          return { ...s, status: 'error' };
        }
        return s;
      });
    }, 10000);

    return () => clearTimeout(fallbackTimer);
  }, [state.isGhlFrame]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
