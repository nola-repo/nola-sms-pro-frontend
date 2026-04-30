/**
 * Centralized API configuration for NOLA SMS Pro.
 * All API calls use same-origin relative paths.
 *   - Dev:  Vite dev server middleware proxies /api/* and /webhook/* to the backend.
 *   - Prod: nginx (in Docker/Cloud Run) proxies /api/* and /webhook/* to the backend.
 * This eliminates CORS entirely — the browser never makes a cross-origin request.
 */

// Use relative paths — nginx proxy at app.nolasmspro.com injects X-Webhook-Secret header.
// Direct absolute URLs bypass nginx and will cause 401 Unauthorized on all endpoints.
const API_BASE = "";

export const API_CONFIG = {
    // Primary API Base
    base: API_BASE,

    // Specific Endpoints
    sms: `${API_BASE}/api/sms`,
    credits: `${API_BASE}/api/credits`,
    contacts: `${API_BASE}/api/contacts`,         // local Firestore contacts (add/edit/delete)
    ghl_contacts: `${API_BASE}/api/ghl-contacts`,  // GHL live contacts proxy
    ghl_conversations: `${API_BASE}/api/ghl-conversations`, // GHL conversation creation
    messages: `${API_BASE}/api/messages`,
    conversations: `${API_BASE}/api/conversations`,
    bulk_campaigns: `${API_BASE}/api/bulk-campaigns`,
    sender_requests: `${API_BASE}/api/sender-requests`,
    account_sender: `${API_BASE}/api/account-sender`,
    account: `${API_BASE}/api/account`,
    templates: `${API_BASE}/api/templates`,
    check_message_status: `${API_BASE}/api/check_message_status`,
};

export default API_CONFIG;
