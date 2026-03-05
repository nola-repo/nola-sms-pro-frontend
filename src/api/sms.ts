import type { SmsLog } from "../types/Sms";

const WEBHOOK_URL = "/api/messages";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export type SenderId = string;

interface SendSmsResponse {
  success?: boolean;
  message?: string;
  error?: string;
  status?: string;
  number?: string;
}

/**
 * Normalize Philippine phone numbers to 09XXXXXXXXX
 * This matches the backend's clean_numbers function
 */
const normalizePHNumber = (input: string): string | null => {
  if (!input) return null;

  const digits = input.replace(/\D/g, "");

  // 09XXXXXXXXX → valid
  if (digits.startsWith("09") && digits.length === 11) {
    return digits;
  }

  // 9XXXXXXXXX → 09XXXXXXXXX
  if (digits.startsWith("9") && digits.length === 10) {
    return "0" + digits;
  }

  // 639XXXXXXXXX → 09XXXXXXXXX
  if (digits.startsWith("639") && digits.length === 12) {
    return "0" + digits.substring(2);
  }

  // +639XXXXXXXXX (already digits only)
  if (digits.startsWith("639") && digits.length === 12) {
    return "0" + digits.substring(2);
  }

  return null;
};

const isValidPHNumber = (number: string): boolean => {
  return /^09\d{9}$/.test(number);
};

export const fetchSmsLogs = async (phoneNumber: string): Promise<SmsLog[]> => {
  const formattedNumber = normalizePHNumber(phoneNumber);
  if (!formattedNumber) return [];

  try {
    // Fetch ALL outbound messages (without number filter)
    // Then filter client-side by checking if phoneNumber is in the numbers array
    const res = await fetch(`${WEBHOOK_URL}?direction=outbound&limit=500`, {
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
    });
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
  contactName?: string
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
    },
  };

  console.log("Sending SMS to new backend:", payload);
  console.log("Sending to:", WEBHOOK_URL);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
      },
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
  contacts: { phone: string, name: string }[] = []
): Promise<{ results: SendSmsResponse[], batchId: string }> => {
  const results: SendSmsResponse[] = [];
  const batchId = `batch-${Date.now()}`;

  for (const phone of phoneNumbers) {
    const contact = contacts.find(c => normalizePHNumber(c.phone) === normalizePHNumber(phone));
    const result = await sendSms(phone, message, senderName, batchId, contact?.name);
    results.push(result);
  }

  return { results, batchId };
};

export const fetchBatchMessages = async (batchId: string): Promise<SmsLog[]> => {
  if (!batchId) return [];

  try {
    const res = await fetch(`${WEBHOOK_URL}?batch_id=${batchId}&limit=500`, {
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
    });
    if (!res.ok) throw new Error("Failed to fetch batch messages");
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.error("Fetch Batch Error:", error);
    return [];
  }
};
