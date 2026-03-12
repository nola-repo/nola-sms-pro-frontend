import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CreditTransaction {
    transaction_id: string;
    account_id: string;
    type: 'deduction' | 'top_up' | 'refund' | 'manual_adjustment';
    amount: number;         // negative for deductions, positive for credits
    balance_after: number;
    reference_id?: string;
    description: string;
    created_at: string;     // ISO 8601 timestamp
}

// ─── API Calls ───────────────────────────────────────────────────────────────

/**
 * Fetch the current credit balance from the internal proxy.
 * Returns 0 on failure to allow graceful degradation.
 */
export async function fetchCreditBalance(): Promise<number> {
    try {
        const accountSettings = getAccountSettings();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (accountSettings.ghlLocationId) {
            headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
        }

        let url = API_CONFIG.credits;
        if (accountSettings.ghlLocationId) {
            url += `?location_id=${encodeURIComponent(accountSettings.ghlLocationId)}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) return 0;
        const data = await res.json();
        return data.credit_balance ?? data.balance ?? data.data?.balance ?? 0;
    } catch {
        return 0;
    }
}

/**
 * Fetch the credit transaction ledger.
 * Returns an empty array on failure.
 */
export async function fetchCreditTransactions(
    accountId = 'default',
    limit = 50,
): Promise<CreditTransaction[]> {
    try {
        const accountSettings = getAccountSettings();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (accountSettings.ghlLocationId) {
            headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
        }

        let url = `${API_CONFIG.base}/api/get_credit_transactions?account_id=${encodeURIComponent(accountId)}&limit=${limit}`;
        if (accountSettings.ghlLocationId) {
            url += `&location_id=${encodeURIComponent(accountSettings.ghlLocationId)}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        const data = await res.json();

        // Accept { transactions: [...] } or a bare array
        if (Array.isArray(data)) return data as CreditTransaction[];
        if (Array.isArray(data.transactions)) return data.transactions as CreditTransaction[];
        if (Array.isArray(data.data)) return data.data as CreditTransaction[];
        return [];
    } catch {
        return [];
    }
}
