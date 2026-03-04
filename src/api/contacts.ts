import type { Contact } from "../types/Contact";

const CONTACTS_API_URL = "/api/contacts";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    const res = await fetch(CONTACTS_API_URL, {
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
    });
    
    if (!res.ok) {
      console.error('Contacts API returned error:', res.status, res.statusText);
      return [];
    }
    
    const data = await res.json();
    
    if (!Array.isArray(data)) {
      console.log('Invalid contacts response:', data);
      return [];
    }
    
    console.log('Contacts fetched:', data.length);
    return data;
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return [];
  }
};
