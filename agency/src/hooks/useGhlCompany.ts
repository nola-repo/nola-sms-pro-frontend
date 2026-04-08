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
 * 1. Solicits GHL parent iframe for USER_DATA_RESPONSE (secure SSO)
 * 2. Decrypts it via backend /api/agency/ghl_sso_decrypt
 *    OR falls back to URL parameters if iframe doesn't respond.
 * 3. Triggers auto-login to return JWT session variables
 */
export function useGhlCompany(): GhlCompanyState {
  const calledRef = useRef(false);

  const [state, setState] = useState<GhlCompanyState>({
    companyId:       null,
    isGhlFrame:      false, // Assume false until proven true
    autoLoginStatus: 'idle',
    autoLoginError:  null,
  });

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    // Detect URL params as a potential fallback
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams   = window.location.hash.includes('?') ? new URLSearchParams(window.location.hash.split('?')[1]) : null;
    let urlCompanyId = searchParams.get('companyId') || hashParams?.get('companyId') || null;
    if (urlCompanyId && urlCompanyId.includes('{{')) urlCompanyId = null;

    let messageReceived = false;

    // We assume we are loading in an iframe. If neither postMessage nor URL yields anything by 1.5s, 
    // it's a standalone manual login.
    setState(s => ({ ...s, autoLoginStatus: 'loading' }));

    const handleAutoLogin = (cid: string) => {
      safeStorage.setItem('nola_agency_id', cid);
      
      const existingToken = safeStorage.getItem(SESSION_KEYS.token);
      const existingRole  = safeStorage.getItem(SESSION_KEYS.role);
      
      // If token already valid, skip auto-login
      if (existingToken && existingRole === 'agency') {
        setState(s => ({ ...s, companyId: cid, autoLoginStatus: 'success', isGhlFrame: true }));
        return;
      }

      fetch('/api/agency/ghl_autologin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_id: cid }),
      })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.token) throw new Error(data.error ?? 'Auto-login failed');
        safeStorage.setItem(SESSION_KEYS.token, data.token);
        safeStorage.setItem(SESSION_KEYS.role, 'agency');
        if (data.user) safeStorage.setItem(SESSION_KEYS.user, JSON.stringify(data.user));
        if (data.company_id) safeStorage.setItem(SESSION_KEYS.companyId, data.company_id);
        
        setState(s => ({ ...s, companyId: cid, autoLoginStatus: 'success', isGhlFrame: true }));
      })
      .catch((err: Error) => {
        // Fallback: If auto-login fails (e.g. unlinked company), escape GHL mode and show manual login
        setState(s => ({ ...s, companyId: cid, autoLoginStatus: 'error', autoLoginError: err.message, isGhlFrame: false }));
      });
    };

    const handleGhlMessage = (event: MessageEvent) => {
      // Look for the targeted GHL handshake
      if (event.data?.message === 'USER_DATA_RESPONSE' && event.data?.payload) {
        messageReceived = true;
        
        // Decrypt the payload
        fetch('/api/agency/ghl_sso_decrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedPayload: event.data.payload }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.companyId) {
              handleAutoLogin(data.companyId);
            } else {
              throw new Error(data.error ?? "Invalid decrypted payload");
            }
          })
          .catch(err => {
            // Decryption failure: escape GHL mode -> manual login
            setState(s => ({ ...s, autoLoginStatus: 'error', autoLoginError: "Decryption failed: " + err.message, isGhlFrame: false }));
          });
      }
    };

    window.addEventListener('message', handleGhlMessage);

    // Request data from GHL parent frame
    try {
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
    } catch {
      // Cannot post message
    }

    // Handshake Timeout: If no postMessage response after 1500ms, use URL or fallback to manual login
    const fallbackTimer = setTimeout(() => {
      if (!messageReceived) {
        if (urlCompanyId) {
          handleAutoLogin(urlCompanyId);
        } else {
          // No handshake, no URL param -> standalone app -> default manual login
          setState(s => ({ ...s, companyId: null, autoLoginStatus: 'idle', isGhlFrame: false }));
        }
      }
    }, 1500);

    return () => {
      window.removeEventListener('message', handleGhlMessage);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return state;
}
