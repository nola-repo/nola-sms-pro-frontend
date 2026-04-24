# Backend Handoff: GHL Custom Fields + Checkout Form Pre-fill

**To:** Backend Team  
**Topic:** Write user registration data to GHL as Custom Values on the location, so the checkout order form auto-fills name/email/phone  
**New File:** `backend/api/auth/register_from_install.php` — add GHL Custom Values write step  
**Trigger:** Called at the end of the install registration flow (after Firestore user doc is created)

---

## The Problem

The checkout page (`sms.nolawebsolutions.com/nola-sms-pro---XXX-credits-page-XXXX`) is a **GHL funnel order form**. It has three contact fields:

- **Full Name**
- **Email Address**
- **Phone Number**

Currently these are always blank when the checkout popup opens. Users have to type their info every time they buy credits, even though we already captured it at install time.

---

## The Two-Part Solution

### Part 1 — Frontend (Already Done ✅)

`Settings.tsx` → `handleTopUp()` now appends contact URL params to the checkout URL:

```
https://sms.nolawebsolutions.com/nola-sms-pro---500-credits-page-8465
  ?location_id=MJoecBYPutNZwRw7N7Ud
  &name=Maria+Santos
  &first_name=Maria
  &last_name=Santos
  &email=maria%40example.com
  &phone=09171234567
```

GHL funnel order forms natively read these URL query params and pre-fill the form fields — **no GHL configuration changes needed** for this part.

The profile data comes from `localStorage.nola_user`, which is set during:
- First-time install registration (`ghl_callback.php` → JS → `localStorage`)
- External login (`SharedLogin.tsx` → `localStorage`)

---

### Part 2 — Backend: Write GHL Custom Values (Option C)

After the user registers via `register_from_install.php`, use the OAuth `access_token` (already stored in `integrations/<locationId>`) to write the owner's contact info as **GHL Location Custom Values**.

This means:
- The data is stored inside GHL (visible in the location's custom fields)
- GHL automations and workflows can reference them via merge tags like `{{location.custom_values.nola_owner_name}}`
- The checkout funnel builder can optionally use these as default field values

---

## What Backend Must Implement

### Step 1: Create the Custom Field Definitions (one-time setup per location)

After installing, call the GHL API to ensure these custom fields exist on the location:

```
POST https://services.leadconnectorhq.com/locations/{locationId}/customFields
Authorization: Bearer {access_token}
Version: 2021-07-28
Content-Type: application/json

{
  "name": "Owner Name",
  "fieldKey": "owner_name",
  "dataType": "TEXT",
  "placeholder": ""
}
```

Repeat for:
- `owner_email` → `"Owner Email"` → `TEXT`
- `owner_phone` → `"Owner Phone"` → `TEXT`

> [!NOTE]
> These only need to be created once per location. If the field already exists, GHL returns the existing field's `id` — just use it for the value update below.

---

### Step 2: Set the Custom Values

After getting the field IDs (from Step 1 response or a `GET /customFields`), update the values:

```
PUT https://services.leadconnectorhq.com/locations/{locationId}/customValues/{customFieldId}
Authorization: Bearer {access_token}
Version: 2021-07-28
Content-Type: application/json

{
  "value": "Maria Santos"
}
```

Repeat for email and phone.

---

### Step 3: Add to `register_from_install.php`

Add this PHP function call at the end of `register_from_install.php` (after creating the Firestore user doc, before returning the response):

```php
// ── Write owner info to GHL Custom Values ─────────────────────────────────
_sync_owner_to_ghl($db, $locationId, $fullName, $email, $phone);
```

And add the function:

```php
function _sync_owner_to_ghl($db, string $locationId, string $fullName, string $email, string $phone): void
{
    if (!$locationId) return;

    // 1. Retrieve the access token from Firestore integrations
    $intDocId = 'ghl_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $locationId);
    try {
        $intSnap = $db->collection('integrations')->document($intDocId)->snapshot();
        if (!$intSnap->exists()) return;
        $accessToken = $intSnap->data()['access_token'] ?? null;
        if (!$accessToken) return;
    } catch (Exception $e) {
        error_log("_sync_owner_to_ghl: failed to fetch integration for $locationId: " . $e->getMessage());
        return;
    }

    // 2. Fields to upsert: [GHL fieldKey => value]
    $fields = [
        'owner_name'  => $fullName,
        'owner_email' => $email,
        'owner_phone' => $phone,
    ];

    $headers = [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
        'Accept: application/json',
        'Version: 2021-07-28',
    ];

    foreach ($fields as $fieldKey => $value) {
        try {
            // 3a. Get or create the custom field
            $fieldId = _ghl_get_or_create_custom_field($locationId, $fieldKey, $headers);
            if (!$fieldId) continue;

            // 3b. Set the custom value
            $ch = curl_init("https://services.leadconnectorhq.com/locations/{$locationId}/customValues/{$fieldId}");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST  => 'PUT',
                CURLOPT_HTTPHEADER     => $headers,
                CURLOPT_POSTFIELDS     => json_encode(['value' => $value]),
            ]);
            curl_exec($ch);
            curl_close($ch);
        } catch (Exception $e) {
            error_log("_sync_owner_to_ghl: failed to set $fieldKey for $locationId: " . $e->getMessage());
        }
    }
}

function _ghl_get_or_create_custom_field(string $locationId, string $fieldKey, array $headers): ?string
{
    // GET existing fields
    $ch = curl_init("https://services.leadconnectorhq.com/locations/{$locationId}/customFields");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200) {
        $data = json_decode($resp, true);
        foreach (($data['customFields'] ?? []) as $f) {
            if (($f['fieldKey'] ?? '') === $fieldKey) {
                return $f['id'];
            }
        }
    }

    // Field doesn't exist — create it
    $nameMap = [
        'owner_name'  => 'Owner Name',
        'owner_email' => 'Owner Email',
        'owner_phone' => 'Owner Phone',
    ];
    $ch = curl_init("https://services.leadconnectorhq.com/locations/{$locationId}/customFields");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_POSTFIELDS     => json_encode([
            'name'      => $nameMap[$fieldKey] ?? $fieldKey,
            'fieldKey'  => $fieldKey,
            'dataType'  => 'TEXT',
        ]),
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200 || $code === 201) {
        $data = json_decode($resp, true);
        return $data['customField']['id'] ?? $data['id'] ?? null;
    }

    return null;
}
```

---

## GHL OAuth Scope Required

The existing OAuth scope **`locations.readonly`** does NOT allow writing custom fields.

You must add:
```
locations.write
```

to the GHL Marketplace app OAuth scopes. After adding, existing installs will need to re-authorize to grant the new scope. New installs will get it automatically.

> [!WARNING]
> Adding a new OAuth scope requires existing users to re-authorize. Plan for a migration prompt in the app or a one-time re-install campaign.

**Where to add:** GHL Developer Portal → Your App → OAuth tab → Scopes → add `locations.write`

---

## GHL Funnel Form Configuration (Option C Full Setup)

Once the Custom Values are being written via the API, you can optionally configure the GHL funnel form to **display the stored custom values as default field text**.

In the GHL Funnel Builder for each checkout page:

1. Open the order form field for **Full Name**
2. Set **Default Value** to: `{{location.custom_values.owner_name}}`
3. Repeat for **Email**: `{{location.custom_values.owner_email}}`
4. Repeat for **Phone**: `{{location.custom_values.owner_phone}}`

This means even if the URL params are missing (e.g., user opened checkout directly), the form still pre-fills from the stored GHL custom values.

---

## Summary: How Both Parts Work Together

```
Install → register_from_install.php
  ├── Writes to Firestore users (already done)
  ├── Writes to Firestore integrations (already done)
  └── [NEW] Writes to GHL Custom Values via API
        → location.custom_values.owner_name  = "Maria Santos"
        → location.custom_values.owner_email = "maria@example.com"
        → location.custom_values.owner_phone = "09171234567"

User clicks "Buy Credits" in NOLA SMS Pro (Settings.tsx)
  └── handleTopUp() builds checkout URL:
        https://sms.nolawebsolutions.com/nola-sms-pro---500-credits-page-8465
          ?location_id=MJoecBYPutNZwRw7N7Ud
          &name=Maria+Santos
          &first_name=Maria&last_name=Santos
          &email=maria%40example.com
          &phone=09171234567

GHL Funnel Order Form loads:
  ├── URL params pre-fill the form fields instantly (Part 1 ✅ done)
  └── GHL custom values are fallback defaults (Part 2 ← backend needed)

User just clicks "Complete Order" — no manual typing needed.

After payment → GHL Workflow fires:
  → POST https://smspro-api.nolacrm.io/api/credits
  → X-GHL-Location: {{businessName}}
  → { action: "add", amount: 500 }
  → Credits added to NOLA account ✅
```

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/locations/{id}/customFields` | `GET` | List existing custom field definitions |
| `/locations/{id}/customFields` | `POST` | Create new custom field definition |
| `/locations/{id}/customValues/{fieldId}` | `PUT` | Set the value for a custom field |

All use:
- `Authorization: Bearer {access_token}` (from `integrations` Firestore doc)
- `Version: 2021-07-28`

---

## New OAuth Scope Required

| Scope | Why |
|-------|-----|
| `locations.write` | Required to create custom fields and write custom values |

Add to GHL Marketplace App → OAuth Scopes alongside existing scopes.

---

*Frontend change (URL param pre-fill) is already deployed. Backend only needs to implement the `_sync_owner_to_ghl()` function in `register_from_install.php` and add the `locations.write` scope.*
