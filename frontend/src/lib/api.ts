import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { setLogoutReason } from './idleReason';

const ACCESS_KEY = 'grotec_access';
const TENANT_KEY = 'grotec_tenant_id';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}
export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}

export function getTenantId(): string | null {
  return localStorage.getItem(TENANT_KEY);
}
export function setTenantId(tenantId: string): void {
  localStorage.setItem(TENANT_KEY, tenantId);
}
export function clearTenantId(): void {
  localStorage.removeItem(TENANT_KEY);
}

import { isNativeApp } from './native-calling';

export const CLOUD_BACKEND_API = 'https://grotec-dev-project.onrender.com/api/v1';

// Automatically purge legacy custom server override so all clients connect to live production server
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('grotec_custom_api_url');
  } catch {
    // ignore
  }
}

export function getCustomApiUrl(): string | null {
  return null;
}

export function setCustomApiUrl(_url: string | null): void {
  // Single live server mode only
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '');
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl;
  }
  // Mobile app (Capacitor/Android/iOS native WebView):
  if (
    isNativeApp() ||
    (typeof window !== 'undefined' &&
      (window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:' ||
        (window.location.hostname === 'localhost' && !window.location.port)))
  ) {
    return CLOUD_BACKEND_API;
  }
  // The Vite dev server always proxies /api (vite.config.ts), whatever host or port it is opened on
  if (import.meta.env.DEV) {
    return '/api/v1';
  }
  // Local production-mode server (backend-served build) uses the relative path too
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    (window.location.port === '5173' || window.location.port === '3000')
  ) {
    return '/api/v1';
  }
  // Standalone web or Vercel production web:
  return CLOUD_BACKEND_API;
}

export const API_BASE_URL: string = getApiBaseUrl();

import { Capacitor, CapacitorHttp, type HttpResponse } from '@capacitor/core';
import type { AxiosAdapter, AxiosResponse } from 'axios';

export function isNativeMobile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // ignore
  }
  return window.location.protocol === 'capacitor:' || (window.location.hostname === 'localhost' && !window.location.port);
}

export const capacitorNativeAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  let url = config.url || '';
  if (config.baseURL && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `${config.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  }

  const headers: Record<string, string> = {};
  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) {
      if (v !== undefined && v !== null && typeof v !== 'function') {
        headers[k] = String(v);
      }
    }
  }

  let data = config.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      // keep raw string
    }
  }

  const method = (config.method || 'get').toUpperCase();
  const res: HttpResponse = await CapacitorHttp.request({
    url,
    method,
    headers,
    data,
    params: config.params as any,
    connectTimeout: config.timeout || 15000,
    readTimeout: config.timeout || 15000,
  });

  const response: AxiosResponse = {
    data: res.data,
    status: res.status,
    statusText: String(res.status),
    headers: (res.headers || {}) as any,
    config,
    request: {},
  };

  if (res.status >= 200 && res.status < 400) {
    return response;
  }

  const err: any = new Error(`Request failed with status code ${res.status}`);
  err.response = response;
  err.status = res.status;
  err.config = config;
  err.isAxiosError = true;
  return Promise.reject(err);
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  adapter: isNativeMobile() ? capacitorNativeAdapter : undefined,
});

api.interceptors.request.use((config) => {
  if (isNativeMobile()) {
    config.adapter = capacitorNativeAdapter;
  }
  const currentBase = getApiBaseUrl();
  config.baseURL = currentBase;
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = getTenantId();
  if (tenantId) config.headers['x-tenant-id'] = tenantId;
  return config;
});

export async function checkServerHealth(targetUrl?: string): Promise<{ ok: boolean; latency: number; dbStatus?: string; message?: string }> {
  const base = (targetUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const start = performance.now();
  try {
    const res = await api.get(`${base}/health`, {
      timeout: 8000,
      validateStatus: () => true,
    });
    const latency = Math.round(performance.now() - start);
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, latency, dbStatus: res.data?.db || 'up', message: `Connected (${latency}ms)` };
    }
    return { ok: false, latency, message: `Server error HTTP ${res.status}` };
  } catch (err: any) {
    return {
      ok: false,
      latency: Math.round(performance.now() - start),
      message: err.code === 'ECONNABORTED' ? 'Connection timed out' : 'Server unreachable (Check internet connection)',
    };
  }
}

interface RefreshResponse {
  accessToken: string;
}

let refreshInFlight: Promise<string> | null = null;

/** Uses the httpOnly refresh cookie to mint a fresh access token (single-flight). */
async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    const base = getApiBaseUrl();
    refreshInFlight = api
      .post<RefreshResponse>(`${base}/auth/refresh`, undefined)
      .then((res) => {
        const token = res.data.accessToken;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

let redirecting = false;
function redirectToLogin(): void {
  if (redirecting) return;
  redirecting = true;
  clearAccessToken();
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && original && !isAuthCall && !original._retried) {
      if (!getAccessToken()) {
        return Promise.reject(error);
      }
      try {
        const token = await refreshAccessToken();
        original._retried = true;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError) && refreshError.response?.data?.error?.code === 'SESSION_IDLE_TIMEOUT') {
          setLogoutReason('idle');
        }
        redirectToLogin();
      }
    }
    if (status === 401 && !isAuthCall && getAccessToken()) {
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);

/** Normalizes axios errors into {message} for display. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as {
      error?: {
        message?: string;
        code?: string;
        details?: {
          fields?: string[] | Record<string, string[] | string>;
          [key: string]: any;
        };
      };
      message?: string | string[];
    } | undefined;

    if (body?.error?.details?.fields) {
      const f = body.error.details.fields;
      if (Array.isArray(f) && f.length > 0) {
        return f.length === 1 ? f[0] : `Validation failed: ${f.join('; ')}`;
      }
      if (typeof f === 'object') {
        const entries = Object.entries(f)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .filter(Boolean);
        if (entries.length > 0) {
          return `Validation failed: ${entries.join('; ')}`;
        }
      }
    }

    if (Array.isArray(body?.message)) {
      return body.message.join(', ');
    }

    return body?.error?.message ?? (typeof body?.message === 'string' ? body.message : undefined) ?? body?.error?.code ?? error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

export interface SendSmsPayload {
  to: string;
  body: string;
  customerId?: string;
  entityType?: string;
  entityId?: string;
}

export interface SendWhatsAppPayload {
  to: string;
  body?: string;
  templateName?: string;
  templateParams?: Record<string, unknown>[];
  customerId?: string;
  entityType?: string;
  entityId?: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  customerId?: string;
  entityType?: string;
  entityId?: string;
}

export interface MessageOutboxItem {
  id: string;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL';
  direction: 'OUTBOUND' | 'INBOUND';
  to: string;
  from?: string;
  subject?: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  provider: string;
  providerMessageId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const messagingApi = {
  sendSms: (payload: SendSmsPayload) => api.post<{ success: boolean; message: MessageOutboxItem }>('/messages/sms', payload),
  sendWhatsApp: (payload: SendWhatsAppPayload) => api.post<{ success: boolean; message: MessageOutboxItem }>('/messages/whatsapp', payload),
  sendEmail: (payload: SendEmailPayload) => api.post<{ success: boolean; message: MessageOutboxItem }>('/messages/email', payload),
  getOutbox: (params?: { channel?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ items: MessageOutboxItem[]; total: number; page: number; limit: number }>('/messages/outbox', { params }),
  getStatus: () => api.get<{
    sms: { provider: string; configured: boolean; isLive: boolean };
    whatsapp: { provider: string; configured: boolean; isLive: boolean; phoneNumberId: string };
    email: { provider: string; configured: boolean; isLive: boolean };
  }>('/messages/status'),
  resend: (id: string) => api.post<{ success: boolean; message: MessageOutboxItem }>(`/messages/resend/${id}`),
};

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings?: Record<string, unknown>;
  _count?: {
    employees?: number;
    customers?: number;
    leads?: number;
    calls?: number;
  };
}

export const tenantsApi = {
  getCurrentTenant: () => api.get<TenantInfo>('/tenants/current'),
  listTenants: () => api.get<TenantInfo[]>('/tenants'),
  createTenant: (data: { name: string; slug: string; plan?: string; settings?: Record<string, unknown> }) =>
    api.post<TenantInfo>('/tenants', data),
};

// --- VAPI AI VOICE CALLING API ---
export interface AiCallingConfig {
  isLiveConfigured: boolean;
  mode: 'LIVE_TELEPHONY' | 'PRESENTATION_DEMO_READY';
  hasApiKey: boolean;
  hasAssistantId: boolean;
  hasPhoneNumberId: boolean;
  demoModeAvailable: boolean;
  defaultVoice: string;
  model: string;
  supportedLanguages: Array<{ code: string; name: string; isDefault: boolean }>;
  assistantProfile: {
    name: string;
    organization: string;
    headquarters: string;
    scope: string;
  };
}

export interface EligibleFarmer {
  id: string;
  farmerCode: string | null;
  fullName: string;
  status: string;
  relationshipStage: string;
  contactStatus: string;
  primaryPhone: string | null;
  additionalPhones: string[];
  location: string;
  crops: string[];
}

export interface StartAiCallPayload {
  customerId?: string;
  phoneNumber?: string;
  language?: 'ta' | 'en' | 'bilingual';
  topic?: string;
  simulated?: boolean;
  farmerName?: string;
}

export interface DemoScenario {
  topic: string;
  crop: string;
  issue: string;
  recommendedProducts: string[];
  dosage: string;
  expectedAmount: number;
  transcript: Array<{
    speaker: 'AI_ASSISTANT' | 'FARMER';
    text: string;
    en: string;
  }>;
}

export interface AiCallResponse {
  id: string;
  isSimulated: boolean;
  providerCallId: string;
  status: string;
  farmerName: string;
  farmerCode?: string;
  phoneNumber: string;
  scenario?: DemoScenario;
  message: string;
}

export interface AiCallStatusResponse {
  id: string;
  provider: string;
  providerCallId: string;
  status: string;
  phoneNumber: string;
  customer?: { id: string; fullName: string; farmerCode: string; relationshipStage: string } | null;
  cropInterest?: string | null;
  productInterest?: string | null;
  expectedBookingAmount?: number | null;
  outcome?: string | null;
  nextAction?: string | null;
  startedAt: string;
  connectedAt?: string | null;
  endedAt?: string | null;
  notes: Array<{ id: string; content: string; createdAt: string }>;
  followUp?: { id: string; dueAt: string; notes: string } | null;
}

export interface AiCallHistoryItem {
  id: string;
  provider: string;
  phoneNumber: string;
  farmerCode?: string;
  farmerName?: string;
  cropInterest?: string;
  productInterest?: string;
  expectedBookingAmount?: number | null;
  status: string;
  outcome?: string;
  startedAt: string;
  endedAt?: string;
  agentName?: string;
  latestNote?: string;
}

export const aiCallingApi = {
  getConfig: () => api.get<AiCallingConfig>('/ai-calling/config'),
  getFarmers: (search?: string) => api.get<EligibleFarmer[]>('/ai-calling/farmers', { params: { search } }),
  startCall: (payload: StartAiCallPayload) => api.post<AiCallResponse>('/ai-calling/call', payload),
  getStatus: (id: string) => api.get<AiCallStatusResponse>(`/ai-calling/call/${id}`),
  completeCall: (id: string, data: any) => api.post<any>(`/ai-calling/call/${id}/complete`, data),
  confirmOrder: (data: any) => api.post<any>('/ai-calling/confirm-order', data),
  getHistory: () => api.get<AiCallHistoryItem[]>('/ai-calling/history'),
};


