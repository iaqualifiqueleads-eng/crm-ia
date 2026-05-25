import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { AuthResponse } from '@/types';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      navigate('/');
    } catch (err) {
      toast.error(extractErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading };
}
