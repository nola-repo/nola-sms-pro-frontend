# Backend Handoff — Credit & Billing System

**Scope:** New agency-level wallet, dual-deduction on SMS send, top-up, auto-recharge, credit gifting, and credit requests.  
**Stack:** PHP + Firestore (existing pattern — follow `CreditManager.php` style)  
**Priority:** High — frontend is ready to wire up once these endpoints exist.

---

## 1. Firestore Schema Changes

### 1a. New Collection — `agency_wallet`

```
agency_wallet/
  {agency_id}/           // use the GHL company_id or your existing agency identifier
    balance: number                  // credit units (integer, same unit as subaccount credits)
    auto_recharge_enabled: boolean
    auto_recharge_amount: number     // credits to add when threshold hit
    auto_recharge_threshold: number  // trigger recharge when balance drops below this
    updated_at: timestamp
```

### 1b. New Collection — `credit_requests`

```
credit_requests/
  {request_id}/
    agency_id: string
    location_id: string
    location_name: string
    amount: number
    status: "pending" | "approved" | "denied"
    note: string           // optional message from subaccount
    created_at: timestamp
    resolved_at: timestamp | null
    resolved_by: string    // agency user who acted
```

### 1c. Update existing `integrations/{location_id}` docs

Add three new fields (alongside existing `credit_balance`):
```
  auto_recharge_enabled: boolean
  auto_recharge_amount: number
  auto_recharge_threshold: number
```

---

## 2. New API Files

> All files go in `api/billing/`. Follow the existing CORS/auth header pattern from other `api/` files.

---

### `api/billing/agency_wallet.php`

**GET** — Returns agency wallet state.
```json
{
  "balance": 1500,
  "auto_recharge_enabled": true,
  "auto_recharge_amount": 500,
  "auto_recharge_threshold": 100,
  "updated_at": "2026-04-17T00:00:00Z"
}
```

> **Note on Top-ups:** The frontend does not call an API for top-ups. It opens external checkout URLs configured per package, passing `?agency_id={id}&scope=agency`. Your payment provider webhook should intercept the successful purchase and credit the `agency_wallet`.

**POST — `action=set_auto_recharge`**
```json
// Request
{ "enabled": true, "amount": 500, "threshold": 100 }
// Response
{ "success": true }
```

**POST — `action=gift`** — Transfer credits from agency to a subaccount.
```json
// Request
{ "location_id": "abc123", "amount": 100, "note": "Monthly allocation" }
// Response
{ "success": true, "agency_balance": 1400, "subaccount_balance": 350 }
```
> Use a Firestore **transaction** to atomically deduct from `agency_wallet` and add to `integrations/{location_id}.credit_balance`. Log both sides under `credit_transactions`.

---

### `api/billing/subaccount_wallet.php`

**GET** — Returns subaccount wallet state (reads from `integrations/{location_id}`).
```json
{
  "balance": 249,
  "auto_recharge_enabled": false,
  "auto_recharge_amount": 250,
  "auto_recharge_threshold": 25,
  "updated_at": "2026-04-17T00:00:00Z"
}
```

> **Note on Top-ups:** Similarly handled via external URL passing `?location_id={id}`. The payment provider webhook applies credits directly to `integrations/{location_id}.credit_balance`.

**POST — `action=set_auto_recharge`**
```json
// Request
{ "location_id": "abc123", "enabled": true, "amount": 250, "threshold": 25 }
// Response
{ "success": true }
```

**POST — `action=request_credits`** — Subaccount requests credits from agency.
```json
// Request
{ "location_id": "abc123", "amount": 200, "note": "Running low, campaign this weekend" }
// Response
{ "success": true, "request_id": "req_xyz" }
```
> Creates a new doc in `credit_requests` with `status: "pending"`.

---

### `api/billing/credit_requests.php`

**GET** — Agency lists all credit requests.

Query params: `?agency_id=X&status=pending` (status optional, default = all)

```json
{
  "requests": [
    {
      "request_id": "req_xyz",
      "location_id": "abc123",
      "location_name": "J&K Car Rentals",
      "amount": 200,
      "note": "Running low",
      "status": "pending",
      "created_at": "2026-04-17T10:00:00Z"
    }
  ]
}
```

**POST — `action=approve`**
```json
// Request
{ "request_id": "req_xyz" }
// Response
{ "success": true, "agency_balance": 1300, "subaccount_balance": 449 }
```
> Firestore transaction: deduct from agency wallet, add to subaccount, update request doc `status → "approved"`, log both in `credit_transactions`.

**POST — `action=deny`**
```json
// Request
{ "request_id": "req_xyz" }
// Response
{ "success": true }
```
> Updates request doc `status → "denied"`.

---

### `api/billing/transactions.php`

**GET** — Paginated transaction log.

Query params:
- `?scope=agency&agency_id=X&month=2026-04&page=1`
- `?scope=subaccount&location_id=abc123&month=2026-04&page=1`

```json
{
  "transactions": [
    {
      "id": "txn_001",
      "type": "deduction",           // "deduction" | "top_up" | "gift_sent" | "gift_received" | "auto_recharge"
      "amount": -1,
      "balance_after": 1499,
      "description": "SMS to +639173456789",
      "timestamp": "2026-04-17T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1
}
```

> **Transaction types to log:**
> | Event | type | amount sign |
> |---|---|---|
> | SMS sent (subaccount deduct) | `deduction` | negative |
> | SMS sent (agency co-deduct) | `deduction` | negative |
> | Manual top-up | `top_up` | positive |
> | Auto-recharge | `auto_recharge` | positive |
> | Agency gifted to subaccount | `gift_sent` (agency) / `gift_received` (subaccount) | negative / positive |
> | Credit request approved | `request_approved` | positive (subaccount) |

---

## 3. Modify Existing Send Handler

> **In `CreditManager.php` (or wherever SMS sending is authorized):**

Before allowing a send, check **both** balances:
```php
// Pseudocode
$subaccountBalance = getSubaccountBalance($location_id);
$agencyBalance = getAgencyBalance($agency_id);

if ($subaccountBalance <= 0 || $agencyBalance <= 0) {
    return ['success' => false, 'error' => 'insufficient_credits', 
            'agency_balance' => $agencyBalance, 
            'subaccount_balance' => $subaccountBalance];
}

// Atomic Firestore transaction: deduct 1 credit from both wallets simultaneously
deductBothWallets($agency_id, $location_id, $creditsNeeded);
```

The frontend will surface `insufficient_credits` with a message like:
- "Your agency wallet has no credits. Contact your administrator."
- "Your account has no credits. Please top up or request credits from your agency."

---

## 4. Auto-Recharge Cron Job

Create a Cloud Scheduler / cron job `api/billing/auto_recharge_cron.php`:
1. Query all `integrations` docs where `auto_recharge_enabled = true AND credit_balance < auto_recharge_threshold`
2. For each, trigger a payment charge against their saved card/method for `auto_recharge_amount`
3. On success: add credits, log `type=auto_recharge`
4. Repeat for `agency_wallet` docs

**Suggested schedule:** Every 15 minutes.

---

## 5. Transaction Log Convention (inherit from existing `credit_transactions`)

Reuse your existing `credit_transactions` Firestore collection. Add a new top-level field `wallet_scope`:
```
wallet_scope: "agency" | "subaccount"
```
So agency-level credits are stored alongside subaccount credits but can be filtered distinctly.

---

## Summary Checklist for Backend Team

- [ ] Create `agency_wallet` Firestore collection + seed docs
- [ ] Add auto-recharge fields to `integrations` docs
- [ ] Create `api/billing/agency_wallet.php` (GET + POST actions)
- [ ] Create `api/billing/subaccount_wallet.php` (GET + POST actions)
- [ ] Create `api/billing/credit_requests.php` (GET + POST actions)
- [ ] Create `api/billing/transactions.php` (GET)
- [ ] Update `CreditManager.php` send guard to check agency + subaccount balance
- [ ] Update `credit_transactions` logs with `wallet_scope` field + `balance_after`
- [ ] Create auto-recharge cron script
- [ ] (Optional) Payment provider webhook to handle top-up confirmations

*Frontend: Fully designed and ready to wire up once endpoints are live.*
