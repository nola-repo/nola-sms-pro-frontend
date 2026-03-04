import type { Contact } from "../types/Contact";

const CONTACTS_API_URL = "/api/contacts";

export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    const res = await fetch(CONTACTS_API_URL);
    
    if (!res.ok) {
      console.error('Contacts API returned error:', res.status, res.statusText);
      return [];
    }
    
    const data = await res.json();
    
    // Handle response
    let contacts: any[] = [];
    if (Array.isArray(data)) {
      contacts = data;
    } else if (data.data && Array.isArray(data.data)) {
      contacts = data.data;
    }
    
    console.log('Contacts fetched:', contacts.length);
    return contacts;
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return [];
  }
};
