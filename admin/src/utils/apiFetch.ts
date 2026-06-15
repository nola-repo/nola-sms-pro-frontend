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

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: withRequestId(init.headers),
  });
}
