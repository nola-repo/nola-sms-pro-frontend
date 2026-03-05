export interface SmsStats {
  totalSent: number;
  delivered: number;
  failed: number;
  lastSentAt: string;
}

export interface BulkMessageHistoryItem {
  id: string;
  message: string;
  recipientCount: number;
  recipientNames?: string[];
  recipientNumbers: string[];
  recipientKey: string;
  customName?: string;
  timestamp: string;
  status: 'sent' | 'partial' | 'failed';
  batchId?: string;
}

export interface SmsLog {
  message_id: string;
  numbers: string[];
  message: string;
  sender_id: string;
  status: string;
  date_created: string | { _seconds: number; _nanoseconds: number };
  source?: string;
  direction?: 'inbound' | 'outbound';
  batch_id?: string;
  recipient_key?: string;
}

export interface Message {
  id: string;
  text: string;
  timestamp: Date;
  senderName: string;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
}