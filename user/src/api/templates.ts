import { devLog } from '../utils/devLog';
import { API_CONFIG } from "../config";
import { getAccountSettings } from "../utils/settingsStorage";
import { getAuthHeaders } from "../utils/authHeaders";
import type { Template } from "../types/Template";
import { getCachedTemplates, setCachedTemplates, invalidateTemplateCache } from "../utils/templateCache";
import { apiFetch } from "../utils/apiFetch";

const API_URL = API_CONFIG.templates;
const DEFAULT_CATEGORY = "General";

const getHeaders = (explicitLocationId?: string) => {
  const accountSettings = getAccountSettings();
  const locationId = explicitLocationId || accountSettings.ghlLocationId || null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
  if (locationId) {
    headers['X-GHL-Location-ID'] = locationId;
  }
  return headers;
};

const normalizeTemplate = (raw: any): Template => ({
  id: String(raw?.id ?? raw?.template_id ?? `tpl-${Date.now()}`),
  location_id: String(raw?.location_id ?? raw?.locationId ?? getAccountSettings().ghlLocationId ?? ""),
  name: String(raw?.name ?? ""),
  content: String(raw?.content ?? raw?.message ?? ""),
  category: String(raw?.category ?? DEFAULT_CATEGORY),
  created_at: String(raw?.created_at ?? raw?.createdAt ?? new Date().toISOString()),
  updated_at: String(raw?.updated_at ?? raw?.updatedAt ?? new Date().toISOString()),
});

const unwrapTemplateList = (payload: any): Template[] => {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.templates)
        ? payload.templates
        : Array.isArray(payload?.data?.templates)
          ? payload.data.templates
          : [];

  return rawList.map(normalizeTemplate);
};

const unwrapTemplate = (payload: any): Template => {
  const raw = payload?.data && !Array.isArray(payload.data)
    ? payload.data
    : payload?.template
      ? payload.template
      : payload;
  return normalizeTemplate(raw);
};

export const fetchTemplates = async (explicitLocationId?: string, forceRefresh = false): Promise<Template[]> => {
  const accountSettings = getAccountSettings();
  const locationId = explicitLocationId || accountSettings.ghlLocationId || undefined;
  if (!locationId) return [];

  if (!forceRefresh) {
    const cached = getCachedTemplates(locationId);
    if (cached) return cached;
  }

  try {
    let url = API_URL;
    if (locationId) {
      url += `?location_id=${encodeURIComponent(locationId)}`;
    }

    const res = await apiFetch(url, { headers: getHeaders(locationId) });
    
    // Handle mock mode for when backend doesn't exist yet
    if (res.status === 404) {
      devLog.warn('NOLA SMS: Templates backend not available yet (404)');
      // Return mock data for UI testing if the user is testing the UI before backend is ready
      const mockStr = localStorage.getItem('nola_mock_templates');
      const result = mockStr ? JSON.parse(mockStr) : [];
      setCachedTemplates(locationId, result);
      return result;
    }
    
    if (!res.ok) {
      throw new Error(`Error fetching templates: ${res.statusText}`);
    }
    const result = unwrapTemplateList(await res.json());
    setCachedTemplates(locationId, result);
    return result;
  } catch (error) {
    devLog.error('Failed to fetch templates:', error);
    const mockStr = localStorage.getItem('nola_mock_templates');
    const result = mockStr ? JSON.parse(mockStr) : [];
    setCachedTemplates(locationId, result);
    return result;
  }
};

export const createTemplate = async (name: string, content: string, category: string = DEFAULT_CATEGORY): Promise<Template> => {
  const activeLocationId = getAccountSettings().ghlLocationId || undefined;
  try {
    const res = await apiFetch(API_URL, {
      method: 'POST',
      headers: getHeaders(activeLocationId),
      body: JSON.stringify({ name, content, category }),
    });
    
    invalidateTemplateCache(activeLocationId);

    if (res.status === 404) {
      // Mock logic for local testing before backend is ready
      const mockStr = localStorage.getItem('nola_mock_templates');
      const templates: Template[] = mockStr ? JSON.parse(mockStr) : [];
      const newTemp: Template = {
        id: `mock-${Date.now()}`,
        location_id: activeLocationId || '',
        name,
        content,
        category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      templates.push(newTemp);
      localStorage.setItem('nola_mock_templates', JSON.stringify(templates));
      return newTemp;
    }
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create template');
    }
    return unwrapTemplate(await res.json());
  } catch (error: any) {
    invalidateTemplateCache(activeLocationId);
    // Mock logic fallback
    if (error.message === 'Failed to fetch') {
      const mockStr = localStorage.getItem('nola_mock_templates');
      const templates: Template[] = mockStr ? JSON.parse(mockStr) : [];
      const newTemp: Template = {
        id: `mock-${Date.now()}`,
        location_id: activeLocationId || '',
        name,
        content,
        category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      templates.push(newTemp);
      localStorage.setItem('nola_mock_templates', JSON.stringify(templates));
      return newTemp;
    }
    throw error;
  }
};

export const updateTemplate = async (id: string, name: string, content: string, category: string = DEFAULT_CATEGORY): Promise<Template> => {
  const activeLocationId = getAccountSettings().ghlLocationId || undefined;
  try {
    const res = await apiFetch(API_URL, {
      method: 'PUT',
      headers: getHeaders(activeLocationId),
      body: JSON.stringify({ id, name, content, category }),
    });
    
    invalidateTemplateCache(activeLocationId);

    if (res.status === 404) {
      const mockStr = localStorage.getItem('nola_mock_templates');
      let templates: Template[] = mockStr ? JSON.parse(mockStr) : [];
      let updated: Template | null = null;
      templates = templates.map(t => {
        if (t.id === id) {
          updated = { ...t, name, content, category, updated_at: new Date().toISOString() };
          return updated;
        }
        return t;
      });
      localStorage.setItem('nola_mock_templates', JSON.stringify(templates));
      if (!updated) throw new Error('Mock template not found');
      return updated;
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to update template');
    }
    return unwrapTemplate(await res.json());
  } catch (error: any) {
    invalidateTemplateCache(activeLocationId);
    // Mock logic fallback
    if (error.message === 'Failed to fetch') {
      const mockStr = localStorage.getItem('nola_mock_templates');
      let templates: Template[] = mockStr ? JSON.parse(mockStr) : [];
      let updated: Template | null = null;
      templates = templates.map(t => {
        if (t.id === id) {
          updated = { ...t, name, content, category, updated_at: new Date().toISOString() };
          return updated;
        }
        return t;
      });
      localStorage.setItem('nola_mock_templates', JSON.stringify(templates));
      if (!updated) throw new Error('Mock template not found');
      return updated;
    }
    throw error;
  }
};

export const deleteTemplate = async (id: string): Promise<void> => {
  const activeLocationId = getAccountSettings().ghlLocationId || undefined;
  try {
    const res = await apiFetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(activeLocationId),
    });
    
    invalidateTemplateCache(activeLocationId);

    if (res.status === 404) {
      const mockStr = localStorage.getItem('nola_mock_templates');
      let templates: Template[] = mockStr ? JSON.parse(mockStr) : [];
      templates = templates.filter(t => t.id !== id);
      localStorage.setItem('nola_mock_templates', JSON.stringify(templates));
      return;
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to delete template');
    }
  } catch (error: any) {
    invalidateTemplateCache(activeLocationId);
    // Mock logic fallback
    if (error.message === 'Failed to fetch') {
      const mockStr = localStorage.getItem('nola_mock_templates');
      let templates: Template[] = mockStr ? JSON.parse(mockStr) : [];
      templates = templates.filter(t => t.id !== id);
      localStorage.setItem('nola_mock_templates', JSON.stringify(templates));
      return;
    }
    throw error;
  }
};
