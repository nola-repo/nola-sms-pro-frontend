import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";
import { apiFetch } from "../utils/apiFetch";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface SenderRequest {
    id: string;
    location_id: string;
    requested_id: string;
    status: "pending" | "approved" | "rejected" | "revoked";
    purpose?: string;
    sample_message?: string;
    admin_notes?: string;
    provider?: SenderProvider;
    provider_preference?: ProviderPreference;
    unisms_sender_id?: string;
    created_at: string;
}

export type SenderProvider = "system" | "semaphore" | "unisms";
export type ProviderPreference = "system" | "semaphore" | "semaphore_custom" | "unisms" | "unisms_custom";

export interface AccountSenderConfig {
    sender_id?: string | null;
    verified?: boolean;
    approved_sender_id: string | null;
    nola_pro_api_key: null;
    nola_pro_api_key_masked?: string | null;
    nola_pro_api_key_configured?: boolean;
    semaphore_api_key: null;
    semaphore_api_key_masked?: string | null;
    semaphore_api_key_configured?: boolean;
    unisms_api_key: null;
    unisms_api_key_masked?: string | null;
    unisms_api_key_configured?: boolean;
    unisms_sender_id?: string | null;
    provider_preference?: ProviderPreference;
    free_usage_count: number;
    free_credits_total?: number;
    system_default_sender: string;
    toggle_enabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getLocationHeaders(explicitLocationId?: string): { headers: Record<string, string>; locationId: string } {
    const { ghlLocationId } = getAccountSettings();
    const locationId = explicitLocationId || ghlLocationId || '';
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (locationId) {
        headers["X-GHL-Location-ID"] = locationId;
    }
    return { headers, locationId };
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Submit a new Sender ID request to Firestore via the backend.
 */
export const submitSenderRequest = async (
    requestedId: string,
    purpose: string,
    sampleMessage: string,
    provider: SenderProvider = "unisms"
): Promise<SenderRequest> => {
    const { headers, locationId } = getLocationHeaders();
    const normalizedId = requestedId.trim().toUpperCase();

    const res = await apiFetch(API_CONFIG.sender_requests, {
        method: "POST",
        headers,
        body: JSON.stringify({
            location_id: locationId,
            requested_id: normalizedId,
            provider,
            purpose: purpose.trim(),
            sample_message: sampleMessage.trim(),
        }),
    });

    if (!res.ok) {
        const errorText = await res.text();
        let message = "Failed to submit sender request. Please try again.";
        try {
            const parsed = JSON.parse(errorText);
            message = parsed.message || parsed.error || message;
        } catch {
            message = errorText || message;
        }
        throw new Error(message);
    }

    return res.json();
};

/**
 * Fetch all sender ID requests for the current location.
 */
export const fetchSenderRequests = async (explicitLocationId?: string): Promise<SenderRequest[]> => {
    const { headers, locationId } = getLocationHeaders(explicitLocationId);

    let url = API_CONFIG.sender_requests;
    if (locationId) {
        url += `?location_id=${encodeURIComponent(locationId)}`;
    }

    const res = await apiFetch(url, { headers });
    if (!res.ok) {
        console.error("[fetchSenderRequests] Error:", res.status);
        return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : (data.data || []);
};

export const cancelSenderRequest = async (requestId: string, explicitLocationId?: string): Promise<boolean> => {
    const { headers, locationId } = getLocationHeaders(explicitLocationId);

    let url = API_CONFIG.sender_requests;
    if (locationId) {
        url += `?location_id=${encodeURIComponent(locationId)}`;
    }

    const res = await apiFetch(url, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ request_id: requestId }),
    });

    if (!res.ok) {
        const errorText = await res.text();
        let message = "Failed to cancel sender request.";
        try {
            const parsed = JSON.parse(errorText);
            message = parsed.message || parsed.error || message;
        } catch {
            message = errorText || message;
        }
        throw new Error(message);
    }

    return true;
};

/**
 * Fetch the account's sender configuration (approved sender, API key, free usage).
 */
export const fetchAccountSenderConfig = async (explicitLocationId?: string): Promise<AccountSenderConfig> => {
    const { headers, locationId } = getLocationHeaders(explicitLocationId);

    const DEFAULT_CONFIG: AccountSenderConfig = {
        approved_sender_id: null,
        nola_pro_api_key: null,
        semaphore_api_key: null,
        unisms_api_key: null,
        provider_preference: "system",
        free_usage_count: 0,
        free_credits_total: 10,
        system_default_sender: "NOLASMSPro",
        toggle_enabled: true,
    };

    let url = API_CONFIG.account_sender;
    if (locationId) {
        url += `?location_id=${encodeURIComponent(locationId)}`;
    }

    try {
        const res = await apiFetch(url, { headers });
        if (!res.ok) {
            console.error("[fetchAccountSenderConfig] Error:", res.status);
            return DEFAULT_CONFIG;
        }
        const raw = await res.json();
        const inner = raw.data || raw;
        const config: AccountSenderConfig = { ...DEFAULT_CONFIG, ...inner };

        if (config.approved_sender_id) {
            const requests = await fetchSenderRequests(locationId);
            const approvedId = config.approved_sender_id.trim().toLowerCase();
            const stillApproved = requests.some(req =>
                req.status === "approved" &&
                req.requested_id.trim().toLowerCase() === approvedId
            );

            if (!stillApproved) {
            return {
                    ...config,
                    approved_sender_id: null,
                    nola_pro_api_key: null,
                    semaphore_api_key: null,
                    unisms_api_key: null,
                };
            }
        }

        return config;
    } catch (error) {
        console.error("[fetchAccountSenderConfig] Network error:", error);
        return DEFAULT_CONFIG;
    }
};

/**
 * Save/update the user's Semaphore API key.
 */
export const saveAccountApiKey = async (apiKey: string, provider: "semaphore" | "unisms" = "semaphore"): Promise<boolean> => {
    const { headers, locationId } = getLocationHeaders();

    try {
        const providerPayload = provider === "unisms"
            ? {
                provider_preference: "unisms_custom",
                provider: "unisms",
                unisms_api_key: apiKey,
            }
            : {
                provider_preference: "semaphore_custom",
                provider: "semaphore",
                semaphore_api_key: apiKey,
                nola_pro_api_key: apiKey,
            };

        const res = await apiFetch(API_CONFIG.account_sender, {
            method: "POST",
            headers,
            body: JSON.stringify({
                location_id: locationId,
                ...providerPayload,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to save API key: ${res.status} - ${errorText}`);
        }
        return true;
    } catch (error) {
        console.error("[saveAccountApiKey] Error:", error);
        return false;
    }
};
