import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { CustomerCombobox } from '@/components/ui/CustomerCombobox';
import { useCreateTask, type CreateTaskInput } from '@/features/tasks/useTasks';

interface Props {
  open: boolean;
  onClose: () => void;
  preselectedCustomerId?: string;
}

export function TaskFormModal({ open, onClose, preselectedCustomerId }: Props) {
  const create = useCreateTask();
  const [form, setForm] = useState<CreateTaskInput>({ title: '', type: 'FOLLOW_UP', priority: 'MEDIUM' });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: '',
      type: 'FOLLOW_UP',
      priority: 'MEDIUM',
      customerId: preselectedCustomerId,
    });
  }, [open, preselectedCustomerId]);

  const set = <K extends keyof CreateTaskInput>(k: K, v: CreateTaskInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await create.mutateAsync({
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      });
      onClose();
    } catch { /* tratado */ }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Nova tarefa"
      title="Criar tarefa"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={onSubmit as any} loading={create.isPending}>Criar tarefa</Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label>Título *</Label>
          <Input
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex: Ligar para confirmar reposição"
          />
        </div>

        <div>
          <Label>Descrição</Label>
          <Textarea
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Contexto adicional..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="CALL">Ligação</option>
              <option value="EMAIL">E-mail</option>
              <option value="MEETING">Reunião</option>
              <option value="VISIT">Visita</option>
            </Select>
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </Select>
          </div>
          <div>
            <Label>Vencimento</Label>
            <Input
              type="datetime-local"
              value={form.dueDate ?? ''}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </div>
        </div>

        <CustomerCombobox
          label="Cliente (opcional)"
          value={form.customerId ?? null}
          onChange={(id) => set('customerId', id ?? undefined)}
        />
      </form>
    </Modal>
  );
}
