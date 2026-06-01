# Backend Handoff - Forgot Password OTP and GoHighLevel (GHL) Workflow Integration

This document outlines the changes made to the backend for the OTP-based password reset flow, and explains how to integrate it with a GoHighLevel (GHL) workflow to send the verification code via GHL (SMS/Email) instead of the standard PHP `mail()` function.

---

## 1. Backend Code Scan Summary

The backend codebase has been updated with three files that support the secure OTP forgot password flow:

1. **`api/auth/forgot_password_otp.php`**:
   - Accepts a `POST` request with JSON containing `{ "email": "..." }`.
   - Searches for the email across `admins`, `agency_users`, and `users` collections in Firestore.
   - If found, generates a secure 6-digit OTP code (`otp_code`), sets an expiration date (`otp_expires` set to +10 minutes), resets `otp_verified` to `false`, and saves them to the Firestore document.
   - Dispatches a reset verification code email using PHP's standard `mail()`.
   - Always returns a `200 Success` message (even if the email is not found) to prevent user enumeration security issues.

2. **`api/auth/reset_password_otp.php`**:
   - Accepts a `POST` request with JSON containing `{ "email": "...", "otp": "...", "new_password": "..." }`.
   - Verifies the email, matches the OTP code, and checks that the OTP is not expired or already verified.
   - Hashes the new password using BCRYPT.
   - Updates `password_hash` and `hashed_password` (for admin compatibility), resets the OTP fields to `null`, and sets `otp_verified` to `true`.
   - Returns a success response.

3. **`api/scratch_test_otp.php`**:
   - A command-line script (`php api/scratch_test_otp.php`) that seeds a test user, generates an OTP, tests invalid and valid password resets, verifies BCRYPT hashes, and cleans up the test documents.

---

## 2. GHL Workflow Setup (Delivery via GoHighLevel)

To send the verification codes through a GoHighLevel workflow (highly recommended for superior deliverability, email customization, and SMS capability), follow this setup guide.

### Step 1: Create GHL Custom Fields
In your NOLA Central GHL Location (defined by `NOLA_ALERT_GHL_LOCATION_ID`):
1. Go to **Settings > Custom Fields**.
2. Create the following Contact Custom Fields:

| Field Label | Suggested Key | Field Type |
| :--- | :--- | :--- |
| **NOLA SMS Alert Type** | `nola_sms_alert_type` | Single Line Text |
| **NOLA SMS Alert ID** | `nola_sms_alert_id` | Single Line Text |
| **NOLA SMS OTP Code** | `nola_sms_otp_code` | Single Line Text |
| **NOLA SMS Alerted At** | `nola_sms_alerted_at` | Date/Time or Text |

### Step 2: Create the GoHighLevel Workflow
1. Go to **Automation > Workflows** in your GHL account.
2. Click **Create Workflow** and select **Start from Scratch**.
3. Name the workflow: `NOLA SMS Pro - Password Reset OTP Delivery`.

### Step 3: Add the Workflow Trigger
1. Add a trigger and select **Contact Changed**.
2. Filter the trigger:
   - **Custom Field**: `NOLA SMS Alert ID`
   - **Operator**: `has changed`

### Step 4: Add If/Else Condition
To prevent this workflow from triggering on other NOLA alerts (like low-balance or sender ID alerts):
1. Add an **If/Else** action block.
2. Configure the condition:
   - **Contact > Custom Fields > NOLA SMS Alert Type** `is` `forgot_password_otp`
3. Rename this branch to **OTP Request**.

### Step 5: Add Email or SMS Delivery Action
Under the **OTP Request** branch:
1. Add a **Send Email** or **Send SMS** action.
2. In the body of your message, use the custom field tag to print the OTP code. For example:
   
   ```text
   Subject: Your NOLA SMS Pro verification code
   
   Hi {{contact.first_name}},
   
   Your password reset verification code is:
   
   {{contact.nola_sms_otp_code}}
   
   This code is valid for 10 minutes. If you did not request a password reset, you can ignore this message.
   ```
3. Click **Save Action**.
4. Set the workflow toggle to **Publish** and click **Save**.

---

## 3. Recommended Backend Changes (Handoff for Dev Team)

Since no backend changes are to be committed at this time, the development team can integrate the GHL sync mechanism into the PHP codebase using the following design guidelines:

### 1. Update `resolveCentralGhlCustomFieldIds`
In `api/services/NotificationService.php`, add `nola_sms_otp_code` to the `$requiredKeys` array so the backend maps it to the GHL custom field ID:

```php
$requiredKeys = [
    'nola_sms_alert_type',
    'nola_sms_alert_id',
    'nola_sms_balance',
    'nola_sms_low_balance_threshold',
    'nola_sms_alerted_at',
    'nola_sms_registered_email',
    'nola_sms_source_location_id',
    'nola_sms_source_location_name',
    'nola_sms_requested_sender_id',
    'nola_sms_admin_notes',
    'nola_sms_otp_code', // Add this key
];
```

### 2. Implement the GHL Sync Call
Add the following methods in `api/services/NotificationService.php` to handle OTP delivery:

```php
/**
 * Dispatch OTP code via central GHL workflow.
 *
 * @param \Google\Cloud\Firestore\FirestoreClient $db
 * @param string $email
 * @param string $otp
 */
public static function notifyForgotPasswordOtp($db, string $email, string $otp): void
{
    $centralLocationId = getenv('NOLA_ALERT_GHL_LOCATION_ID') ?: '';
    if ($centralLocationId === '') {
        error_log("[forgot_password_otp] NOLA_ALERT_GHL_LOCATION_ID not set. Skipping GHL delivery.");
        return;
    }

    require_once __DIR__ . '/GhlClient.php';
    $centralTokenRegistryId = getenv('NOLA_ALERT_GHL_TOKEN_REGISTRY_ID') ?: $centralLocationId;
    $alertTag = getenv('NOLA_ALERT_OTP_TAG') ?: 'nola-otp-alert';

    try {
        $ghlClient = new \GhlClient($db, $centralLocationId, $centralTokenRegistryId);
        
        // 1. Search for contact in central location
        $contactId = null;
        $searchUrl = '/contacts/?locationId=' . urlencode($centralLocationId) . '&query=' . urlencode($email);
        $searchResp = $ghlClient->request('GET', $searchUrl);
        if ($searchResp['status'] === 200) {
            $searchData = json_decode($searchResp['body'], true);
            $contacts = $searchData['contacts'] ?? $searchData['data'] ?? [];
            if (is_array($contacts)) {
                foreach ($contacts as $c) {
                    if (isset($c['email']) && strtolower(trim((string)$c['email'])) === strtolower(trim($email))) {
                        $contactId = $c['id'];
                        break;
                    }
                }
            }
        }

        // 2. Resolve custom field IDs
        $fieldIdMap = self::resolveCentralGhlCustomFieldIds($db, $ghlClient, $centralLocationId);
        
        $now = new \DateTimeImmutable();
        $timestamp = $now->format('c');
        $alertId = "otp_{$email}_" . $now->format('YmdHis');

        $alertFields = [
            'nola_sms_alert_type' => 'forgot_password_otp',
            'nola_sms_alert_id'   => $alertId,
            'nola_sms_otp_code'   => $otp,
            'nola_sms_alerted_at' => $timestamp,
        ];

        $ghlCustomFields = [];
        foreach ($alertFields as $k => $v) {
            $fieldId = $fieldIdMap[$k] ?? null;
            if ($fieldId) {
                $ghlCustomFields[] = ['id' => $fieldId, 'value' => (string) $v];
            }
        }

        $contactPayload = [
            'locationId'   => $centralLocationId,
            'email'        => $email,
            'firstName'    => 'NOLA SMS',
            'lastName'     => 'User',
            'customFields' => $ghlCustomFields,
        ];

        // 3. Upsert
        if ($contactId) {
            unset($contactPayload['locationId']);
            $ghlClient->request('PUT', "/contacts/{$contactId}", json_encode($contactPayload));
        } else {
            $createResp = $ghlClient->request('POST', '/contacts/', json_encode($contactPayload));
            if ($createResp['status'] === 200 || $createResp['status'] === 201) {
                $createData = json_decode($createResp['body'], true);
                $contactId = $createData['contact']['id'] ?? $createData['id'] ?? null;
            }
        }

        // 4. Cycle tag to trigger GHL Workflow
        if ($contactId) {
            $ghlClient->request('DELETE', "/contacts/{$contactId}/tags", json_encode(['tags' => [$alertTag]]));
            $ghlClient->request('POST', "/contacts/{$contactId}/tags", json_encode(['tags' => [$alertTag]]));
            error_log("[forgot_password_otp] Successfully synced OTP contact to GHL: {$contactId}");
        }
    } catch (\Throwable $e) {
        error_log("[forgot_password_otp] GHL Contact Bridge sync failed: " . $e->getMessage());
    }
}
```

### 3. Integrate with `forgot_password_otp.php`
Call the notification function right after saving the OTP into the Firestore user document inside `forgot_password_otp.php`:

```php
// Save OTP info to Firestore document (line ~85)
$userRef->set([
    'otp_code' => $otp,
    'otp_expires' => $expires,
    'otp_verified' => false,
    'updated_at' => new \Google\Cloud\Core\Timestamp(new \DateTime()),
], ['merge' => true]);

// Trigger GHL OTP Notification
try {
    require_once __DIR__ . '/../services/NotificationService.php';
    \NotificationService::notifyForgotPasswordOtp($db, $email, $otp);
} catch (\Throwable $e) {
    error_log("[forgot_password_otp] GHL Notification Service failed: " . $e->getMessage());
}

// Fallback direct email delivery (line ~93)
@mail($email, $subject, $message, $headers);
```
