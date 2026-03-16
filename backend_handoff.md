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
