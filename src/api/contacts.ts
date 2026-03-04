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
    
    // Handle response - could be array directly or { data: [], success: true }
    let contacts: any[] = [];
    if (Array.isArray(data)) {
      contacts = data;
    } else if (data.data && Array.isArray(data.data)) {
      contacts = data.data;
    } else if (data.contacts && Array.isArray(data.contacts)) {
      contacts = data.contacts;
    }
    
    console.log('Contacts fetched:', contacts.length);
    return contacts;
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return [];
  }
};
