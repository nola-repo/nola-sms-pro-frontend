/**
 * Centralized API configuration for NOLA SMS Pro.
 * Handles auto-switching between Vite proxy (dev) and direct backend URL (prod).
 */

const isDev = import.meta.env.DEV;

// In Dev, we use relative paths to trigger Vite dev server proxy middleware
// In Prod, we use the absolute Cloud Run URL (VITE_API_BASE)
const API_BASE = isDev ? "" : import.meta.env.VITE_API_BASE;

export const API_CONFIG = {
    // Primary API Base
    base: API_BASE,

    // Specific Endpoints
    sms: `${API_BASE}/webhook/send_sms`,
    credits: `${API_BASE}/api/credits`,
    contacts: `${API_BASE}/api/ghl-contacts`,
    messages: `${API_BASE}/api/messages`,
    conversations: `${API_BASE}/api/conversations`,
};

export default API_CONFIG;
