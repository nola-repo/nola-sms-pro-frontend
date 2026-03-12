import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";
import type { Contact } from "../types/Contact";

const CONTACTS_API_URL = API_CONFIG.contacts;

export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    // 1. Detect locationId from URL params (GHL may send either key)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLocationId =
      urlParams.get('locationId') ||
      urlParams.get('location_id');

    // 2. Fall back to saved settings if URL doesn't have it
    const accountSettings = getAccountSettings();
    const locationId = urlLocationId || accountSettings.ghlLocationId || null;

    console.log('NOLA SMS: Detected GHL Location:', locationId);

    if (!locationId) {
      console.warn('NOLA SMS: No locationId detected in URL.');
      return [];
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-GHL-Location-ID': locationId,
    };

    // 3. Send locationId as a query param AND as a header
    const url = `${CONTACTS_API_URL}?locationId=${encodeURIComponent(locationId)}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error('NOLA SMS: Contacts API error:', res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    console.log('NOLA SMS: Contacts API response:', data);

    // Handle various response formats: 
    // - Array of contacts
    // - { data: [...] }
    // - { contacts: [...] }
    // - { data: { contacts: [...] } }
    let contacts: any[] = [];
    if (Array.isArray(data)) {
      contacts = data;
    } else if (data.contacts && Array.isArray(data.contacts)) {
      contacts = data.contacts;
    } else if (data.data && Array.isArray(data.data)) {
      contacts = data.data;
    } else if (data.data?.contacts && Array.isArray(data.data.contacts)) {
      contacts = data.data.contacts;
    }

    console.log('Contacts fetched:', contacts.length);
    return contacts;
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return [];
  }
};

export interface AddContactParams {
  name: string;
  phone: string;
  email?: string;
}

export const addContact = async (params: AddContactParams): Promise<Contact | null> => {
  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(CONTACTS_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('Failed to add contact:', error);
      // Return error details for display
      throw new Error(error.details || error.error || 'Failed to add contact');
    }

    const contact = await res.json();
    console.log('Contact added:', contact);
    return contact;
  } catch (error) {
    console.error('Failed to add contact:', error);
    throw error;
  }
};

export interface UpdateContactParams {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export const updateContact = async (params: UpdateContactParams): Promise<Contact | null> => {
  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(CONTACTS_API_URL, {
      method: 'PUT',
      headers,
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('Failed to update contact:', error);
      throw new Error(error.details || error.error || 'Failed to update contact');
    }

    const contact = await res.json();
    console.log('Contact updated:', contact);
    return contact;
  } catch (error) {
    console.error('Failed to update contact:', error);
    throw error;
  }
};

export const deleteContact = async (id: string): Promise<boolean> => {
  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = {};

    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const res = await fetch(`${CONTACTS_API_URL}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('Failed to delete contact:', error);
      throw new Error(error.details || error.error || 'Failed to delete contact');
    }

    console.log('Contact deleted:', id);
    return true;
  } catch (error) {
    console.error('Failed to delete contact:', error);
    throw error;
  }
};
