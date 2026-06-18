export interface SenderRequest {
    id: string;
    location_id: string;
    requested_id: string;
    purpose?: string;
    sample_message?: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_note?: string;
    provider?: 'system' | 'semaphore' | 'unisms';
    provider_preference?: 'system' | 'semaphore' | 'semaphore_custom' | 'unisms' | 'unisms_custom';
    unisms_sender_id?: string;
    created_at?: string;
    location_name?: string;
}

export interface Account {
    id: string;
    location_id: string;
    location_name?: string;
    approved_sender_id?: string;
    nola_pro_api_key?: string;
    nola_pro_api_key_masked?: string;
    nola_pro_api_key_configured?: boolean;
    api_key?: string;
    semaphore_api_key?: string;
    semaphore_api_key_masked?: string;
    semaphore_api_key_configured?: boolean;
    unisms_api_key_masked?: string;
    unisms_api_key_configured?: boolean;
    unisms_sender_id?: string;
    provider?: 'system' | 'semaphore' | 'unisms';
    approved_provider?: 'system' | 'semaphore' | 'unisms';
    provider_preference?: 'system' | 'semaphore' | 'semaphore_custom' | 'unisms' | 'unisms_custom';
    credits?: number;
    credit_balance?: number;
    free_usage_count?: number;
    free_credits_total?: number;
}

export interface AdminLayoutProps {
    darkMode: boolean;
    toggleDarkMode: () => void;
}

