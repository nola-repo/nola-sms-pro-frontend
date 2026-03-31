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

// ── PATCH toggle ON/OFF for one subaccount ────────────────────────────────────
export const toggleSubaccount = async (agencyId, subaccountId, enabled) => {
  const res = await fetch(`${BASE}/toggle_subaccount.php`, {
    method: 'PATCH',
    headers: defaultHeaders(agencyId),
    body: JSON.stringify({ subaccount_id: subaccountId, enabled }),
  });
  return handleResponse(res); // { status, subaccount_id, toggle_enabled }
};

// ── PATCH rate limit for one subaccount ───────────────────────────────────────
export const setRateLimit = async (agencyId, subaccountId, rateLimit) => {
  const res = await fetch(`${BASE}/set_rate_limit.php`, {
    method: 'PATCH',
    headers: defaultHeaders(agencyId),
    body: JSON.stringify({ subaccount_id: subaccountId, rate_limit: rateLimit }),
  });
  return handleResponse(res); // { status, subaccount_id, rate_limit }
};

// ── POST reset attempt counter ────────────────────────────────────────────────
export const resetAttemptCount = async (agencyId, subaccountId) => {
  const res = await fetch(`${BASE}/reset_attempt_count.php`, {
    method: 'POST',
    headers: defaultHeaders(agencyId),
    body: JSON.stringify({ subaccount_id: subaccountId }),
  });
  return handleResponse(res); // { status, subaccount_id, attempt_count }
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
