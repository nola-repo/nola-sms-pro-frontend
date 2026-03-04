import type { SmsLog } from "../types/Sms";

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
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
    // Use Cloud Run directly
    const res = await fetch(`${CLOUD_RUN_URL}/webhook/messages?direction=outbound&number=${formattedNumber}&limit=100`, {
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET,
        'Origin': 'https://nola-sms-pro.vercel.app',
      },
    });
    if (!res.ok) throw new Error("Failed to fetch message history");
    const data = await res.json();
    console.log('SMS Logs Response:', data);
    return data.data || [];
  } catch (error) {
    console.error("Fetch Logs Error:", error);
    return [];
  }
};

export const sendSms = async (
  phoneNumber: string,
  message: string,
  senderName: string = "NOLACRM"
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
    },
  };

  console.log("Sending SMS to new backend:", payload);
    console.log("Sending to:", CLOUD_RUN_URL + "/webhook/send_sms");

  try {
    const res = await fetch(CLOUD_RUN_URL + "/webhook/send_sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
        "Origin": "https://nola-sms-pro.vercel.app",
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
  senderName: string = "NOLACRM"
): Promise<SendSmsResponse[]> => {
  const results: SendSmsResponse[] = [];

  for (const phone of phoneNumbers) {
    const result = await sendSms(phone, message, senderName);
    results.push(result);
  }

  return results;
};
