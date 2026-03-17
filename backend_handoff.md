# Backend Handoff: Persistent SMS Failure Tracking

To enable the new failure tracking feature in the NOLA SMS Pro frontend, the backend (`send_sms.php`) needs to be updated to log failed attempts into Firestore.

## Current Behavior
When an SMS fails (e.g., insufficient credits, invalid number, or Semaphore API error), the backend returns a JSON error response and terminates without creating a record in the `messages` collection. 

## Required Changes

### 1. Log Failures to Firestore
Even if an SMS cannot be sent, a document must be created in the `messages` collection so the user can see the attempt in their conversation history.

- **Collection:** `messages`
- **Status:** Set to `"failed"`
- **Message:** The original message text.
- **Direction:** `"outbound"`
- **Error Reason:** A new field `error_reason` containing the human-readable failure cause.

### 2. Implementation Logic (in `send_sms.php`)

Instead of calling `exit;` immediately upon failure, call a logging function.

**Example for Insufficient Credits:**
```php
if ($e->getMessage() === "Insufficient credits.") {
    // 1. Log to Firestore as failed
    $saveData = [
        'conversation_id' => $conversation_id,
        'location_id'     => $locId,
        'number'          => $recipient,
        'message'         => $message,
        'direction'       => 'outbound',
        'status'          => 'failed',
        'error_reason'    => 'Insufficient credits',
        'created_at'      => $ts
    ];
    $db->collection('messages')->add($saveData);

    // 2. Return error to frontend
    echo json_encode(["status" => "error", "message" => "Insufficient credits"]);
    exit;
}
```

### 3. Recommended Error Reasons
To match the requested frontend experience, please use these strings for common failures:
- `Insufficient credits`
- `Invalid Philippine mobile number`
- `Semaphore API error: [specific error from semaphore]`

## Frontend Support
The frontend is already updated to:
1.  Read the `error_reason` field from Firestore.
2.  Display a red "Failed" badge with the specific reason in the conversation history.
3.  Support both 1-on-1 and bulk message failure tracking.

---

# Backend Handoff: GHL Sub-account Name Retrieval

To personalize the UI for each tenant, the frontend now expects the sub-account name to be returned during the OAuth process.

## Required Changes in `ghl_oauth.php`

1. **Fetch Location Details**: After receiving the `access_token`, make a GET request to the GHL Locations API:
   - **URL**: `https://services.leadconnectorhq.com/locations/{locationId}`
   - **Headers**:
     - `Authorization: Bearer {access_token}`
     - `Version: 2021-07-28`

2. **Extract Name**: Capture the `name` field from the response (this is the sub-account name).

3. **Update Response**: Include the name in the JSON returned to the frontend.
   - **Old Response**: `{"status": "success", "locationId": "..."}`
   - **New Response**: `{"status": "success", "locationId": "...", "locationName": "The Sub-account Name"}`

4. **Persist to Firestore**: (Optional but recommended) Save the sub-account name in the `ghl_tokens` document for future reference.

## Frontend Support
The frontend is already updated to:
1.  Listen for `locationName` in the OAuth callback.
2.  Store it as the `displayName` in local settings.
3.  Display this name in the Sidebar header (replacing the generic "NOLA SMS Pro").

---

# Backend Handoff: API Conversation Deletion Bug

The frontend was recently updated to fully support persistent deletion of direct and bulk messages in the Sidebar by hitting `/api/conversations` with a `DELETE` request. 

However, testing shows the conversations are still appearing after reload, suggesting the backend `DELETE` handler isn't fully removing them.

## The Bug
In `api/conversations.php`, the frontend is correctly passing `?id=` to target the conversation for deletion:
`DELETE /api/conversations?id={conversation_id}`

The backend acknowledges the request, but the document continues to be returned in subsequent `fetch_conversations` calls.

## Required Backend Changes (`api/conversations.php`)

**1. Verify Firestore Deletion Execution (Scoped IDs issues)**
Ensure that the exact document ID passed in `$_GET['id']` is actually matching the document ID in the `conversations` collection and that `$docRef->delete();` is successfully removing it. 

*Important Note on Scoped IDs:*
The frontend has been updated to send the **exact literal document ID** it receives from the database (e.g., `HWfgmknLlE5JWOJWkVS2_conv_09761731036`). 
If the backend `DELETE` handler is doing any string manipulation (like stripping out the location ID or manually prepending `conv_`), it will fail to find the document. The backend MUST respect and delete the exact literal ID sent by the frontend `?id=` parameter.

```php
// Current code in api/conversations.php starting at line 100
$id = $_GET['id'] ?? null;
// ...
$docRef = $db->collection('conversations')->document($id);
if ($docRef->snapshot()->exists()) {
    $docRef->delete();
}
```

**2. Check for Soft Deletes vs Hard Deletes**
If the backend architecture is designed around "soft deletes" (e.g., setting a `deleted` boolean or setting `updated_at` to null), the `GET` endpoint (lines 29-67) MUST filter out these soft-deleted rows.

```php
// If using soft deletes, modify the GET response loop:
if (!empty($d['is_deleted'])) continue; 
```
*Note: If it's a hard delete (`->delete()`), ensure it's executing against the EXACT matching ID, accounting for scoped (`locationId_conv_phone`) vs unscoped (`conv_phone`) IDs.*

**3. Cascading Deletion (Optional but Recommended)**
When a conversation metadata document is deleted from the `conversations` collection, consider also wiping out the individual chat messages linked to that `conversation_id` inside the `messages` collection to prevent orphaned data.
