import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { setLogoutReason } from './idleReason';

const ACCESS_KEY = 'grotec_access';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}
export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // refresh token lives in the httpOnly cookie
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RefreshResponse {
  accessToken: string;
}

let refreshInFlight: Promise<string> | null = null;

/** Uses the httpOnly refresh cookie to mint a fresh access token (single-flight). */
async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<RefreshResponse>(`${API_BASE_URL}/auth/refresh`, undefined, { withCredentials: true })
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
    if (status === 401 && !isAuthCall) {
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);

/** Normalizes axios errors into {message} for display. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: { message?: string; code?: string } } | undefined;
    return body?.error?.message ?? body?.error?.code ?? error.message;
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

