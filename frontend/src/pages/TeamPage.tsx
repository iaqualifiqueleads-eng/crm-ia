import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users as UsersIcon, Crown, Shield, User as UserIcon, MoreHorizontal, Power } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/EmptyState';
import { useUsers, useDeactivateUser } from '@/features/team/useTeam';
import { UserFormModal } from '@/features/team/UserFormModal';
import { useAuthStore } from '@/store/auth.store';
import { cn, formatDate, getInitials } from '@/lib/utils';
import type { User, UserRole } from '@/types';

const roleIcon: Record<UserRole, React.ElementType> = {
  MANAGER: Crown,
  SUPERVISOR: Shield,
  SALESPERSON: UserIcon,
};

const roleLabel: Record<UserRole, string> = {
  MANAGER: 'Gerente',
  SUPERVISOR: 'Supervisor',
  SALESPERSON: 'Vendedor',
};

export function TeamPage() {
  const currentRole = useAuthStore((s) => s.user?.role);
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useUsers({ limit: 100 });
  const deactivate = useDeactivateUser();

  // Agrupa por papel para a visão hierárquica
  type EnhancedUser = User & {
    supervisor?: { id: string; name: string; role: UserRole };
    _count?: { customers: number; subordinates: number };
  };
  const grouped: Record<UserRole, EnhancedUser[]> = {
    MANAGER: [], SUPERVISOR: [], SALESPERSON: [],
  };
  for (const u of (data?.data ?? [])) {
    grouped[u.role].push(u as EnhancedUser);
  }

  return (
    <>
      <PageHeader
        eyebrow="Pessoas"
        title="Equipe & Hierarquia"
        description={
          currentRole === 'MANAGER'
            ? 'Você gerencia toda a estrutura. Crie supervisores e vendedores, e organize a hierarquia.'
            : 'Gerencie seus vendedores diretos.'
        }
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Adicionar membro
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {(['MANAGER', 'SUPERVISOR', 'SALESPERSON'] as UserRole[]).map((role) => {
            const list = grouped[role];
            const Icon = roleIcon[role];
            return (
              <Card key={role}>
                <CardHeader>
                  <div>
                    <CardEyebrow>{roleLabel[role]}{list.length > 1 ? 'es' : ''}</CardEyebrow>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4 text-champagne" />
                      {list.length} {list.length === 1 ? 'membro' : 'membros'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-3 py-3 max-h-[500px] overflow-y-auto">
                  {list.length === 0 ? (
                    <p className="text-xs text-smoke text-center py-8">
                      Nenhum {roleLabel[role].toLowerCase()} cadastrado.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {list.map((u, i) => (
                        <motion.li
                          key={u.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className={cn(
                            'group flex items-center gap-3 px-3 py-2.5 rounded-sharp',
                            'hover:bg-platinum-50/60 transition-colors',
                            !u.isActive && 'opacity-50',
                          )}
                        >
                          <span className="h-9 w-9 rounded-sharp bg-onyx text-pearl text-xs font-mono inline-flex items-center justify-center shrink-0">
                            {getInitials(u.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-onyx truncate flex items-center gap-2">
                              {u.name}
                              {!u.isActive && <Chip tone="neutral">Inativo</Chip>}
                            </div>
                            <div className="text-2xs text-smoke truncate">{u.email}</div>
                            {u._count && (
                              <div className="text-2xs text-smoke/70 mt-0.5">
                                {u._count.customers > 0 && `${u._count.customers} clientes`}
                                {u._count.subordinates > 0 && ` · ${u._count.subordinates} subordinados`}
                              </div>
                            )}
                          </div>
                          {currentRole === 'MANAGER' && role !== 'MANAGER' && u.isActive && (
                            <button
                              onClick={() => {
                                if (confirm(`Desativar ${u.name}?`)) deactivate.mutate(u.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-smoke hover:text-signal transition-all"
                              title="Desativar"
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <UserFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
