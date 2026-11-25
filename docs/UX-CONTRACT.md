# Admin logs and activity UX contract

This document records the shared behavior for Platform Activity (`/activity`) and Logs Explorer (`/logs-explorer`). Visual styling follows [DESIGN.md](DESIGN.md).

## Canonical data path

- Both screens read the platform activity feed through `admin/src/utils/activityLogsApi.ts`.
- The endpoint is `GET /api/admin_sender_requests.php?action=logs`, with an optional page limit and cursor. Admin authorization remains server-enforced.
- Each request carries an `X-Request-ID`. The ID is echoed in the response and attached to backend source-query failure logs so a browser report can be traced across the client, admin proxy, and API.
- Activity responses are not cached by browsers or HTTP intermediaries. The backend may use its short-lived server-side cache for the first page.

## State and recovery

| State | User-visible behavior |
|---|---|
| Initial request | Show loading feedback in the reserved results area. |
| Successful response with events | Render events and record the successful load time. |
| Successful response with no events | Show “No activity has been recorded yet.” This state is only valid after a successful response. |
| Partial response | Render available events, identify unavailable sources, show a warning and request reference. Do not claim the feed is complete. |
| Failed initial request | Show “Activity is unavailable,” a reason appropriate to the response, a request reference when available, and Retry. Never render this as an empty dataset. |
| Failed refresh after success | Preserve prior rows and label them with the last successful load time. Show the refresh failure and Retry. |
| Timeout or no HTTP response | Describe that the activity service did not respond. Do not claim the user's general network is offline. |
| HTTP 401 / 403 | Explain session expiry or access denial; rely on the shared admin auth flow. |
| HTTP 429 / 5xx / malformed payload | Explain a temporary limit, service failure, or unreadable response without exposing raw internals. Provide Retry. |

Logs Explorer keeps previously loaded rows during a refresh error and labels their freshness. Its system diagnostic endpoint is independent from the activity feed; a diagnostics failure must not be presented as proof that activity data or the whole platform is offline.

## Polling, paging, and accessibility

- Background refresh runs at most once per minute while the page is visible. Duplicate requests are ignored while the same screen is already loading.
- The first-page refresh and older-page request on Platform Activity share one in-flight guard; they cannot race each other or overwrite pagination state.
- A partial Platform Activity response invalidates its cursor. The UI stops older-page loading until a later complete refresh returns a new cursor.
- Platform Activity uses cursor pagination and deduplicates mirrored message rows while preserving events from distinct collections.
- Loading and result notices use accessible status semantics. Recovery is available through a keyboard-accessible Retry control; status is conveyed by text and icon as well as color.
- Do not label a fetch failure “Network error.” A failed fetch can result from service, DNS, proxy, TLS, CORS, authorization, timeout, or browser conditions. Use the observed HTTP status when there is one; otherwise say no response was received and include the request reference.
