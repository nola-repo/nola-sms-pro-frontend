# Backend Handoff: Agency Portal Architecture

This document specifies the exact API routes, schemas, and logic the backend team needs to implement in order to fully hook up the new NOLA SMS Pro Agency Frontend.

## 1. Authentication & Security
The agency portal operates via two custom headers passed on every fetch request:
- `X-Webhook-Secret`: Must exactly match `f7RkQ2pL9zV3tX8cB1nS4yW6`. Reject with `401 Unauthorized` if invalid.
- `X-Agency-ID`: The unique identifier for the agency. Endpoints returning/modifying subaccounts **MUST** ensure the subaccount belongs to this `X-Agency-ID`.

## 2. Database Schema (Firestore)
A new collection `agency_subaccounts` must be utilized.
**Document Structure:**
- `location_id` (string)
- `location_name` (string)
- `agency_id` (string)
- `agency_name` (string) - New requirement from frontend to be displayed in the Subaccounts table.
- `toggle_enabled` (boolean)
- `rate_limit` (number)
- `attempt_count` (number)

## 3. Required Endpoints (Root: `/api/agency/*`)

### `GET /api/agency/get_subaccounts.php`
- **Behavior**: Return all subaccounts where `agency_id == {X-Agency-ID}`.
- **Data enhancement**: Ensure the returned object for each subaccount includes the string `agency_name` (or `company_name`) representing the parent agency name.
- **Success Return**: `{"status": "success", "subaccounts": [{"location_id": "...", "agency_name": "My Agency", ...}]}`

### `PATCH /api/agency/toggle_subaccount.php`
- **Payload**: `{"location_id": "LOC_ID", "enabled": true/false}`
- **Behavior**: Validate `X-Agency-ID` owns `LOC_ID`. Update `toggle_enabled`.
- **Success Return**: `{"status": "success", "location_id": "LOC_ID", "toggle_enabled": true}`

### `PATCH /api/agency/set_rate_limit.php`
- **Payload**: `{"location_id": "LOC_ID", "rate_limit": 500}`
- **Behavior**: Validate `X-Agency-ID` owns `LOC_ID`. Update `rate_limit`.
- **Success Return**: `{"status": "success", "location_id": "LOC_ID", "rate_limit": 500}`

### `POST /api/agency/reset_attempt_count.php`
- **Payload**: `{"location_id": "LOC_ID"}`
- **Behavior**: Validate `X-Agency-ID` owns `LOC_ID`. Set `attempt_count` = 0.
- **Success Return**: `{"status": "success", "location_id": "LOC_ID", "attempt_count": 0}`

### `GET /api/agency/get_all_active.php`
- **Behavior**: *Does not require `X-Agency-ID`*. Requires `X-Webhook-Secret`.
- **Purpose**: Used by the main NOLA routing engine. Query all subaccounts globally where `toggle_enabled == true`.
- **Success Return**: `{"status": "success", "active_subaccounts": [...]}`

## 4. Testing
Deploy these files to `smspro-api.nolacrm.io/api/agency/`. The frontend is already polling these exact file paths.

*Generated for NOLA SMS Pro Backend Integration.*
