# Consolidated Backend Handoff: Credit & SMS Billing System

This document outlines the standardization requirements for the backend team to ensure the "Free Trial" and "Credit Management" features are fully functional and correctly displayed in the Frontend (User, Agency, and Admin panels).

---

## 1. Credit Logging Standard (Ledger / Transactions)

To ensure the UI correctly identifies "Free Trial" versus "Paid" usage, please follow this format for the `ledger` table and related API responses.

### 1.1 Free Trial Event (Quota Deduction)
When a user on a Free Trial sends an SMS and it consumes their free quota:
- **`type`**: `deduction` (or `credit_usage`)
- **`amount`**: `0` (This is the critical signal)
- **`description`**: "SMS Message to 09XXXXXXXXX"
- **Result**: The UI will display **"−1 free trial"** and label it as **"Free Trial Used"**.

### 1.2 Paid Credit Usage
- **`type`**: `deduction`
- **`amount`**: `-1` (or negative cost)
- **Result**: The UI will display **"−1 credits"** and label it as **"Credits Used"**.

### 1.3 Credit Purchase (Top-Up)
- **`type`**: `top_up` (or `credit_purchase`)
- **`amount`**: `1000` (Positive integer)
- **Result**: The UI will display **"+1,000 credits"** (Green) and label it as **"Credits Purchased"**.

> [!CAUTION]
> Avoid logging Free Trial events with `type=top_up` and `amount=0`. This causes the Admin UI to show "Credits Purchased: +0", which is confusing for account management.

---

## 2. Agency Panel Requirements (`api/agency/`)

### 2.1 `get_subaccounts.php` Update
The Frontend now includes a **"Credits"** column and a **"Total Credits"** summary card.
- **Requirement**: Each subaccount object in the `subaccounts` array must now include a `credit_balance` (or `credits`) field.
- **Current Status**: Missing. Please add this field by joining the `integrations`/`credits` table or retrieving it from the subaccount metadata.

---

## 3. Admin Panel Requirements (`api/admin_sender_requests.php`)

### 3.1 Metadata Fields
Ensure all accounts return the following fields for the multi-tier billing UI:
- `credit_balance` (number): Current paid credit balance.
- `free_usage_count` (number): How many free messages have been used.
- `free_credits_total` (number): The total limit of the free trial (usually 10).
- `approved_sender_id` (string): The active Sender ID.

### 3.2 Revocation Logic
When an admin revokes a Sender ID:
- **Requirement**: Clear the `approved_sender_id` and `semaphore_api_key` in the `integrations` collection. The account should fall back to the "System" default automatically.

---
*Status: Ready for Implementation*
*Standard Version: 2.0 (Three-Tier Billing Alignment)*
