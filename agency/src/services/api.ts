/**
 * Agency Panel — API Service
 * All fetch calls to the PHP backend go through this module.
 * The nginx proxy forwards /api/* → https://smspro-api.nolacrm.io/api/*
 */

const BASE = '/api/agency';

const defaultHeaders = (agencyId, extra = {}) => ({
  'Content-Type': 'application/json',
  'X-Agency-ID': agencyId || '',
  'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
  ...extra,
});

class APIError extends Error {
  status?: number;
}

const handleResponse = async (res: Response) => {
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { status: 'error', message: text }; }
  if (!res.ok) {
    const error = new APIError(json?.message || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return json;
};

// ── GET all subaccounts for this agency ────────────────────────────────────────
export const getSubaccounts = async (agencyId) => {
  const res = await fetch(`${BASE}/get_subaccounts.php`, {
    method: 'GET',
    headers: defaultHeaders(agencyId),
  });
  return handleResponse(res); // { status, subaccounts: [] }
};

// ── POST toggle a single subaccount ON/OFF ────────────────────────────────────
// Calls update_subaccount.php which writes toggle_enabled to ghl_tokens.
export const toggleSubaccount = async (agencyId: string, payload: {
  subaccount_id: string;
  enabled: boolean;
}) => {
  const res = await fetch(`${BASE}/update_subaccount.php`, {
    method: 'POST',
    headers: defaultHeaders(agencyId),
    body: JSON.stringify({
      location_id: payload.subaccount_id,
      toggle_enabled: payload.enabled
    }),
  });

  // Check for a 403 limit_reached before the generic response handler.
  // NOTE: res.json() consumes the body, so we clone first to leave res intact
  // for handleResponse. The throw must be OUTSIDE the try/catch to avoid being
  // swallowed by the catch that only intends to handle JSON parse failures.
  if (res.status === 403) {
    let limitReached = false;
    try {
      const data = await res.clone().json();
      limitReached = data?.status === 'limit_reached';
    } catch {
      // JSON parse failed — fall through to generic handleResponse error
    }
    if (limitReached) {
      const err = new APIError('Activation limit reached. Please contact support to re-enable this subaccount.');
      err.status = 403;
      throw err;
    }
  }

  return handleResponse(res);
};

// ── POST update subaccount settings ──────────────────────────────────────────
export const updateSubaccountSettings = async (agencyId, payload: {
  location_id: string;
  toggle_enabled: boolean;
  rate_limit: number;
  reset_counter: boolean;
}) => {
  const res = await fetch(`${BASE}/update_subaccount.php`, {
    method: 'POST',
    headers: defaultHeaders(agencyId),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

// ── GET all toggle-ON subaccounts (used by main admin panel) ──────────────────
export const getAllActiveSubaccounts = async () => {
  const res = await fetch(`${BASE}/get_all_active.php`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
    },
  });
  return handleResponse(res); // { status, active_subaccounts: [] }
};

// ── GET which locations have the NOLA SMS Pro user app installed ───────────────
// Returns string[] of locationIds with a valid ghl_token in the backend.
// Used to gate the enable/disable toggle per sub-account.
export const checkInstallStatus = async (agencyId: string): Promise<string[]> => {
  const res = await fetch(`${BASE}/check_installs.php?company_id=${encodeURIComponent(agencyId)}`, {
    method: 'GET',
    headers: defaultHeaders(agencyId),
  });
  const data = await handleResponse(res); // { installed_locations: string[] }
  return data.installed_locations ?? [];
};

