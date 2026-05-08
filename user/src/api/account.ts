import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";

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
}

function getLocationHeaders(explicitLocationId?: string): { headers: Record<string, string>; locationId: string } {
    const { ghlLocationId } = getAccountSettings();
    const locationId = explicitLocationId || ghlLocationId;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (locationId) {
        headers["X-GHL-Location-ID"] = locationId;
    }
    return { headers, locationId };
}

/**
 * Fetch the basic account profile (including location_name).
 */
export const fetchAccountProfile = async (explicitLocationId?: string): Promise<AccountProfile | null> => {
    const { headers, locationId } = getLocationHeaders(explicitLocationId);

    if (!locationId) return null;

    let url = API_CONFIG.account;
    url += `?location_id=${encodeURIComponent(locationId)}`;

    try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
            console.error("[fetchAccountProfile] Error:", res.status);
            return null;
        }
        const data = await res.json();
        return data.data || null;
    } catch (error) {
        console.error("[fetchAccountProfile] Network error:", error);
        return null;
    }
};
