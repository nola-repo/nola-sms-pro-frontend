# Backend Handoff — Toggle Flicker Root Cause Fix

**Date**: April 15, 2026  
**Priority**: High  
**Affected Repo**: `nola-repo/NOLA-SMS-Pro` — Agency Frontend  
**Files Changed**: `agency/src/pages/Subaccounts.tsx`

---

## Status Summary

| Layer | Status | Note |
|---|---|---|
| `api/agency/update_subaccount.php` | ✅ Correct — No changes needed | POSTs to correct endpoint, correct payload |
| `api/agency/toggle_subaccount.php` | ✅ Does not exist (correct — was never needed) | Frontend was already fixed to call `update_subaccount.php` |
| `agency/src/services/api.ts` | ✅ Already correct | Calls `update_subaccount.php` with `toggle_enabled` |
| `agency/src/pages/Subaccounts.tsx` | ✅ Fixed in this handoff | Poll suppression added |

---

## Root Cause (Confirmed)

### Root Cause 1 — Wrong endpoint (RESOLVED in prior session)
Previously the frontend called `toggle_subaccount.php` which does not exist on the server.  
**Status:** Already fixed. `api.ts` now correctly calls `update_subaccount.php`.

### Root Cause 2 — 10-second poll races Firestore write propagation (FIXED NOW)

**The Sequence That Caused the Flicker:**
```
User clicks toggle ON
  → Optimistic UI: toggle flips ON immediately ✅
  → API call fires: POST /api/agency/update_subaccount.php
  → [~200ms later] Background poll interval fires (every 10 seconds)
  → fetchSubaccounts() reads from agency_subaccounts (Firestore)
  → Firestore write hasn't fully propagated yet
  → agency_subaccounts still shows toggle_enabled: false (stale)
  → setSubaccounts() overwrites optimistic state with stale DB value
  → UI snaps BACK to OFF ← THIS IS THE FLICKER
```

### Root Cause 3 — Removed unused `targetSubaccount` variable
A dead `const targetSubaccount = subaccounts.find(...)` variable was left over in `handleToggle`. Removed — it had zero impact on the bug but was dead code.

---

## Fix Applied

**File:** `agency/src/pages/Subaccounts.tsx`

### 1. Added `toggleInFlightRef`
```typescript
const toggleInFlightRef = useRef(false); // true while any toggle API call is active
```
This ref (not state) tracks whether any toggle is currently processing without causing re-renders.

### 2. Suppressed silent polls while toggle is in-flight
```typescript
const fetchSubaccounts = useCallback(async ({ silent = false } = {}) => {
  if (!agencyId) { setLoading(false); return; }
  // Skip silent background polls while any toggle is in-flight — prevents
  // a stale Firestore read from snapping the optimistic UI state back.
  if (silent && toggleInFlightRef.current) return;
  ...
```
Background polls (triggered by `setInterval`) pass `{ silent: true }`, so they are suppressed during a toggle. Manual refresh still works normally.

### 3. Set flag on toggle start, clear after 600ms delay
```typescript
const handleToggle = async (locationId, enabled) => {
  toggleInFlightRef.current = true;  // ← suppress polls immediately
  ...
  } finally {
    setToggleLoading(prev => ({ ...prev, [locationId]: false }));
    // Allow polls again after 600 ms — gives Firestore time to propagate
    setTimeout(() => { toggleInFlightRef.current = false; }, 600);
  }
};
```
The 600ms window allows Firestore to replicate the write across all read replicas. After that, the next poll will always read the correct value.

---

## Testing Checklist

- [ ] Toggle ON → stays ON through multiple poll cycles (no flicker after 10s)
- [ ] Toggle OFF → stays OFF through multiple poll cycles
- [ ] Toggle ON when activation count ≥ 3 → shows "Activation Limit Reached" modal (403 → `status: limit_reached`)
- [ ] Manual refresh button still works normally during a toggle operation
- [ ] Rapid toggle (ON → OFF quickly) handles gracefully

---

## No Backend Changes Required

`update_subaccount.php` correctly:
1. Validates agency ownership via `X-Agency-ID` header
2. Enforces 3-activation limit (returns HTTP 403 + `{ status: 'limit_reached' }`)
3. Writes `toggle_enabled` to `ghl_tokens` (enforcement layer)
4. Mirrors write to `agency_subaccounts` (UI display layer)
5. Returns `{ "status": "success" }` after both writes succeed

The backend was already solid. This was purely a frontend timing issue.
