import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";
import { getAuthHeaders } from "../utils/authHeaders";
import { safeStorage } from "../utils/safeStorage";

export interface AccountProfile {
    location_id: string;
    location_name: string | null;
    full_name?: string | null;
    email?: string | null;
    email_address?: string | null;
    phone?: string | null;
    phone_number?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    registration_status?: "registered" | "unregistered" | "not_installed" | string;
    is_registered?: boolean;
}

interface FetchAccountProfileOptions {
    includeAuth?: boolean;
    forceRefresh?: boolean;
    cacheTtlMs?: number;
    allowStaleOnError?: boolean;
}

interface CachedAccountProfile {
    profile: AccountProfile;
    cachedAt: number;
}

const ACCOUNT_PROFILE_CACHE_PREFIX = "nola_account_profile_";
const DEFAULT_ACCOUNT_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const accountProfileCache = new Map<string, CachedAccountProfile>();
const accountProfileRequests = new Map<string, Promise<AccountProfile | null>>();

function resolveLocationId(explicitLocationId?: string): string {
    const { ghlLocationId } = getAccountSettings();
    return explicitLocationId || ghlLocationId;
}

function cacheIdFor(locationId: string, includeAuth: boolean): string {
    return `${includeAuth ? "auth" : "public"}:${locationId}`;
}

function storageKeyFor(cacheId: string): string {
    return `${ACCOUNT_PROFILE_CACHE_PREFIX}${encodeURIComponent(cacheId)}`;
}

function readCacheEntry(
    locationId: string,
    includeAuth: boolean,
    maxAgeMs = DEFAULT_ACCOUNT_PROFILE_CACHE_TTL_MS,
    allowExpired = false
): CachedAccountProfile | null {
    const cacheId = cacheIdFor(locationId, includeAuth);
    const now = Date.now();

    const fromMemory = accountProfileCache.get(cacheId);
    if (fromMemory && (allowExpired || now - fromMemory.cachedAt <= maxAgeMs)) {
        return fromMemory;
    }

    try {
        const raw = safeStorage.getItem(storageKeyFor(cacheId));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as CachedAccountProfile;
        if (!parsed?.profile || !parsed.cachedAt) return null;

        accountProfileCache.set(cacheId, parsed);
        if (allowExpired || now - parsed.cachedAt <= maxAgeMs) {
            return parsed;
        }
    } catch {
        return null;
    }

    return null;
}

function writeCacheEntry(locationId: string, includeAuth: boolean, profile: AccountProfile): void {
    const cacheId = cacheIdFor(locationId, includeAuth);
    const entry: CachedAccountProfile = {
        profile,
        cachedAt: Date.now(),
    };

    accountProfileCache.set(cacheId, entry);
    try {
        safeStorage.setItem(storageKeyFor(cacheId), JSON.stringify(entry));
    } catch {
        // Cache writes are best-effort only.
    }
}

export const getCachedAccountProfile = (
    explicitLocationId?: string,
    options: Pick<FetchAccountProfileOptions, "includeAuth" | "cacheTtlMs"> & { allowExpired?: boolean } = {}
): AccountProfile | null => {
    const includeAuth = options.includeAuth ?? true;
    const locationId = resolveLocationId(explicitLocationId);
    if (!locationId) return null;

    return readCacheEntry(locationId, includeAuth, options.cacheTtlMs, options.allowExpired)?.profile ?? null;
};

function getLocationHeaders(explicitLocationId?: string, includeAuth = true): { headers: Record<string, string>; locationId: string } {
    const locationId = resolveLocationId(explicitLocationId);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (locationId) {
        headers["X-GHL-Location-ID"] = locationId;
    }
    if (includeAuth) {
        Object.assign(headers, getAuthHeaders());
    }
    return { headers, locationId };
}

/**
 * Fetch the basic account profile (including location_name).
 */
export const fetchAccountProfile = async (
    explicitLocationId?: string,
    options: FetchAccountProfileOptions = {}
): Promise<AccountProfile | null> => {
    const includeAuth = options.includeAuth ?? true;
    const { headers, locationId } = getLocationHeaders(explicitLocationId, includeAuth);

    if (!locationId) return null;

    const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_ACCOUNT_PROFILE_CACHE_TTL_MS;
    const requestCacheId = cacheIdFor(locationId, includeAuth);
    const cached = readCacheEntry(locationId, includeAuth, cacheTtlMs);
    if (cached && !options.forceRefresh) {
        return cached.profile;
    }

    const existingRequest = accountProfileRequests.get(requestCacheId);
    if (existingRequest && !options.forceRefresh) {
        return existingRequest;
    }

    let url = API_CONFIG.account;
    url += `?location_id=${encodeURIComponent(locationId)}`;

    const request = (async () => {
        const res = await fetch(url, { headers });
        if (!res.ok) {
            console.error("[fetchAccountProfile] Error:", res.status);
            if (options.allowStaleOnError) {
                return readCacheEntry(locationId, includeAuth, cacheTtlMs, true)?.profile ?? null;
            }
            return null;
        }
        const data = await res.json();
        const profile = data.data || null;
        if (profile) {
            writeCacheEntry(locationId, includeAuth, profile);
        }
        return profile;
    })()
        .catch((error) => {
            console.error("[fetchAccountProfile] Network error:", error);
            if (options.allowStaleOnError) {
                return readCacheEntry(locationId, includeAuth, cacheTtlMs, true)?.profile ?? null;
            }
            return null;
        })
        .finally(() => {
            if (accountProfileRequests.get(requestCacheId) === request) {
                accountProfileRequests.delete(requestCacheId);
            }
        });

    accountProfileRequests.set(requestCacheId, request);
    return request;
};
