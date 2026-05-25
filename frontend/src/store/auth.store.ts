import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '@/types';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  supervisorId: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;

  setSession: (s: { accessToken: string; refreshToken: string; user: SessionUser }) => void;
  setUser: (user: User) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setUser: (user) =>
        set((state) => ({
          ...state,
          user: state.user
            ? { ...state.user, name: user.name, email: user.email, role: user.role }
            : state.user,
        })),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken && !!get().user,
      hasRole: (...roles) => {
        const role = get().user?.role;
        return role ? roles.includes(role) : false;
      },
    }),
    {
      name: 'crm-auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
    },
  ),
);
