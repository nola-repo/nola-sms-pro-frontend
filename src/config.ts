/**
 * Centralized API configuration for NOLA SMS Pro.
 * All API calls use same-origin relative paths.
 *   - Dev:  Vite dev server middleware proxies /api/* and /webhook/* to the backend.
 *   - Prod: nginx (in Docker/Cloud Run) proxies /api/* and /webhook/* to the backend.
 * This eliminates CORS entirely — the browser never makes a cross-origin request.
 */

// Always use relative paths so nginx/Vite can proxy server-side
const API_BASE = "";

export const API_CONFIG = {
    // Primary API Base
    base: API_BASE,

    // Specific Endpoints
    sms: `${API_BASE}/api/sms`,
    credits: `${API_BASE}/api/credits`,
    contacts: `${API_BASE}/api/contacts`,
    messages: `${API_BASE}/api/messages`,
    conversations: `${API_BASE}/api/messages?action=fetch_conversations`,
    bulk_campaigns: `${API_BASE}/api/messages?action=fetch_bulk_messages`,
};

export default API_CONFIG;
