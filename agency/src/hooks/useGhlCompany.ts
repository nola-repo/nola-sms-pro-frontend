import { safeStorage } from '../utils/safeStorage';

/**
 * useGhlCompany
 * Detects if the agency app is running inside an iframe (any GHL context).
 * Bypasses login entirely when embedded — same pattern as the user app.
 *
 * Company ID is read from URL params when available, or falls back to
 * safeStorage from a previous session.
 */
export function useGhlCompany(): { companyId: string | null; isGhlFrame: boolean } {
  // Primary: detect if we're running inside an iframe at all
  let isGhlFrame = false;
  try {
    isGhlFrame = window.self !== window.top;
  } catch {
    // Cross-origin check threw — we're definitely in an iframe
    isGhlFrame = true;
  }

  // Try to read companyId from URL params
  const companyKeys = ['companyId', 'company_id', 'agency_id', 'agencyId'];
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams   = window.location.hash.includes('?')
    ? new URLSearchParams(window.location.hash.split('?')[1])
    : null;

  let companyId: string | null = null;
  for (const key of companyKeys) {
    const vals = [
      ...(searchParams.getAll(key) || []),
      ...(hashParams?.getAll(key) || [])
    ];
    
    for (const val of vals) {
      if (val && val.trim() !== '' && !val.includes('{{')) {
        companyId = val;
        break;
      }
    }
    if (companyId) break;
  }

  // Fallback to stored company id from previous session
  if (!companyId) {
    companyId = safeStorage.getItem('nola_agency_id');
  }

  if (isGhlFrame) {
    if (companyId) {
      console.log(`NOLA SMS: Detected GHL Company: ${companyId}`);
      safeStorage.setItem('nola_agency_id', companyId);
    } else {
      console.log('NOLA SMS: GHL iframe detected — no companyId in URL, loading dashboard anyway');
    }
  }

  return { companyId, isGhlFrame };
}
