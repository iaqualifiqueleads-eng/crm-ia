import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, ListTodo, FileText, Settings, Send, Bot, MessageSquare, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const items: NavItem[] = [
  { to: '/',          label: 'Visão Geral',   icon: LayoutDashboard },
  { to: '/customers', label: 'Carteira',      icon: Users },
  { to: '/orders',    label: 'Pedidos',       icon: Briefcase },
  { to: '/tasks',     label: 'Tarefas',       icon: ListTodo },
  { to: '/agents',    label: 'Agentes IA',    icon: Bot },
  { to: '/campaigns', label: 'Campanhas',     icon: Megaphone, roles: ['MANAGER', 'SUPERVISOR'] },
  { to: '/templates', label: 'Templates',     icon: FileText, roles: ['MANAGER', 'SUPERVISOR'] },
  { to: '/team',      label: 'Equipe',        icon: Send,     roles: ['MANAGER', 'SUPERVISOR'] },
  { to: '/automation', label: 'Cadência',     icon: Settings,      roles: ['MANAGER'] },
  { to: '/chat',       label: 'Chat ao Vivo', icon: MessageSquare },
];

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-onyx text-pearl border-r border-onyx/0 sticky top-0 h-screen">
      {/* Logotipo */}
      <div className="px-6 pt-8 pb-10">
        <div className="flex items-baseline gap-2">
          <span className="display text-2xl text-pearl">
            mar<span className="text-champagne">·</span>cha
          </span>
        </div>
        <div className="label-eyebrow text-platinum-100/50 mt-1">Customer Atelier</div>
      </div>

      <div className="px-3 mb-4">
        <div className="h-px bg-pearl/10" />
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {items.map((item) => {
          if (item.roles && role && !item.roles.includes(role)) return null;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 px-4 py-2.5 text-sm rounded-sharp',
                  'transition-colors duration-150',
                  isActive
                    ? 'bg-pearl/5 text-pearl'
                    : 'text-platinum-100/60 hover:text-pearl hover:bg-pearl/[0.03]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-px bg-champagne" />
                  )}
                  <Icon className={cn('h-4 w-4', isActive ? 'text-champagne' : 'text-current')} />
                  <span className="tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Rodapé editorial */}
      <div className="px-6 py-6 border-t border-pearl/10">
        <div className="label-eyebrow text-platinum-100/40">v.0.2 · 2026</div>
      </div>
    </aside>
  );
}
