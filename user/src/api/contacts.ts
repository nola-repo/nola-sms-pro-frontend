import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";
import { getSession } from "../services/authService";
import type { Contact } from "../types/Contact";

// Use the GHL contacts proxy endpoint (calls GoHighLevel API directly)
const CONTACTS_API_URL = API_CONFIG.ghl_contacts;

type JsonRecord = Record<string, unknown>;
type ErrorBody = JsonRecord | string | null;

export type FetchContactsResult =
  | { ok: true; contacts: Contact[] }
  | {
      ok: false;
      contacts: [];
      kind: 'reconnect' | 'other';
      message?: string;
      status: number;
    };

export class GhlReconnectError extends Error {
  status: number;

  constructor(message = 'GoHighLevel connection expired', status = 401) {
    super(message);
    this.name = 'GhlReconnectError';
    this.status = status;
    Object.setPrototypeOf(this, GhlReconnectError.prototype);
  }
}

export const isGhlReconnectError = (error: unknown): error is GhlReconnectError =>
  error instanceof GhlReconnectError;

const getAuthHeaders = (): Record<string, string> => {
  const session = getSession();
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJsonOrText = async (res: Response): Promise<ErrorBody> => {
  try {
    return await res.clone().json();
  } catch {
    try {
      const text = await res.clone().text();
      return text || null;
    } catch {
      return null;
    }
  }
};

const getErrorMessage = (body: ErrorBody, fallback: string): string => {
  if (typeof body === 'string') return body || fallback;
  if (!body) return fallback;
  const message = body.message;
  if (Array.isArray(message)) return message.map(String).join(', ');
  return String(message || body.details || body.error || fallback);
};

const isReconnectResponse = (status: number, body: ErrorBody): boolean =>
  status === 401 && isRecord(body) && body.requires_reconnect === true;

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
};

const getContactArray = (value: unknown): JsonRecord[] | null => {
  if (!Array.isArray(value)) return null;
  return value.filter(isRecord);
};

const normalizeContacts = (data: unknown): Contact[] => {
  // Handle various response formats:
  // - Array of contacts
  // - { data: [...] }
  // - { contacts: [...] }
  // - { data: { contacts: [...] } }
  let contacts: JsonRecord[] = [];
  const directContacts = getContactArray(data);
  if (directContacts) {
    contacts = directContacts;
  } else if (isRecord(data)) {
    const contactsField = getContactArray(data.contacts);
    const dataField = getContactArray(data.data);
    const nestedContacts = isRecord(data.data) ? getContactArray(data.data.contacts) : null;
    contacts = contactsField || dataField || nestedContacts || [];
  }

  // Normalize GHL raw contact format -> our Contact shape
  // GHL returns: contactName, firstName, lastName, phone, email, id
  // We need:     name, phone, email, id
  const normalized = contacts.map((c) => {
    const firstName = asString(c.firstName);
    const lastName = asString(c.lastName);
    const name = asString(c.name)
      || asString(c.contactName)
      || [firstName, lastName].filter(Boolean).join(' ').trim()
      || asString(c.firstNameRaw)
      || asString(c.phone)
      || 'Unknown';

    // Normalize phone to 09XXXXXXXXX format (aligned with send_sms.php clean_numbers)
    let phone = asString(c.phone || c.mobileNumber);
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (/^639\d{9}$/.test(digits)) phone = '0' + digits.slice(2);
      else if (/^9\d{9}$/.test(digits)) phone = '0' + digits;
      else if (/^09\d{9}$/.test(digits)) phone = digits;
      else phone = digits || phone;
    }

    return {
      id: c.id !== null && c.id !== undefined ? String(c.id) : String(Math.random()),
      name,
      phone,
      email: asString(c.email),
      ghl_contact_id: c.ghl_contact_id !== null && c.ghl_contact_id !== undefined ? String(c.ghl_contact_id) : undefined,
      lastMessage: c.lastMessage !== null && c.lastMessage !== undefined ? String(c.lastMessage) : undefined,
      lastSentAt: c.lastSentAt !== null && c.lastSentAt !== undefined ? String(c.lastSentAt) : undefined,
      tags: Array.isArray(c.tags) ? c.tags.map(String) : []
    };
  });

  return normalized;
};

export const fetchContactsMeta = async (explicitLocationId?: string): Promise<FetchContactsResult> => {
  try {
    const accountSettings = getAccountSettings();
    const locationId = explicitLocationId || accountSettings.ghlLocationId || null;

    if (!locationId) {
      console.warn('NOLA SMS: No locationId available for contacts fetch.');
      return { ok: false, contacts: [], kind: 'other', message: 'No linked GHL location', status: 400 };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-GHL-Location-ID': locationId,
      ...getAuthHeaders(),
    };

    // Send locationId as query param (primary) AND location_id as fallback, plus header
    const url = `${CONTACTS_API_URL}?locationId=${encodeURIComponent(locationId)}&location_id=${encodeURIComponent(locationId)}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const errorBody = await readJsonOrText(res);
      console.error('NOLA SMS: Contacts API error:', res.status, res.statusText, errorBody);

      if (isReconnectResponse(res.status, errorBody)) {
        return {
          ok: false,
          contacts: [],
          kind: 'reconnect',
          message: getErrorMessage(errorBody, 'GoHighLevel connection expired'),
          status: res.status,
        };
      }

      return {
        ok: false,
        contacts: [],
        kind: 'other',
        message: getErrorMessage(errorBody, 'Failed to load contacts'),
        status: res.status,
      };
    }

    const data = await res.json();
    return { ok: true, contacts: normalizeContacts(data) };
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return {
      ok: false,
      contacts: [],
      kind: 'other',
      message: error instanceof Error ? error.message : 'Failed to load contacts',
      status: 0,
    };
  }
};

export const fetchContacts = async (explicitLocationId?: string): Promise<Contact[]> => {
  const result = await fetchContactsMeta(explicitLocationId);
  return result.ok ? result.contacts : [];
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
      ...getAuthHeaders(),
    };

    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const url = accountSettings.ghlLocationId
      ? `${CONTACTS_API_URL}?location_id=${encodeURIComponent(accountSettings.ghlLocationId)}`
      : CONTACTS_API_URL;

    // Strip empty optional fields; GHL rejects email: "" with "email must be an email"
    const body: Record<string, string> = { name: params.name, phone: params.phone };
    if (params.email) body.email = params.email;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await readJsonOrText(res);
      console.error('Failed to add contact:', error);
      if (isReconnectResponse(res.status, error)) {
        throw new GhlReconnectError(getErrorMessage(error, 'GoHighLevel connection expired'), res.status);
      }
      throw new Error(getErrorMessage(error, 'Failed to add contact'));
    }

    const contact = await res.json();
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
      ...getAuthHeaders(),
    };

    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    const url = accountSettings.ghlLocationId
      ? `${CONTACTS_API_URL}?location_id=${encodeURIComponent(accountSettings.ghlLocationId)}`
      : CONTACTS_API_URL;

    // Strip empty optional fields; GHL rejects email: "" with "email must be an email"
    const body: Record<string, string> = { id: params.id, name: params.name, phone: params.phone };
    if (params.email) body.email = params.email;

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await readJsonOrText(res);
      console.error('Failed to update contact:', error);
      if (isReconnectResponse(res.status, error)) {
        throw new GhlReconnectError(getErrorMessage(error, 'GoHighLevel connection expired'), res.status);
      }
      throw new Error(getErrorMessage(error, 'Failed to update contact'));
    }

    const contact = await res.json();
    return contact;
  } catch (error) {
    console.error('Failed to update contact:', error);
    throw error;
  }
};

export const deleteContact = async (id: string): Promise<boolean> => {
  try {
    const accountSettings = getAccountSettings();
    const headers: Record<string, string> = { ...getAuthHeaders() };

    if (accountSettings.ghlLocationId) {
      headers['X-GHL-Location-ID'] = accountSettings.ghlLocationId;
    }

    let url = `${CONTACTS_API_URL}?id=${encodeURIComponent(id)}`;
    if (accountSettings.ghlLocationId) {
      url += `&location_id=${encodeURIComponent(accountSettings.ghlLocationId)}`;
    }

    const res = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const error = await readJsonOrText(res);
      console.error('Failed to delete contact:', error);
      if (isReconnectResponse(res.status, error)) {
        throw new GhlReconnectError(getErrorMessage(error, 'GoHighLevel connection expired'), res.status);
      }
      throw new Error(getErrorMessage(error, 'Failed to delete contact'));
    }

    return true;
  } catch (error) {
    console.error('Failed to delete contact:', error);
    throw error;
  }
};
