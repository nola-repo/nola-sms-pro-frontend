# Backend Handoff: Admin Panel Enhancements (SMS Pro)

This document outlines the necessary logic and database changes for the backend team to support the new Admin Panel account management and sender registration features.

## 1. Firestore Schema Considerations

### `integrations` Collection
Each document (ID: `ghl_{location_id}`) should now include:
- `semaphore_api_key` (string): The master API key for the approved sender ID.
- `nola_pro_api_key` (string): Duplicate for backward compatibility.
- `approved_sender_id` (string): The currently active sender registration.
- `credit_balance` (number): The manual manual credit limit set by the admin.
- `free_usage_count` (number): Count of "free" SMS sent by the subaccount.
- `free_credits_total` (number): The limit for free usages before credits are consumed.

### `credit_transactions` Collection
Create a new entry whenever an admin manually overrides a credit balance in the Admin Panel:
- `id` (string): Unique adjustment ID (prefix `adj_`).
- `location_id` (string): The subaccount being adjusted.
- `amount` (number): The new credit balance.
- `type` (string): `'admin_adjustment'`.
- `description` (string): `'Manual credit override by System Admin'`.
- `created_at` (Timestamp): Server timestamp.

---

## 2. API Endpoint Requirements (`admin_sender_requests.php`)

### `POST` Action: `status` Update
When updating the status of a `sender_id_request` (Approval/Rejection/Revocation):
- **Approval**:
  1. Set status in `sender_id_requests` to `'approved'`.
  2. Map the `requested_id` and provided `api_key` to the `integrations` document for the associated `location_id`.
- **Revocation**:
  1. Set status in `sender_id_requests` to `'revoked'`.
  2. **CRITICAL**: Clear the `approved_sender_id` and `semaphore_api_key` in the `integrations` document for that `location_id`. The account should fall back to the "System" default.

### `POST` Action: `manage_sender`
- Allow updating `credit_balance` without requiring an `api_key` change.
- Perform a "merge" set in Firestore to avoid overwriting existing tracking tokens (access/refresh tokens).

### `GET` Action: `accounts`
- Ensure all accounts return the `semaphore_api_key` for display in the Admin Dashboard.
- Automatically populate the `location_name` if missing by querying the GHL Locations API using the stored `access_token`.

---

## 3. Immediate Database Action Required

**Action Item**: Please run a script or manually update existing approved accounts in the `integrations` collection to ensure the `semaphore_api_key` field is populated. If this field is missing, the Admin Panel table will display "None" for that account.

---
*Status: Ready for Deployment*
*Deployment Target: Google Cloud Run*
