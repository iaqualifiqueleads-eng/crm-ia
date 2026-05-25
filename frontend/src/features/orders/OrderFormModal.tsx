import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { CustomerCombobox } from '@/components/ui/CustomerCombobox';
import { useCreateOrder, type CreateOrderItem } from '@/features/orders/useOrders';
import { formatCurrency } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  preselectedCustomerId?: string;
}

const emptyItem = (): CreateOrderItem => ({ productName: '', quantity: 1, unit: 'UN', unitPrice: 0 });

export function OrderFormModal({ open, onClose, preselectedCustomerId }: Props) {
  const create = useCreateOrder();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderedAt, setOrderedAt] = useState<string>(new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState('');
  const [channel, setChannel] = useState('PHONE');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CreateOrderItem[]>([emptyItem()]);

  useEffect(() => {
    if (!open) return;
    setCustomerId(preselectedCustomerId ?? null);
    setOrderedAt(new Date().toISOString().split('T')[0]);
    setOrderNumber('');
    setChannel('PHONE');
    setNotes('');
    setItems([emptyItem()]);
  }, [open, preselectedCustomerId]);

  const total = items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );

  const setItem = <K extends keyof CreateOrderItem>(i: number, k: K, v: CreateOrderItem[K]) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  };

  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (i: number) =>
    setItems((arr) => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    const validItems = items.filter((it) => it.productName.trim() && it.quantity > 0);
    if (validItems.length === 0) return;
    try {
      await create.mutateAsync({
        customerId,
        orderedAt: new Date(orderedAt).toISOString(),
        orderNumber: orderNumber || undefined,
        channel,
        notes: notes || undefined,
        items: validItems,
      });
      onClose();
    } catch { /* tratado */ }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Novo registro"
      title="Registrar pedido"
      size="xl"
      footer={
        <>
          <div className="mr-auto text-sm text-smoke">
            Total: <span className="display text-xl text-onyx ml-2">{formatCurrency(total)}</span>
          </div>
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={onSubmit as any} loading={create.isPending} disabled={!customerId}>
            Registrar pedido
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <CustomerCombobox
              value={customerId}
              onChange={(id) => setCustomerId(id)}
              required
            />
          </div>
          <div>
            <Label>Data do pedido</Label>
            <Input type="date" value={orderedAt} onChange={(e) => setOrderedAt(e.target.value)} />
          </div>
          <div>
            <Label>Número (opcional)</Label>
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="#0001" />
          </div>
          <div>
            <Label>Canal</Label>
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PHONE">Telefone</option>
              <option value="EMAIL">E-mail</option>
              <option value="IN_PERSON">Presencial</option>
              <option value="ECOMMERCE">E-commerce</option>
              <option value="OTHER">Outro</option>
            </Select>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="label-eyebrow">Itens do pedido</div>
            <Button type="button" variant="ghost" size="sm" onClick={addItem} icon={<Plus className="h-3.5 w-3.5" />}>
              Adicionar item
            </Button>
          </div>

          <div className="space-y-2.5">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <Input
                    value={it.productName}
                    onChange={(e) => setItem(i, 'productName', e.target.value)}
                    placeholder="Produto"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number" min={0} step="0.001"
                    value={it.quantity}
                    onChange={(e) => setItem(i, 'quantity', Number(e.target.value))}
                    placeholder="Qtde"
                  />
                </div>
                <div className="col-span-2">
                  <Select value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)}>
                    <option value="UN">UN</option>
                    <option value="KG">KG</option>
                    <option value="M2">M²</option>
                    <option value="L">L</option>
                    <option value="CX">CX</option>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number" min={0} step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => setItem(i, 'unitPrice', Number(e.target.value))}
                    placeholder="R$ unit."
                  />
                </div>
                <div className="col-span-1 flex items-center h-11">
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="text-smoke hover:text-signal disabled:opacity-30 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas sobre o pedido..." />
        </section>
      </form>
    </Modal>
  );
}
