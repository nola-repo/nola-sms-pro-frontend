# Backend Handoff - Support Tickets Feature

This document summarizes the backend changes implemented for the Support Tickets system.

## 1. Firestore Collection
- **Collection Name**: `support_tickets`
- **Document Structure**:
  ```json
  {
    "location_id": "string",
    "subject": "string",
    "message": "string",
    "status": "open | pending | resolved | closed",
    "priority": "low | normal | high | urgent",
    "admin_note": "string (optional)",
    "created_at": "Timestamp",
    "updated_at": "Timestamp"
  }
  ```

## 2. API Endpoints

### [NEW] User API: `support-tickets.php`
- **URL**: `/api/support-tickets.php`
- **GET**: Lists tickets for a specific `location_id`.
  - **Query Params**: `location_id`
  - **Auth**: Requires valid `X-GHL-Location-ID` and standard API validation.
- **POST**: Creates a new ticket.
  - **Payload**: `{ "subject": "...", "message": "...", "priority": "..." }`
  - **Location ID**: Extracted from headers/request context.

### [NEW] Admin API: `admin_support_tickets.php`
- **URL**: `/api/admin_support_tickets.php`
- **GET**: Lists all support tickets across all locations.
  - **Joins**: Fetches `location_name` from the `accounts` collection for context.
- **POST**: Updates ticket status or adds admin notes.
  - **Payload**: `{ "ticket_id": "...", "action": "...", "status": "...", "admin_note": "..." }`

## 3. Implementation Details
- **Created At/Updated At**: Handled natively using `\Google\Cloud\Core\Timestamp`.
- **Sorting**: Handled in PHP memory (descending by `created_at`).
- **Security**: Basic validation is enabled, similar to `sender-requests.php`.

## 4. Pending Items / Notes
- **Real-time Notifications**: Currently, no emails or push notifications are sent for new tickets. These can be added to the `POST` handlers in the PHP files.
- **Admin Auth**: The admin API uses the project's standard admin session check.
