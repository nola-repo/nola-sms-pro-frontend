# Backend Handoff - Templates, Notification Settings, and GHL Workflow Balance Emails

## Overview

The frontend now supports categorized SMS templates, pre-built template loading, template previews, quick send, Composer template insertion, and backend-backed notification settings.

Important decision: do not add or use `ghlWebhookUrl`. We are avoiding HighLevel's premium Inbound Webhook trigger. Instead, NOLA will update a managed GHL contact for the registered account owner. A normal GHL workflow can trigger from contact field changes and send the balance email to that contact.

The email recipient must always be the registered email from NOLA Account Details. Do not accept or trust a user-entered notification email.

---

## 1. Templates API

Endpoint: `api/templates.php` or routed `/api/templates`

### Required Changes

1. `GET`
   - Return `category` for every template.
   - If missing, return `"General"`.
   - Continue supporting the existing frontend response if it returns a raw array.
   - Preferred response:

```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_123",
      "location_id": "abc",
      "name": "Appointment Confirmation",
      "content": "Hi {{contact.first_name}}, your appointment is confirmed.",
      "category": "Appointments",
      "created_at": "2026-05-27T00:00:00Z",
      "updated_at": "2026-05-27T00:00:00Z"
    }
  ]
}
```

2. `POST`
   - Accept optional `category`.
   - Save it to Firestore.
   - Default to `"General"` if empty.

3. `PUT`
   - Accept optional `category`.
   - Merge it into the existing Firestore document.

### Firestore Path

```text
integrations/ghl_{locId}/templates/{templateId}
```

### Template Fields

```json
{
  "id": "tpl_123",
  "name": "Appointment Confirmation",
  "content": "Hi {{contact.first_name}}, your appointment is confirmed.",
  "category": "Appointments",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Allowed category values for the frontend are:

- `Appointments`
- `Marketing`
- `Transactional`
- `General`

---

## 2. Notification Settings API

Endpoint: `api/notification-settings.php` or routed `/api/notification-settings`

### Required Storage

Save settings inside:

```text
integrations/ghl_{locId}.notification_preferences
```

Do not save settings to `notification_settings/{locId}` for new writes.

### Frontend Request Shape

```json
{
  "deliveryReports": true,
  "lowBalanceAlert": true,
  "lowBalanceThreshold": 50,
  "marketingEmails": false,
  "ghlWorkflowSyncEnabled": true
}
```

### Frontend Response Shape

Return this exact camelCase shape:

```json
{
  "success": true,
  "data": {
    "deliveryReports": true,
    "lowBalanceAlert": true,
    "lowBalanceThreshold": 50,
    "marketingEmails": false,
    "ghlWorkflowSyncEnabled": true,
    "alertEmail": "registered@example.com",
    "ghlAlertContactId": "abc123"
  }
}
```

The frontend treats `alertEmail` and `ghlAlertContactId` as read-only.

### Firestore Map Shape

```json
{
  "notification_preferences": {
    "delivery_reports_enabled": true,
    "low_balance_alert_enabled": true,
    "low_balance_threshold": 50,
    "marketing_emails_enabled": false,
    "ghl_workflow_sync_enabled": true,
    "ghl_alert_contact_id": "abc123",
    "last_low_balance_notified_at": "2026-05-27T03:15:00Z"
  }
}
```

### Email Recipient Rule

`alertEmail` must be derived server-side from the same registered account/profile source used by `/api/account.php`.

Do not accept an `alertEmail` request body value as authoritative.

---

## 3. NotificationService Changes

File: `api/services/NotificationService.php`

### Preference Loading

Update `NotificationService::getPreferences()` to read:

```text
integrations/ghl_{locId}.notification_preferences
```

Defaults:

```php
$defaults = [
    'delivery_reports_enabled' => false,
    'low_balance_alert_enabled' => true,
    'low_balance_threshold' => 50,
    'marketing_emails_enabled' => false,
    'ghl_workflow_sync_enabled' => false,
    'ghl_alert_contact_id' => null,
];
```

### Low Balance Flow

When credits are deducted:

1. Load preferences from `integrations/ghl_{locId}`.
2. Stop if `low_balance_alert_enabled` is false.
3. Stop if current balance is above `low_balance_threshold`.
4. Stop if `ghl_workflow_sync_enabled` is false.
5. Check `last_low_balance_notified_at` and suppress repeat alerts for 24 hours while still under threshold.
6. Resolve registered account email from the NOLA account profile source.
7. Upsert or update a GHL contact for that email.
8. Save the contact id to `notification_preferences.ghl_alert_contact_id`.
9. Update the contact fields listed below.
10. Save `last_low_balance_notified_at`.

### GHL Contact Custom Fields To Update

Create these GHL contact custom fields manually in v1:

```text
nola_sms_balance
nola_sms_low_balance_threshold
nola_sms_alert_type
nola_sms_alert_id
nola_sms_alerted_at
```

For low balance, update values like:

```json
{
  "nola_sms_balance": 45,
  "nola_sms_low_balance_threshold": 50,
  "nola_sms_alert_type": "low_balance",
  "nola_sms_alert_id": "low_balance_ghlLoc123_20260527031500",
  "nola_sms_alerted_at": "2026-05-27T03:15:00Z"
}
```

Use the existing GHL OAuth token for the subaccount. The app already requests `contacts.write`, which is sufficient for contact upsert/update.

### Optional Tag Fallback

If a GHL workflow cannot reliably trigger from custom field change in the target account, add this fallback after updating fields:

1. Remove tag `nola-low-balance-alert` from the managed alert contact if it exists.
2. Add tag `nola-low-balance-alert` again.
3. Configure GHL workflow trigger as Contact Tag Added.

Use this only if field-change trigger is unreliable.

### Delivery Failure Flow

For delivery failures, reuse the same managed contact bridge if `delivery_reports_enabled` and `ghl_workflow_sync_enabled` are true.

Suggested fields:

```text
nola_sms_alert_type = delivery_failure
nola_sms_alert_id = delivery_failure_{locId}_{messageId}_{timestamp}
nola_sms_message_id
nola_sms_delivery_status
nola_sms_recipient
nola_sms_alerted_at
```

Delivery failure workflow setup can be a separate GHL branch where `NOLA SMS Alert Type` equals `delivery_failure`.

---

## 4. GHL Workflow Setup - Balance Email Without Premium Webhooks

This is the setup the agency or subaccount admin performs in GoHighLevel.

### Step 1: Create Custom Fields

In GHL:

1. Go to Settings.
2. Open Custom Fields.
3. Create these Contact custom fields:

| Field Label | Suggested Unique Key |
| --- | --- |
| NOLA SMS Balance | `nola_sms_balance` |
| NOLA SMS Low Balance Threshold | `nola_sms_low_balance_threshold` |
| NOLA SMS Alert Type | `nola_sms_alert_type` |
| NOLA SMS Alert ID | `nola_sms_alert_id` |
| NOLA SMS Alerted At | `nola_sms_alerted_at` |

If GHL generates a different internal custom value token, use the token GHL shows in the email editor.

### Step 2: Create the Workflow

1. Go to Automation.
2. Open Workflows.
3. Create a new workflow.
4. Start from scratch.
5. Name it `NOLA SMS - Low Balance Email`.

### Step 3: Add the Trigger

Recommended trigger:

```text
Contact Changed
```

Configure it so the workflow runs when the field `NOLA SMS Alert ID` changes.

If the account cannot trigger reliably from field changes, use the optional fallback:

```text
Contact Tag Added
Tag: nola-low-balance-alert
```

### Step 4: Add a Filter or If/Else

Add a condition:

```text
NOLA SMS Alert Type equals low_balance
```

This prevents other NOLA notification events from sending the low-balance email.

### Step 5: Add Send Email

Add the normal GHL `Send Email` workflow action.

The email goes to the workflow contact. NOLA creates or updates that contact using the registered email from Account Details.

Suggested email:

```text
Subject: Your NOLA SMS Pro balance is low

Hi {{contact.first_name}},

Your SMS credit balance is now {{contact.custom_fields.nola_sms_balance}}.
Your alert threshold is {{contact.custom_fields.nola_sms_low_balance_threshold}}.

Please top up your account to keep messages sending smoothly.
```

If GHL shows different custom value tokens in the email editor, use GHL's inserted custom value tokens instead of the examples above.

### Step 6: Publish and Test

1. Publish the workflow.
2. Use a test subaccount with a registered email in NOLA Account Details.
3. Enable:
   - Low Balance Alert
   - GHL Workflow Email Alerts
4. Set a threshold above the current test balance.
5. Trigger a credit deduction or run the backend test hook.
6. Confirm:
   - The owner contact exists or was updated in GHL.
   - The custom fields show the balance and alert id.
   - The workflow history shows an enrollment.
   - The registered email receives the message.

---

## 5. Verification Checklist

Frontend:

- `npm run build` succeeds in `user`.
- Templates can be created, edited, deleted, categorized, searched, and filtered.
- Empty template list can load the five pre-built templates.
- Template preview resolves contact and company variables.
- Quick Send loads contacts, previews the resolved message, and sends SMS.
- Composer `Use Template` inserts template content at the cursor.
- Notification settings load from `/api/notification-settings`.
- Notification settings save to `/api/notification-settings`.
- Workflow recipient is read-only and matches Account Details email.

Backend:

- `integrations/ghl_{locId}.notification_preferences` is the single source for notification preferences.
- `NotificationService::getPreferences()` reads from the integration document.
- Low balance alert respects the threshold and 24-hour circuit breaker.
- GHL contact is created or updated for the registered email.
- GHL custom fields are updated with balance alert values.
- GHL workflow sends email without using Inbound Webhook.

---

## References

- HighLevel Contact Tag trigger: https://help.gohighlevel.com/support/solutions/articles/48001213546-workflow-trigger-contact-tag
- HighLevel Send Email workflow action: https://help.gohighlevel.com/support/solutions/articles/155000002472-action-send-email
- HighLevel trigger list: https://help.gohighlevel.com/support/solutions/articles/155000002292
- HighLevel Inbound Webhook premium trigger: https://help.gohighlevel.com/support/solutions/articles/48001237383
- HighLevel Update Contact API: https://marketplace.gohighlevel.com/docs/ghl/contacts/update-contact/
