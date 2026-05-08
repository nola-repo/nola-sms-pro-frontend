# Backend Handoff: Checkout Pre-fill Data

## Objective
Ensure that the `api/account.php` endpoint returns the subaccount owner's personal details (Name, Email, Phone) so the frontend can automatically pre-fill the GoHighLevel credit purchase checkout forms.

## Endpoint Requirements

### [GET] /api/account.php?location_id=...
The response `data` object MUST include the following fields if they exist in Firestore:

```json
{
  "status": "success",
  "data": {
    "location_id": "...",
    "location_name": "Subaccount Name",
    "name": "Owner Full Name",
    "email": "owner@email.com",
    "phone": "+1234567890",
    "credit_balance": 100,
    ...
  }
}
```

## Implementation Logic
1. **Fetch Subaccount Metadata**: Get the `location_name` and `location_id` from the `ghl_tokens` or `integrations` collection.
2. **Fetch Owner Details**:
   - Query the `users` collection where `active_location_id` matches the requested `location_id`.
   - If not found, check the `subaccounts` collection group for the `location_id` and trace back to the parent user document.
3. **Field Mapping**:
   - Return `name` (prefer full name, fallback to `firstName` + `lastName`).
   - Return `email`.
   - Return `phone`.

## Verification
You can verify the data by hitting the endpoint directly in a browser or Postman while logged in:
`https://smspro-api.nolacrm.io/api/account.php?location_id=YOUR_LOCATION_ID`

---
**Status**: The frontend is already updated to consume these fields as the primary source for checkout pre-filling. Once the backend returns this data, the "Full Name", "Email Address", and "Phone Number" fields in the GHL checkout funnels will auto-populate.
