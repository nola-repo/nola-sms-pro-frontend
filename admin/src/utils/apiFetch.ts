export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function withRequestId(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);

  if (!merged.has('X-Request-ID')) {
    merged.set('X-Request-ID', createRequestId());
  }

  return merged;
}

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE = (viteEnv?.VITE_API_BASE || '').replace(/\/$/, '');
const USE_DIRECT_API_BASE = viteEnv?.VITE_ADMIN_USE_DIRECT_API === 'true';

const resolveApiInput = (input: RequestInfo | URL): RequestInfo | URL => {
  if (typeof input !== 'string') return input;
  if (!input.startsWith('/api/')) return input;
  if (!USE_DIRECT_API_BASE || !API_BASE) return input;
  return `${API_BASE}${input}`;
};

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(resolveApiInput(input), {
    ...init,
    headers: withRequestId(init.headers),
  });
}
