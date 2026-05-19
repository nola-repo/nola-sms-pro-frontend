# Backend Handoff: New Subaccount Registration Performance

Status: Ready for backend investigation  
Priority: High  
Backend scanned: `C:\Users\User\nola-sms-pro-backend`

## Executive summary

Registering a newly installed GHL subaccount can feel slow because the user-facing install/register flow does too much synchronous backend work before redirecting or returning success.

There are two likely wait points:

1. `install-register.php` loads the registration page and calls the full location classifier before rendering.
2. `POST /api/auth/register-from-install` creates/links the user, then synchronously re-classifies and finalizes the location install before returning JSON to the browser.

The most important backend change is to make the final registration response fast: after the user and ownership records are written, return the JWT immediately and move non-critical install finalization/mirroring into a fast-path batch or background job.

## User-facing symptom

On the registration form, the button changes to `Creating...` and remains there until `/api/auth/register-from-install` returns. If the backend re-runs deep Firestore ownership discovery or waits on multiple Firestore reads/writes, the user sees this as "new subaccount registration takes too long to load."

Relevant UI submit code:

- `install-register.php:656`
- `install-register.php:660`

## Main slow path

### 1. Registration submit finalizes synchronously

File: `api/auth/register_from_install.php`

The existing-user path calls:

- `api/auth/register_from_install.php:511` -> `install_finalize_after_registration(...)`

The new-user path calls:

- `api/auth/register_from_install.php:649` -> `install_finalize_after_registration(...)`

That helper then does:

- `api/install_helpers.php:1028` defines `install_finalize_after_registration`
- `api/install_helpers.php:1063` calls `install_classify_location(...)`
- `api/install_helpers.php:1076` calls `install_finalize_location_install(...)`
- `api/install_helpers.php:1086` defines `install_finalize_location_install`

For a new registration, this is redundant because the request has already attached the user to `location_owners` and written the user/subaccount records. The backend does not need to perform the full "is this linked?" discovery again before responding to the browser.

### 2. Full classifier has deep fallback queries

File: `api/install_helpers.php`

`install_classify_location(...)` calls:

- `api/install_helpers.php:1816` -> `install_linked_account_for_location(...)`

`install_linked_account_for_location(...)` first checks `location_owners`, but if that is missing or not useful it falls back to multiple queries:

- `api/install_helpers.php:1444` defines `install_linked_account_for_location`
- `api/install_helpers.php:1498` collection group query on `users/*/subaccounts`
- `api/install_helpers.php:1515` collection group query by document ID on `users/*/subaccounts`

On fresh installs where no owner is found yet, this can become several sequential Firestore reads before the page or submit can continue.

### 3. Registration submit repeats writes

File: `api/auth/register_from_install.php`

The new-user path writes owner metadata:

- `api/auth/register_from_install.php:602` -> `_sync_location_owner_metadata(...)`

Then finalization writes `ghl_tokens` and `integrations` again:

- `api/install_helpers.php:1086` -> `install_finalize_location_install(...)`

`_sync_location_owner_metadata(...)` itself writes two documents sequentially:

- `api/auth/register_from_install.php:753` defines the helper

Recommended: combine owner metadata and install finalization fields into a single batch, or return success after identity writes and let a background task mark `INSTALLED`.

## Secondary slow path: registration page pre-form guard

File: `install-register.php`

Before rendering the form, the page calls:

- `install-register.php:325` -> `install_classify_location(...)`

That can trigger the same full ownership fallback chain. For a fresh install, the page only needs to know:

- token exists for this `location_id`
- token belongs to the expected `company_id`
- whether `location_owners/{locationId}` already exists

There is already a faster helper shape available:

- `api/install_helpers.php:1702` -> `install_classify_location_for_provision(...)`

Consider using a page-specific fast classifier here instead of the full deep fallback. Keep deep fallback behind an explicit repair/migration path, not on every first-run render.

## Agency provisioning note

`api/agency/install_provision.php` intentionally does long-running bulk provisioning:

- `api/agency/install_provision.php:17` disables execution timeout
- `api/agency/install_provision.php:50` fetches all company locations
- `api/agency/install_provision.php:166` exchanges a location token per location

This is separate from single subaccount registration, but if it runs on the same Cloud Run service with limited concurrency/CPU it can compete with user-facing registration requests. If users report slowness mainly after agency installs, move bulk provisioning to Cloud Tasks/Cloud Scheduler/queue workers or a separate service.

## Recommended backend fix

### A. Make `/api/auth/register-from-install` return immediately after identity writes

For new and existing subaccount registration:

1. Validate token and location/company ownership as today.
2. Write/update:
   - `users/{uid}`
   - `users/{uid}/subaccounts/{locationId}`
   - `location_owners/{locationId}` or `location_owners/{locationId}/members/{uid}`
3. Sign and return the JWT.
4. Finalize `ghl_tokens/{locationId}` and `integrations/ghl_{locationId}` using one of:
   - same request, but via a minimal batch without `install_classify_location`
   - a background endpoint/task
   - a best-effort fire-and-forget internal request

Avoid this during the foreground response:

```php
install_finalize_after_registration($db, (string)$locationId, $now);
```

Replace it with a fast helper that trusts the just-created ownership context, for example:

```php
install_finalize_registered_location_fast(
    $db,
    (string) $locationId,
    [
        'owner_user_id' => $uid,
        'owner_email' => $email,
        'owner_name' => $fullName,
        'owner_phone' => $phone,
    ],
    $now
);
```

That helper should:

- read `ghl_tokens/{locationId}` once
- skip if the token doc is missing or does not contain a location token
- set `install_state = INSTALLED`, `install_status = LINKED_ACCOUNT`, `is_live = true`, `toggle_enabled = true`
- mirror only required compatibility fields to `integrations/ghl_{locationId}`
- commit with one Firestore batch

### B. Keep deep linked-account fallback out of the hot path

Use the full `install_linked_account_for_location(..., deepFallback=true)` only for migration/repair flows. On page render and post-registration finalize, prefer:

- `location_owners/{locationId}` direct lookup
- `ghl_tokens/{locationId}` direct lookup
- `integrations/ghl_{locationId}` direct lookup only if needed

The existing `INSTALL_REGISTER_DEEP_LINK_CHECK` flag in `install-register.php:53` is the right direction; extend the same idea to `install_classify_location` callers in the install/register hot path.

### C. Add timing logs around each step

Add lightweight timing logs with a request ID for:

- JWT verify
- email lookup
- location/company mismatch check
- owner attach
- user document write
- subaccount write/prune
- owner metadata sync
- finalization
- total request time

This will confirm whether the current blocker is Firestore classification, duplicate writes, GHL calls, or Cloud Run cold start.

## Acceptance criteria

- Fresh subaccount registration submit returns in under 1 second after Firestore warm-up, excluding Cloud Run cold start.
- Registration page render avoids collection-group ownership discovery by default.
- `ghl_tokens/{locationId}` ends in `install_state = INSTALLED`, `is_live = true`, and `toggle_enabled = true` after successful registration.
- `integrations/ghl_{locationId}` still has required compatibility fields and owner metadata.
- Reinstall/welcome-back behavior still works for already linked subaccounts.
- Additional-member registration still writes `location_owners/{locationId}/members/{uid}` and does not steal the primary owner lock.

## Files to review

- `C:\Users\User\nola-sms-pro-backend\install-register.php`
- `C:\Users\User\nola-sms-pro-backend\api\auth\register_from_install.php`
- `C:\Users\User\nola-sms-pro-backend\api\install_helpers.php`
- `C:\Users\User\nola-sms-pro-backend\api\auth_helpers.php`
- `C:\Users\User\nola-sms-pro-backend\api\agency\install_provision.php`
