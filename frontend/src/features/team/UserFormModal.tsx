import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { useCreateUser, useUsers, type CreateUserInput } from '@/features/team/useTeam';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UserFormModal({ open, onClose }: Props) {
  const create = useCreateUser();
  const role = useAuthStore((s) => s.user?.role);
  const isManager = role === 'MANAGER';

  // Supervisores disponíveis para escolher na criação de vendedor (só manager precisa)
  const { data: supervisors } = useUsers({ role: 'SUPERVISOR', limit: 50 });

  const [form, setForm] = useState<CreateUserInput>({
    name: '', email: '', password: '', role: 'SALESPERSON',
  });

  useEffect(() => {
    if (!open) return;
    setForm({ name: '', email: '', password: '', role: 'SALESPERSON' });
  }, [open]);

  const set = <K extends keyof CreateUserInput>(k: K, v: CreateUserInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    try {
      await create.mutateAsync(form);
      onClose();
    } catch { /* tratado */ }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Novo membro"
      title="Adicionar à equipe"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={onSubmit as any} loading={create.isPending}>Criar usuário</Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label>Nome *</Label>
          <Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome completo" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>E-mail *</Label>
            <Input
              required type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="vendedor@empresa.com"
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(27) 99999-9999"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Papel *</Label>
            <Select
              value={form.role}
              onChange={(e) => set('role', e.target.value as UserRole)}
            >
              {isManager && <option value="SUPERVISOR">Supervisor</option>}
              <option value="SALESPERSON">Vendedor</option>
            </Select>
            <p className="text-2xs text-smoke mt-1.5">
              {form.role === 'SUPERVISOR'
                ? 'Vai gerenciar vendedores e a carteira deles'
                : 'Tem acesso apenas à própria carteira de clientes'}
            </p>
          </div>

          {isManager && form.role === 'SALESPERSON' && (supervisors?.data.length ?? 0) > 0 && (
            <div>
              <Label>Supervisor</Label>
              <Select
                value={form.supervisorId ?? ''}
                onChange={(e) => set('supervisorId', e.target.value || undefined)}
              >
                <option value="">Reportar diretamente ao gerente</option>
                {supervisors!.data.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div>
          <Label>Senha provisória *</Label>
          <Input
            required type="text"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="Min. 8 caracteres, com letras e números"
            className="font-mono"
          />
          <p className="text-2xs text-smoke mt-1.5">
            O usuário deve trocar no primeiro acesso.
          </p>
        </div>
      </form>
    </Modal>
  );
}
