import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, ChevronDown, User as UserIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/services/api';
import { cn, getInitials } from '@/lib/utils';
import { RoleChip } from '@/components/ui/Chip';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ unreadCount: number }>('/notifications/unread-count');
      return data;
    },
    refetchInterval: 60_000,
  });

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } finally {
      clearSession();
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-pearl/85 backdrop-blur-md border-b border-platinum-100/70">
      <div className="px-8 h-16 flex items-center justify-between gap-6">
        {/* Busca global (placeholder por enquanto) */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-smoke/70" />
          <input
            type="search"
            placeholder="Buscar cliente, pedido, vendedor..."
            className="w-full h-10 pl-10 pr-3 bg-transparent border-0 border-b border-platinum-100/0 hover:border-platinum-100/80 focus:border-onyx focus:outline-none text-sm text-onyx placeholder:text-smoke/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Notificações */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative h-10 w-10 inline-flex items-center justify-center text-smoke hover:text-onyx rounded-sharp transition-colors"
            aria-label="Notificações"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread && unread.unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-champagne" />
            )}
          </button>

          {/* Menu de perfil */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                'flex items-center gap-3 pl-1 pr-3 h-10 rounded-sharp',
                'hover:bg-platinum-50/60 transition-colors',
              )}
            >
              <span className="h-8 w-8 rounded-sharp bg-onyx text-pearl text-xs font-medium inline-flex items-center justify-center font-mono">
                {getInitials(user?.name)}
              </span>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-sm text-onyx">{user?.name}</span>
                <span className="text-2xs text-smoke">{user?.email}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-smoke" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-12 w-72 bg-pearl border border-platinum-100 rounded-sharp shadow-lift overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-platinum-100/70">
                    <div className="text-sm font-medium text-onyx">{user?.name}</div>
                    <div className="text-xs text-smoke truncate mt-0.5">{user?.email}</div>
                    <div className="mt-3">{user && <RoleChip role={user.role} />}</div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/account'); }}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-graphite hover:bg-platinum-50/60 hover:text-onyx transition-colors"
                  >
                    <UserIcon className="h-4 w-4" />
                    Minha conta
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-graphite hover:bg-platinum-50/60 hover:text-onyx transition-colors border-t border-platinum-100/70"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
