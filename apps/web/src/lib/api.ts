import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

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

export const api = axios.create({
  baseURL: '/api/v1',
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
      .post<RefreshResponse>('/api/v1/auth/refresh', undefined, { withCredentials: true })
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
      } catch {
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
