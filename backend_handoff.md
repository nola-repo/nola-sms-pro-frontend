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

# Backend Handoff: API Conversation Deletion

## Required Backend Changes (`api/conversations.php`)

### 1. Fix CORS Headers (Critical)
The current `Access-Control-Allow-Methods` header in `api/conversations.php` is missing `DELETE` and `PUT`. This will cause browser preflights to fail.

```php
// api/conversations.php - Update Line 11
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
```

### 2. Verify Firestore Deletion Execution (Scoped IDs)
The frontend sends the **exact literal document ID** it receives from the database (e.g., `HWfg..._conv_0976...` or `HWfg..._group_batch...`). 

The backend MUST delete the exact string received in `$_GET['id']`. 

**Action:** Add a debug log to verify the ID and check for existence before deletion.

```php
elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    
    // DEBUG: Log the ID to see if it matches Firestore
    // error_log("Attempting to delete conversation: " . $id);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing id parameter']);
        exit;
    }

    $docRef = $db->collection('conversations')->document($id);
    if ($docRef->snapshot()->exists()) {
        $docRef->delete();
        echo json_encode(['success' => true, 'message' => "Deleted $id"]);
    } else {
        // If snapshot doesn't exist, the ID sent didn't match perfectly
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => "Conversation $id not found"]);
    }
    exit;
}
```

### 3. Account for Scoped ID Format
Based on Firestore Studio, IDs follow patterns like:
- `{locationId}_{contactId}`
- `{locationId}_conv_{phone}`
- `{locationId}_group_{batchId}`

The frontend is now passing these strings **completely untouched**. The backend must ensures it doesn't try to strip the `location_id` prefix before calling `->document($id)`.

### 4. Cascading Deletion (Recommended)
When a conversation is deleted, ensure all messages in the `messages` collection with matching `conversation_id` are removed.
