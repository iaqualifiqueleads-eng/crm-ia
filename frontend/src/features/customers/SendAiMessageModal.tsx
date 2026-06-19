import { useState } from 'react';
import { Bot } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Input';
import { useTemplates } from '@/features/templates/useTemplates';
import { useSendAiMessage } from './useCustomers';

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

export function SendAiMessageModal({ open, onClose, customerId, customerName }: Props) {
  const [templateId, setTemplateId] = useState('');

  const { data: templatesPage, isLoading: loadingTemplates } = useTemplates({ isActive: true, limit: 100 });
  const templates = templatesPage?.data ?? [];

  const { mutate: send, isPending } = useSendAiMessage(customerId);

  function handleSubmit() {
    if (!templateId) return;
    send(templateId, {
      onSuccess: () => {
        setTemplateId('');
        onClose();
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Disparo manual"
      title={`Enviar mensagem via IA`}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!templateId || isPending}
            loading={isPending}
            icon={<Bot className="h-4 w-4" />}
          >
            Enviar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-smoke">
          A IA vai usar o template selecionado para enviar uma mensagem para{' '}
          <span className="text-onyx font-medium">{customerName}</span> agora via WhatsApp.
        </p>

        <div>
          <Label htmlFor="template-select">Template</Label>
          {loadingTemplates ? (
            <div className="h-9 bg-platinum-100/50 rounded-sharp animate-pulse" />
          ) : (
            <Select
              id="template-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Selecione um template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {templateId && (() => {
          const tpl = templates.find((t) => t.id === templateId);
          return tpl ? (
            <div className="px-3 py-2.5 bg-pearl border border-platinum-100 rounded-sharp">
              <p className="text-2xs uppercase tracking-micro text-smoke mb-1">Preview do template</p>
              <p className="text-sm text-graphite whitespace-pre-wrap">{tpl.body}</p>
            </div>
          ) : null;
        })()}
      </div>
    </Modal>
  );
}
