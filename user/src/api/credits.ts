import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";
import { fetchCachedJson, type QueryKeyParts } from "../utils/queryCache";

export interface CreditStatus {
    credit_balance: number;
    free_usage_count: number;
    free_credits_total: number;
    currency: string;
    stats?: {
        sent_today: number;
        credits_used_today: number;
        credits_used_month: number;
    };
}

export interface CreditTransaction {
    transaction_id: string;
    account_id: string;
    type: 'deduction' | 'top_up' | 'refund' | 'manual_adjustment' | 'admin_adjustment' | 'agency_adjustment' | 'credit_purchase';
    amount: number;
    balance_after: number;
    reference_id?: string;
    description: string;
    created_at: string;
}

export interface CreditPackage {
    credits: number;
    price: number;
    link: string;
}

const CREDIT_STATUS_CACHE_TTL_MS = 30 * 1000;
const CREDIT_TRANSACTIONS_CACHE_TTL_MS = 60 * 1000;

const creditCacheKey = (locationId: string | null, resource: string, filtersHash = "default"): QueryKeyParts => ({
    role: 'user',
    locationId: locationId || "global",
    resource,
    filtersHash,
});

const normalizeCreditStatus = (data: any): CreditStatus => ({
    credit_balance: data.credit_balance ?? data.balance ?? data.data?.balance ?? 0,
    free_usage_count: data.free_usage_count ?? 0,
    free_credits_total: data.free_credits_total ?? 0,
    currency: data.currency ?? 'PHP',
    stats: data.stats,
});

const normalizeTransactions = (data: any): CreditTransaction[] => {
    if (Array.isArray(data)) return data as CreditTransaction[];
    if (Array.isArray(data.transactions)) return data.transactions as CreditTransaction[];
    if (Array.isArray(data.data)) return data.data as CreditTransaction[];
    return [];
};

export async function fetchCreditStatus(
    explicitLocationId?: string,
    options: { forceRefresh?: boolean } = {},
): Promise<CreditStatus | null> {
    try {
        const accountSettings = getAccountSettings();
        const locationId = explicitLocationId || accountSettings.ghlLocationId || null;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (locationId) {
            headers['X-GHL-Location-ID'] = locationId;
        }

        const params = new URLSearchParams();
        if (options.forceRefresh) params.set("fresh", "1");
        if (locationId) params.set("location_id", locationId);
        const query = params.toString();
        const url = query ? `${API_CONFIG.credits}?${query}` : API_CONFIG.credits;

        const entry = await fetchCachedJson<CreditStatus>({
            key: creditCacheKey(locationId, 'credits'),
            url,
            init: { headers },
            ttlMs: CREDIT_STATUS_CACHE_TTL_MS,
            forceRefresh: options.forceRefresh,
            parse: normalizeCreditStatus,
        });

        return entry.data;
    } catch {
        return null;
    }
}

export async function fetchCreditBalance(explicitLocationId?: string): Promise<number> {
    const status = await fetchCreditStatus(explicitLocationId);
    return status?.credit_balance ?? 0;
}

export async function fetchCreditTransactions(
    accountId = 'default',
    limit = 50,
    explicitLocationId?: string,
    month?: string,
    options: { forceRefresh?: boolean } = {},
): Promise<CreditTransaction[]> {
    try {
        const accountSettings = getAccountSettings();
        const locationId = explicitLocationId || accountSettings.ghlLocationId || null;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (locationId) {
            headers['X-GHL-Location-ID'] = locationId;
        }

        let url = `${API_CONFIG.base}/api/get_credit_transactions?account_id=${encodeURIComponent(accountId)}&limit=${limit}`;
        if (locationId) url += `&location_id=${encodeURIComponent(locationId)}`;
        if (month) url += `&month=${encodeURIComponent(month)}`;
        if (options.forceRefresh) url += '&refresh=1';

        const entry = await fetchCachedJson<CreditTransaction[]>({
            key: creditCacheKey(locationId, 'transactions', `${accountId}:${limit}:${month || 'all'}`),
            url,
            init: { headers },
            ttlMs: CREDIT_TRANSACTIONS_CACHE_TTL_MS,
            forceRefresh: options.forceRefresh,
            parse: normalizeTransactions,
        });

        return entry.data;
    } catch {
        return [];
    }
}

export async function fetchCreditPackages(): Promise<CreditPackage[]> {
    return [
        { credits: 10, price: 10, link: "https://nolasmspro.com/nola-sms-pro-10-credits" },
        { credits: 500, price: 500, link: "https://nolasmspro.com/nola-sms-pro-500-credits" },
        { credits: 1100, price: 1000, link: "https://nolasmspro.com/nola-sms-pro-1100-credits" },
        { credits: 2750, price: 2500, link: "https://nolasmspro.com/nola-sms-pro-2750-credits" },
        { credits: 6000, price: 5000, link: "https://nolasmspro.com/nola-sms-pro-6000-credits" },
    ];
}
