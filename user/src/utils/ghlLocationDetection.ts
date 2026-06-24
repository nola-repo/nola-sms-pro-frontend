export type LocationSource =
  | 'url'
  | 'hash'
  | 'postMessage'
  | 'storage'
  | 'manual'
  | 'unknown';

export interface LocationDetectionResult {
  locationId: string;
  source: LocationSource;
  path: string;
}

const EXPLICIT_LOCATION_ID_KEYS = [
  'location_id',
  'locationId',
  'ghl_location_id',
  'ghlLocationId',
  'active_location_id',
  'activeLocationId',
] as const;

const EXPLICIT_LOCATION_OBJECT_KEYS = [
  'location',
  'activeLocation',
  'selectedLocation',
] as const;

const SAFE_POST_MESSAGE_CONTAINERS = [
  'payload',
  'data',
  'context',
  'detail',
] as const;

export function normalizeLocationCandidate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const candidate = String(value).trim();
  if (!candidate || candidate.length <= 4) return null;
  if (candidate === 'null' || candidate === 'undefined') return null;
  return candidate;
}

export function detectLocationFromRecord(
  source: unknown,
  sourceName: LocationSource = 'unknown',
  path: string = sourceName,
): LocationDetectionResult | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;

  for (const key of EXPLICIT_LOCATION_ID_KEYS) {
    const candidate = normalizeLocationCandidate(record[key]);
    if (candidate) return { locationId: candidate, source: sourceName, path: `${path}.${key}` };
  }

  for (const key of EXPLICIT_LOCATION_OBJECT_KEYS) {
    const nested = record[key];
    if (!nested || typeof nested !== 'object') continue;
    const nestedRecord = nested as Record<string, unknown>;

    for (const nestedKey of EXPLICIT_LOCATION_ID_KEYS) {
      const candidate = normalizeLocationCandidate(nestedRecord[nestedKey]);
      if (candidate) {
        return { locationId: candidate, source: sourceName, path: `${path}.${key}.${nestedKey}` };
      }
    }

    const idCandidate = normalizeLocationCandidate(nestedRecord.id);
    if (idCandidate) return { locationId: idCandidate, source: sourceName, path: `${path}.${key}.id` };
  }

  return null;
}

const detectLocationFromParams = (
  query: string,
  source: LocationSource,
): LocationDetectionResult | null => {
  const params = new URLSearchParams(query);

  for (const key of EXPLICIT_LOCATION_ID_KEYS) {
    const candidate = normalizeLocationCandidate(params.get(key));
    if (candidate) return { locationId: candidate, source, path: `${source}.${key}` };
  }

  return null;
};

export function detectLocationFromCurrentUrl(): LocationDetectionResult | null {
  if (typeof window === 'undefined') return null;

  const fromSearch = detectLocationFromParams(window.location.search, 'url');
  if (fromSearch) return fromSearch;

  const hash = window.location.hash || '';
  const hashQuery = hash.includes('?')
    ? hash.slice(hash.indexOf('?') + 1)
    : hash.replace(/^#/, '');

  if (!hashQuery.includes('=')) return null;
  return detectLocationFromParams(`?${hashQuery}`, 'hash');
}

export function isAllowedGhlPostMessageOrigin(event: MessageEvent): boolean {
  if (event.origin === window.location.origin) return true;

  let host = '';
  try {
    host = new URL(event.origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (import.meta.env.DEV && (host === 'localhost' || host === '127.0.0.1')) {
    return true;
  }

  return [
    'gohighlevel.com',
    'leadconnectorhq.com',
    'leadconnector.com',
    'msgsndr.com',
  ].some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
}

export function detectLocationFromPostMessage(event: MessageEvent): LocationDetectionResult | null {
  if (!isAllowedGhlPostMessageOrigin(event)) return null;

  let data: unknown = event.data;

  if (typeof data === 'string') {
    const rawMessage = data.trim();
    if (!rawMessage) return null;

    try {
      data = JSON.parse(rawMessage);
    } catch {
      if (!rawMessage.includes('location')) return null;
      const query = rawMessage.includes('?') ? rawMessage.slice(rawMessage.indexOf('?') + 1) : rawMessage;
      return detectLocationFromParams(`?${query}`, 'postMessage');
    }
  }

  const queue: Array<{ value: unknown; path: string }> = [{ value: data, path: 'postMessage' }];
  const visited = new Set<unknown>();

  for (let index = 0; index < queue.length && index < 20; index += 1) {
    const item = queue[index];
    if (!item.value || typeof item.value !== 'object' || visited.has(item.value)) continue;
    visited.add(item.value);

    const direct = detectLocationFromRecord(item.value, 'postMessage', item.path);
    if (direct) return direct;

    const record = item.value as Record<string, unknown>;
    for (const key of SAFE_POST_MESSAGE_CONTAINERS) {
      const nested = record[key];
      if (nested && typeof nested === 'object') queue.push({ value: nested, path: `${item.path}.${key}` });
    }

    for (const key of ['locationIds', 'locations'] as const) {
      const values = record[key];
      if (!Array.isArray(values)) continue;

      for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
        const value = values[valueIndex];
        if (value && typeof value === 'object') {
          queue.push({ value, path: `${item.path}.${key}[${valueIndex}]` });
        }
      }
    }
  }

  return null;
}
