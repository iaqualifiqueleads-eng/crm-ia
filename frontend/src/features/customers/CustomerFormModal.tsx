import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import {
  useCreateCustomer,
  useUpdateCustomer,
  type CreateCustomerInput,
} from '@/features/customers/useCustomers';
import type { Customer, CustomerStatus, ForecastMode } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

const statusOptions: Array<{ value: CustomerStatus; label: string }> = [
  { value: 'LEAD',     label: 'Lead' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'ACTIVE',   label: 'Ativo' },
  { value: 'AT_RISK',  label: 'Em Risco' },
  { value: 'CHURNED',  label: 'Perdido' },
];

const empty: CreateCustomerInput = {
  companyName: '',
  status: 'LEAD',
  forecastMode: 'AUTO',
};

export function CustomerFormModal({ open, onClose, customer }: Props) {
  const isEdit = !!customer;
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? '');

  const [form, setForm] = useState<CreateCustomerInput>(empty);

  useEffect(() => {
    if (!open) return;
    setForm(customer ? {
      companyName: customer.companyName,
      tradeName: customer.tradeName ?? undefined,
      cnpj: customer.cnpj ?? undefined,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
      whatsapp: customer.whatsapp ?? undefined,
      contactName: customer.contactName ?? undefined,
      contactRole: customer.contactRole ?? undefined,
      city: customer.city ?? undefined,
      state: customer.state ?? undefined,
      status: customer.status,
      origin: customer.origin ?? undefined,
      notes: customer.notes ?? undefined,
      forecastMode: customer.forecastMode,
      manualIntervalDays: customer.manualIntervalDays ?? undefined,
    } : empty);
  }, [open, customer]);

  const set = <K extends keyof CreateCustomerInput>(k: K, v: CreateCustomerInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) return;
    try {
      if (isEdit) {
        await update.mutateAsync(form);
      } else {
        await create.mutateAsync(form);
      }
      onClose();
    } catch { /* erros tratados nos hooks */ }
  };

  const loading = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? 'Editar cliente' : 'Novo cliente'}
      title={isEdit ? customer!.companyName : 'Adicionar à carteira'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={onSubmit as any} loading={loading}>
            {isEdit ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        {/* IDENTIFICAÇÃO */}
        <section>
          <div className="label-eyebrow mb-3">Identificação</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Razão social *</Label>
              <Input
                required
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                placeholder="Construtora Alpha LTDA"
              />
            </div>
            <div>
              <Label>Nome fantasia</Label>
              <Input value={form.tradeName ?? ''} onChange={(e) => set('tradeName', e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          </div>
        </section>

        {/* CONTATO */}
        <section>
          <div className="label-eyebrow mb-3">Contato</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Pessoa de contato</Label>
              <Input value={form.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={form.contactRole ?? ''} onChange={(e) => set('contactRole', e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>WhatsApp (E.164)</Label>
              <Input value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="5527999998888" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} />
            </div>
          </div>
        </section>

        {/* CLASSIFICAÇÃO + PREVISÃO */}
        <section>
          <div className="label-eyebrow mb-3">Classificação & Previsão</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => set('status', e.target.value as CustomerStatus)}>
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Origem</Label>
              <Input value={form.origin ?? ''} onChange={(e) => set('origin', e.target.value)} placeholder="indicação, tráfego..." />
            </div>
            <div>
              <Label>Modo da previsão</Label>
              <Select
                value={form.forecastMode}
                onChange={(e) => set('forecastMode', e.target.value as ForecastMode)}
              >
                <option value="AUTO">Automática (média)</option>
                <option value="MANUAL">Manual</option>
              </Select>
            </div>
            {form.forecastMode === 'MANUAL' && (
              <div>
                <Label>Intervalo manual (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.manualIntervalDays ?? ''}
                  onChange={(e) => set('manualIntervalDays', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="30"
                />
              </div>
            )}
          </div>
        </section>

        {/* NOTAS */}
        <section>
          <Label>Anotações</Label>
          <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Contexto relevante sobre o cliente, preferências, particularidades..." />
        </section>
      </form>
    </Modal>
  );
}
