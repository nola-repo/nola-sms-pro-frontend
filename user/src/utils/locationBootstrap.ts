import { normalizeLocationCandidate } from './ghlLocationDetection';
import {
  getCurrentGhlContextLocationId,
  getLastGhlSessionRefreshFailure,
  getStoredAuthToken,
  refreshGhlSessionForLocation,
  storedSessionMatchesLocation,
} from './ghlSessionReauth';

export type LocationBootstrapNextAction =
  | 'load_app'
  | 'run_autologin'
  | 'complete_registration'
  | 'show_reconnect'
  | 'show_retry'
  | 'show_not_installed';

export interface LocationBootstrapResponse {
  location_id?: string;
  location_name?: string | null;
  location_detected?: boolean;
  session_status?: string;
  ownership_status?: string;
  registration_status?: string;
  token_status?: string;
  contacts_can_load?: boolean;
  requires_autologin?: boolean;
  requires_reconnect?: boolean;
  next_action?: LocationBootstrapNextAction | string;
  code?: string;
  message?: string;
  error?: string;
}

export type LocationBootstrapState =
  | { status: 'idle'; locationId?: string }
  | { status: 'checking'; locationId: string }
  | { status: 'ready'; locationId: string; response: LocationBootstrapResponse }
  | { status: 'action_required'; locationId: string; response: LocationBootstrapResponse }
  | { status: 'error'; locationId: string; message: string; response?: LocationBootstrapResponse };

const BOOTSTRAP_EVENT = 'nola-location-bootstrap-updated';
const bootstrapStateByLocation = new Map<string, LocationBootstrapState>();
const bootstrapInFlight = new Map<string, Promise<LocationBootstrapState>>();

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isValidGhlLocationId = (value: unknown): value is string => {
  const normalized = normalizeLocationCandidate(value);
  if (!normalized) return false;
  return /^[A-Za-z0-9_-]{12,80}$/.test(normalized);
};

const publishBootstrapState = (state: LocationBootstrapState): LocationBootstrapState => {
  if (state.locationId) {
    bootstrapStateByLocation.set(state.locationId, state);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BOOTSTRAP_EVENT, { detail: state }));
  }

  return state;
};

export const getCachedLocationBootstrapState = (locationId?: string): LocationBootstrapState => {
  const normalized = normalizeLocationCandidate(locationId);
  if (!normalized) return { status: 'idle' };
  return bootstrapStateByLocation.get(normalized) || { status: 'idle', locationId: normalized };
};

export const addLocationBootstrapListener = (listener: (state: LocationBootstrapState) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handle = (event: Event) => {
    listener((event as CustomEvent<LocationBootstrapState>).detail);
  };

  window.addEventListener(BOOTSTRAP_EVENT, handle);
  return () => window.removeEventListener(BOOTSTRAP_EVENT, handle);
};

const bootstrapAllowsProtectedData = (response: LocationBootstrapResponse): boolean =>
  response.contacts_can_load === true && response.next_action === 'load_app';

const bootstrapMessage = (response?: LocationBootstrapResponse): string => {
  if (!response) return 'Unable to verify this workspace right now.';
  return response.message || response.error || response.code || 'Unable to verify this workspace right now.';
};

const autologinFailureNextAction = (code?: string): LocationBootstrapNextAction | string => {
  if (code === 'DUPLICATE_LOCATION_USERS' || code === 'DUPLICATE_LOCATION_USER_IDENTITY') return 'show_admin_setup';
  if (code === 'LOCATION_USER_NOT_LINKED') return 'complete_registration';
  return 'show_retry';
};

const fetchLocationBootstrap = async (locationId: string): Promise<LocationBootstrapResponse> => {
  const params = new URLSearchParams({ location_id: locationId });
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-GHL-Location-ID': locationId,
    'X-Request-ID': createRequestId(),
  });
  const token = getStoredAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`/api/location/bootstrap?${params.toString()}`, {
    method: 'GET',
    headers,
  });
  const data = await response.json().catch(() => null) as LocationBootstrapResponse | null;

  if (!response.ok) {
    return {
      ...(data || {}),
      location_id: data?.location_id || locationId,
      contacts_can_load: false,
      next_action: data?.next_action || 'show_retry',
      message: data?.message || data?.error || response.statusText || 'Unable to verify this workspace right now.',
    };
  }

  return {
    ...(data || {}),
    location_id: data?.location_id || locationId,
  };
};

const runBootstrapFlow = async (
  locationId: string,
  options: { allowAutologin?: boolean } = {},
): Promise<LocationBootstrapState> => {
  publishBootstrapState({ status: 'checking', locationId });

  try {
    let response: LocationBootstrapResponse | null = null;

    if (
      options.allowAutologin !== false &&
      getStoredAuthToken() &&
      !storedSessionMatchesLocation(locationId)
    ) {
      const refreshed = await refreshGhlSessionForLocation(locationId);
      const failure = getLastGhlSessionRefreshFailure(locationId);
      if (!refreshed && failure?.code) {
        response = {
          location_id: locationId,
          contacts_can_load: false,
          requires_autologin: false,
          next_action: autologinFailureNextAction(failure.code),
          code: failure.code,
          message: failure.message || failure.error || 'Unable to refresh this workspace session.',
          error: failure.error || failure.message,
        };
      }
    }

    response = response || await fetchLocationBootstrap(locationId);

    if (
      options.allowAutologin !== false &&
      (response.next_action === 'run_autologin' || response.requires_autologin === true)
    ) {
      const refreshed = await refreshGhlSessionForLocation(locationId);
      if (refreshed) {
        response = await fetchLocationBootstrap(locationId);
      } else {
        const failure = getLastGhlSessionRefreshFailure(locationId);
        if (failure?.code) {
          response = {
            ...response,
            location_id: locationId,
            contacts_can_load: false,
            requires_autologin: false,
            next_action: autologinFailureNextAction(failure.code),
            code: failure.code,
            message: failure.message || failure.error || response.message,
            error: failure.error || failure.message || response.error,
          };
        }
      }
    }

    if (bootstrapAllowsProtectedData(response)) {
      return publishBootstrapState({ status: 'ready', locationId, response });
    }

    return publishBootstrapState({ status: 'action_required', locationId, response });
  } catch (error) {
    return publishBootstrapState({
      status: 'error',
      locationId,
      message: error instanceof Error ? error.message : 'Unable to verify this workspace right now.',
    });
  }
};

export const resolveLocationBootstrap = async (
  locationId: string,
  options: { force?: boolean; allowAutologin?: boolean } = {},
): Promise<LocationBootstrapState> => {
  const normalized = normalizeLocationCandidate(locationId);
  if (!normalized || !isValidGhlLocationId(normalized)) {
    return publishBootstrapState({
      status: 'error',
      locationId: normalized || '',
      message: 'Invalid GHL location id.',
      response: {
        location_id: normalized || '',
        contacts_can_load: false,
        next_action: 'show_retry',
        code: 'INVALID_GHL_LOCATION_ID',
      },
    });
  }

  const cached = bootstrapStateByLocation.get(normalized);
  if (!options.force && cached?.status === 'ready') return cached;

  const existing = bootstrapInFlight.get(normalized);
  if (existing && !options.force) return existing;

  const promise = runBootstrapFlow(normalized, options).finally(() => {
    bootstrapInFlight.delete(normalized);
  });

  bootstrapInFlight.set(normalized, promise);
  return promise;
};

export const ensureLocationBootstrapAllowsProtectedData = async (
  locationId = getCurrentGhlContextLocationId(),
  options: { force?: boolean; allowAutologin?: boolean } = {},
): Promise<boolean> => {
  const normalized = normalizeLocationCandidate(locationId);
  if (!normalized) return true;

  const state = await resolveLocationBootstrap(normalized, options);
  return state.status === 'ready';
};

export const createBootstrapBlockedResponse = (state: LocationBootstrapState): Response => {
  const response = state.status === 'ready' ? state.response : 'response' in state ? state.response : undefined;
  return new Response(
    JSON.stringify({
      error: bootstrapMessage(response),
      code: response?.code || 'LOCATION_BOOTSTRAP_REQUIRED',
      next_action: response?.next_action || 'show_retry',
      requires_reconnect: response?.requires_reconnect === true,
      requires_reauth: response?.requires_autologin === true,
      contacts_can_load: false,
    }),
    { status: response?.requires_reconnect ? 409 : 423, headers: { 'Content-Type': 'application/json' } }
  );
};
