export interface SupportTicket {
    id: string;
    location_id: string;
    subject: string;
    message: string;
    status: 'open' | 'closed' | 'resolved' | 'pending';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    admin_note?: string;
    created_at: string;
    updated_at: string;
}
