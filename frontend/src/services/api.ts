import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 30_000,
});

// =====================================================
// REQUEST — injeta access token
// =====================================================
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// =====================================================
// RESPONSE — refresh transparente em caso de 401
// =====================================================
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/auth/refresh`, { refreshToken });

  useAuthStore.getState().setSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });

  return data.accessToken;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 + ainda não tentamos refresh + temos refresh token
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      useAuthStore.getState().refreshToken &&
      originalRequest?.url !== '/auth/refresh' &&
      originalRequest?.url !== '/auth/login'
    ) {
      originalRequest._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (e) {
        refreshPromise = null;
        useAuthStore.getState().clearSession();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  },
);

// =====================================================
// Helper para extrair mensagem de erro amigável
// =====================================================
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido';
}
