# Full Project To-Do List — Dual-Wallet Credit System

This tracking document covers all phases of the dual-wallet credit system update (Planning, Frontend, and Backend). 

## 1. Planning Phase
- [x] Gather requirements for dual-wallet billing (agency & subaccount) - completed
- [x] Scan existing code structure (`CreditManager.php`, frontend apps) - completed
- [x] Draft `implementation_plan.md` architecture - completed
- [x] Create `backend_handoff_billing.md` API specification - completed
- [x] Refine handoff (remove Stripe references, update external top-up URLs) - completed

## 2. Frontend Implementation Checklist
> **Status:** All frontend components are fully coded, typed, and wired. They assume the backend endpoints from the handoff exist.

### Agency App
- [x] Create `pages/Billing.tsx` Dashboard - completed
- [x] Implement Wallet Card + "Low Balance" banners - completed
- [x] Build external Top Up modal with custom package routing - completed
- [x] Build inline Auto-Recharge config components - completed
- [x] Create Credit Gifting modal (agency → subaccount) - completed
- [x] Add Transaction Ledger with month filtering + summary metrics - completed
- [x] Build Credit Requests panel (approve/deny functionality) - completed
- [x] Update `/billing` route and `AgencyLayout` sidebar nav - completed

### User (Subaccount) App
- [x] Update existing `pages/Settings.tsx` Credits tab - completed
- [x] Add inline Auto-Recharge config - completed
- [x] Add "Request Credits from Agency" custom modal - completed

## 3. Backend Implementation Checklist
> **Notice for Backend Team:** These tasks map directly to `backend_handoff_billing.md`.

- [ ] Setup Firestore (`agency_wallet`, `credit_requests`, add config to `integrations`) - pending
- [ ] Build `/api/billing/agency_wallet.php` (GET, POST auto-recharge, POST gift) - pending
- [ ] Build `/api/billing/subaccount_wallet.php` (GET, POST auto-recharge, POST request) - pending
- [ ] Build `/api/billing/credit_requests.php` (GET list, POST approve, POST deny) - pending
- [ ] Build `/api/billing/transactions.php` (GET paginated logs by scope) - pending
- [ ] Update `CreditManager.php` to duel-deduct from `agency_wallet` & `integrations` simultaneously - pending
- [ ] Implement Auto-Recharge Cron Script - pending
- [ ] Setup payment provider webhook to catch checkout completions - pending

## 4. Integration Verification
- [ ] Test frontend to backend CORS routing - pending
- [ ] End-to-end test: Top-up from frontend → webhook processing - pending
- [ ] End-to-end test: Agency wallet reaching 0 blocks all subaccount sending - pending
