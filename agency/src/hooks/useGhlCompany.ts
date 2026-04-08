/**
 * useGhlCompany
 * Detects a GHL company context from the iframe URL params.
 * No backend call — companyId from URL is the implicit auth, same pattern as the user app.
 *
 * GHL injects companyId via URL when the marketplace app loads:
 *   https://agency.nolasmspro.com/?companyId=ABC123
 */
export function useGhlCompany(): { companyId: string | null; isGhlFrame: boolean } {
  const companyKeys = [
    'companyId', 'company_id', 'agency_id', 'agencyId',
  ];

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams   = window.location.hash.includes('?')
    ? new URLSearchParams(window.location.hash.split('?')[1])
    : null;

  const getParam = (key: string) =>
    searchParams.get(key) || hashParams?.get(key) || null;

  let companyId: string | null = null;
  for (const key of companyKeys) {
    const val = getParam(key);
    // Skip GHL template placeholders that weren't replaced
    if (val && val.trim() !== '' && !val.includes('{{')) {
      companyId = val;
      break;
    }
  }

  return {
    companyId,
    isGhlFrame: !!companyId,
  };
}
