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
        const res = await fetch('/api/credits');
        if (!res.ok) return 0;
        const data = await res.json();
        return data.balance ?? data.data?.balance ?? 0;
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
        const res = await fetch(
            `/api/get_credit_transactions?account_id=${encodeURIComponent(accountId)}&limit=${limit}`
        );
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
