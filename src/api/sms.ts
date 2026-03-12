import type { SmsLog, BulkMessageHistoryItem, FirestoreMessage, Conversation } from "../types/Sms";

import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";

const WEBHOOK_URL = API_CONFIG.messages;

export type SenderId = string;

interface SendSmsResponse {
  success?: boolean;
  message?: string;
  error?: string;
  status?: string;
  number?: string;
}

import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Normalize Philippine phone numbers to 09XXXXXXXXX
 * using google-libphonenumber for accurate parsing
 */
export const normalizePHNumber = (input: string): string | null => {
  if (!input) return null;

  try {
    // Parse the number, defaulting to 'PH' region if country code is missing
    const parsedNumber = phoneUtil.parseAndKeepRawInput(input, 'PH');
    
    // Check if it's a valid number
    if (!phoneUtil.isValidNumber(parsedNumber)) {
      return null;
    }

    // Format to E.164 (+639XXXXXXXXX)
    const e164 = phoneUtil.format(parsedNumber, PhoneNumberFormat.E164);
    
    // NOLA SMS Pro backend expects the format 09XXXXXXXXX
    if (e164.startsWith('+63')) {
      return '0' + e164.substring(3);
    }
    
    // Fallback if not a PH number (might not be reachable, but formatted)
    // You could also enforce PH only by checking parsedNumber.getCountryCode() === 63
    return e164;
  } catch (error) {
    // Parsing error (e.g. invalid characters not handled by libphonenumber)
    return null;
  }
};

const isValidPHNumber = (input: string): boolean => {
  if (!input) return false;
  try {
    const parsedNumber = phoneUtil.parseAndKeepRawInput(input, 'PH');
    return phoneUtil.isValidNumber(parsedNumber);
  } catch (error) {
    return false;
  }
};

export const fetchSmsLogs = async (phoneNumber: string): Promise<SmsLog[]> => {
  const formattedNumber = normalizePHNumber(phoneNumber);
  if (!formattedNumber) return [];

  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    // Fetch ALL outbound messages (without number filter)
    // Then filter client-side by checking if phoneNumber is in the numbers array
    const res = await fetch(`${WEBHOOK_URL}?direction=outbound&limit=500`, { headers });
    if (!res.ok) throw new Error("Failed to fetch message history");
    const data = await res.json();
    console.log('SMS Logs Response:', data);

    // Filter messages client-side - only include messages where the phone number is in the numbers array
    const allMessages: SmsLog[] = data.data || [];

    // Debug: show what we're comparing
    console.log(`🔍 Looking for contact number: ${formattedNumber}`);
    console.log(`📦 Total messages from API: ${allMessages.length}`);
    allMessages.forEach((log, i) => {
      const rawNumbers = log.numbers || [];
      const normalizedNumbers = rawNumbers.map(n => normalizePHNumber(n)).filter(Boolean);
      const match = normalizedNumbers.includes(formattedNumber);
      console.log(`  Message ${i + 1}: "${log.message?.substring(0, 30)}..." | raw numbers: [${rawNumbers.join(', ')}] → normalized: [${normalizedNumbers.join(', ')}] | match: ${match ? '✅' : '❌'}`);
    });

    const filteredMessages = allMessages.filter(log => {
      const normalizedNumbers = (log.numbers || []).map(n => normalizePHNumber(n)).filter(Boolean);
      return normalizedNumbers.includes(formattedNumber);
    });

    console.log(`✅ Filtered messages for ${formattedNumber}: ${filteredMessages.length} found`);
    return filteredMessages;
  } catch (error) {
    console.error("Fetch Logs Error:", error);
    return [];
  }
};

export const sendSms = async (
  phoneNumber: string,
  message: string,
  senderName: string = "NOLACRM",
  batchId?: string,
  contactName?: string,
  recipientKey?: string
): Promise<SendSmsResponse> => {
  if (!phoneNumber || !message) {
    return {
      success: false,
      message: "Phone number and message are required",
    };
  }

  const formattedNumber = normalizePHNumber(phoneNumber);

  if (!formattedNumber || !isValidPHNumber(formattedNumber)) {
    return {
      success: false,
      message: "Invalid Philippine mobile number",
    };
  }

  const payload = {
    customData: {
      number: formattedNumber,
      message: message,
      sendername: senderName,
      batch_id: batchId,
      name: contactName,
      recipient_key: recipientKey,
    },
  };

  const SEND_SMS_URL = API_CONFIG.sms;
  console.log("Sending SMS payload via proxy:", payload);
  console.log("Sending to:", SEND_SMS_URL);

  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(SEND_SMS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    console.log("SMS API Response:", data);

    if (data?.status === "error" || data?.status === "failed") {
      return {
        success: false,
        message: data.message || "SMS sending failed",
      };
    }

    return {
      success: true,
      message: data.message || "Message sent successfully",
    };
  } catch (error) {
    console.error("SMS Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "SMS failed",
    };
  }
};

export const sendBulkSms = async (
  phoneNumbers: string[],
  message: string,
  senderName: string = "NOLACRM",
  contacts: { phone: string, name: string }[] = [],
  recipientKey?: string,
  existingBatchId?: string
): Promise<{ results: SendSmsResponse[], batchId: string }> => {
  const results: SendSmsResponse[] = [];
  // Use existing batchId if provided, otherwise create a new one
  const batchId = existingBatchId || `batch-${Date.now()}`;

  for (const phone of phoneNumbers) {
    const contact = contacts.find(c => normalizePHNumber(c.phone) === normalizePHNumber(phone));
    const result = await sendSms(phone, message, senderName, batchId, contact?.name, recipientKey);
    results.push(result);
  }

  return { results, batchId };
};

export const fetchBatchMessages = async (batchId: string): Promise<SmsLog[]> => {
  if (!batchId) return [];

  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(`${WEBHOOK_URL}?batch_id=${batchId}&limit=500`, { headers });
    if (!res.ok) throw new Error("Failed to fetch batch messages");
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.error("Fetch Batch Error:", error);
    return [];
  }
};

/**
 * Fetch messages for a single conversation (direct or bulk) by conversation_id.
 * This is the primary way to load chat history – avoids bulk mixing.
 * Direct:  conversation_id = conv_09XXXXXXXXX
 * Bulk:    conversation_id = group_batch_xxx
 */
export const fetchMessagesByConversationId = async (
  conversationId: string,
  limit = 100,
  recipientKey?: string
): Promise<FirestoreMessage[]> => {
  if (!conversationId) return [];

  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    let url = `${API_CONFIG.messages}?conversation_id=${encodeURIComponent(conversationId)}&limit=${limit}`;

    // If recipientKey is provided, we're isolating a single user's history within a bulk campaign
    if (recipientKey) {
      url += `&recipient_key=${encodeURIComponent(recipientKey)}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to fetch conversation messages: ${res.status}`);
    const data = await res.json();
    return (data.data || data || []) as FirestoreMessage[];
  } catch (error) {
    console.error('[fetchMessagesByConversationId] Error:', error);
    return [];
  }
};

/**
 * Fetch all conversation metadata from the `conversations` Firestore collection.
 * Used by Sidebar to build the direct/bulk message list from server state.
 */
export const fetchConversations = async (): Promise<Conversation[]> => {
  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const CONVERSATIONS_URL = API_CONFIG.conversations;
    const res = await fetch(CONVERSATIONS_URL, { headers });
    if (!res.ok) throw new Error(`Failed to fetch conversations: ${res.status}`);
    const data = await res.json();
    // Data may be { data: [...] } or a plain array or { conversations: [...] }
    return (Array.isArray(data) ? data : (data.data || data.conversations || [])) as Conversation[];
  } catch (error) {
    console.error('[fetchConversations] Error:', error);
    return [];
  }
};

// Fetch messages by recipient_key (conversation key)
export const fetchMessagesByRecipientKey = async (recipientKey: string): Promise<SmsLog[]> => {
  if (!recipientKey) return [];

  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(`${WEBHOOK_URL}?recipient_key=${encodeURIComponent(recipientKey)}&limit=500`, { headers });
    if (!res.ok) throw new Error("Failed to fetch messages by recipient_key");
    const data = await res.json();
    // Handle both array response and {data: [...]} response
    return Array.isArray(data) ? data : (data.data || []);
  } catch (error) {
    console.error("Fetch by Recipient Key Error:", error);
    return [];
  }
};

// Fetch all bulk messages from Firestore (grouped by batch)
export const fetchAllBulkMessages = async (): Promise<BulkMessageHistoryItem[]> => {
  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const BULK_CAMPAIGNS_URL = API_CONFIG.bulk_campaigns;
    const res = await fetch(BULK_CAMPAIGNS_URL, { headers });
    console.log('[fetchAllBulkMessages] Response status:', res.status);
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[fetchAllBulkMessages] Error response:', errorText);
      throw new Error(`Failed to fetch bulk messages: ${res.status}`);
    }
    const resData = await res.json();
    console.log('[fetchAllBulkMessages] Data received:', resData);

    // Handle both array and { data: [...] } format
    const messages = Array.isArray(resData) ? resData : (resData.data || []);

    // Convert to BulkMessageHistoryItem format
    return messages.map((item: any) => ({
      id: `bulk-db-${item.batch_id}`,
      message: item.message || '',
      recipientCount: item.recipientCount || 0,
      recipientNumbers: item.recipientNumbers || [],
      recipientKey: item.batch_id,
      timestamp: item.timestamp || new Date().toISOString(),
      status: 'sent' as const,
      batchId: item.batch_id,
      fromDatabase: true,
    }));
  } catch (error) {
    console.error("[fetchAllBulkMessages] Error:", error);
    return [];
  }
};
/**
 * Rename a conversation (bulk or direct) in the backend.
 */
export const renameConversation = async (conversationId: string, newName: string): Promise<boolean> => {
  if (!conversationId || !newName) return false;

  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(API_CONFIG.messages, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ id: conversationId, name: newName }),
    });

    if (!res.ok) throw new Error(`Failed to rename conversation: ${res.status}`);
    return true;
  } catch (error) {
    console.error('[renameConversation] Error:', error);
    return false;
  }
};

/**
 * Delete a conversation (bulk or direct) in the backend.
 */
export const deleteConversation = async (conversationId: string): Promise<boolean> => {
  if (!conversationId) return false;

  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};
    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(`${API_CONFIG.messages}?conversation_id=${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) throw new Error(`Failed to delete conversation: ${res.status}`);
    return true;
  } catch (error) {
    console.error('[deleteConversation] Error:', error);
    return false;
  }
};
