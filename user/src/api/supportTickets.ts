import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";
import type { SupportTicket } from "../types/SupportTicket";

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
 * Fetch all support tickets for the current location.
 */
export const fetchSupportTickets = async (explicitLocationId?: string): Promise<SupportTicket[]> => {
    const { headers, locationId } = getLocationHeaders(explicitLocationId);

    let url = API_CONFIG.support_tickets;
    if (locationId) {
        url += `?location_id=${encodeURIComponent(locationId)}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
        console.error("[fetchSupportTickets] Error:", res.status);
        return [];
    }

    return res.json();
};

/**
 * Submit a new support ticket to Firestore via the backend.
 */
export const submitSupportTicket = async (
    subject: string,
    message: string,
    priority: string = 'normal'
): Promise<any> => {
    const { headers, locationId } = getLocationHeaders();

    const res = await fetch(API_CONFIG.support_tickets, {
        method: "POST",
        headers,
        body: JSON.stringify({
            location_id: locationId,
            subject,
            message,
            priority,
        }),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to submit support ticket: ${res.status} - ${errorText}`);
    }

    return res.json();
};
