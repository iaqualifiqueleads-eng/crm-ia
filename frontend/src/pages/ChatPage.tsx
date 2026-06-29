import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Bot, User, AlertCircle, Clock, CheckCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomer, useCustomers } from '@/features/customers/useCustomers';
import { useCustomerInteractions, useContactedCustomers } from '@/features/interactions/useInteractions';
import type { Interaction, InteractionStatus } from '@/types';

// ─── Status icon ───────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: InteractionStatus }) {
  if (status === 'FAILED') return <AlertCircle className="h-3 w-3 text-red-400" />;
  if (status === 'READ')   return <CheckCheck className="h-3 w-3 text-blue-400" />;
  if (status === 'DELIVERED') return <CheckCheck className="h-3 w-3 text-platinum-100/50" />;
  if (status === 'SENT')   return <Check className="h-3 w-3 text-platinum-100/50" />;
  if (status === 'PENDING') return <Clock className="h-3 w-3 text-platinum-100/30" />;
  return null;
}

// ─── Bubble ────────────────────────────────────────────────────────────────
function MessageBubble({ interaction }: { interaction: Interaction }) {
  const isOut = interaction.direction === 'OUTBOUND';
  const isAi  = interaction.type === 'WHATSAPP_AI';
  const time  = new Date(interaction.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex gap-2 max-w-[78%]', isOut ? 'ml-auto flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mt-1',
        isOut ? 'bg-champagne/20 text-champagne' : 'bg-pearl/10 text-pearl/70',
      )}>
        {isOut ? (isAi ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />) : (
          <span>C</span>
        )}
      </div>

      {/* Bubble */}
      <div className={cn(
        'flex flex-col gap-1',
        isOut ? 'items-end' : 'items-start',
      )}>
        {isAi && isOut && (
          <span className="text-[10px] text-champagne/70 px-1">IA</span>
        )}
        <div className={cn(
          'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
          isOut
            ? 'bg-champagne/15 text-pearl rounded-tr-sm'
            : 'bg-pearl/8 text-pearl/90 rounded-tl-sm',
          interaction.status === 'FAILED' && 'bg-red-900/20 border border-red-500/20',
        )}>
          {interaction.content}
        </div>
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px] text-platinum-100/30">{time}</span>
          {isOut && <StatusIcon status={interaction.status} />}
        </div>
        {interaction.status === 'FAILED' && interaction.failedReason && (
          <span className="text-[10px] text-red-400 px-1">{interaction.failedReason}</span>
        )}
      </div>
    </div>
  );
}

// ─── Contact item ──────────────────────────────────────────────────────────
function ContactItem({
  customerId,
  lastInteraction,
  isSelected,
  onClick,
}: {
  customerId: string;
  lastInteraction: Interaction;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { data: customer } = useCustomer(customerId);
  const time = new Date(lastInteraction.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isInbound = lastInteraction.direction === 'INBOUND';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors',
        isSelected ? 'bg-pearl/8' : 'hover:bg-pearl/4',
        'border-b border-pearl/5',
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 w-10 h-10 rounded-full bg-champagne/15 flex items-center justify-center text-champagne font-medium text-sm">
        {(customer?.companyName ?? '?')[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-pearl truncate">
            {customer?.companyName ?? '…'}
          </span>
          <span className="text-[10px] text-platinum-100/40 shrink-0">{time}</span>
        </div>
        <p className="text-xs text-platinum-100/50 truncate mt-0.5">
          {isInbound ? '' : '→ '}
          {lastInteraction.content}
        </p>
      </div>
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
export function ChatPage() {
  const { customerId: paramId } = useParams<{ customerId?: string }>();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null);
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [], isLoading: loadingContacts } = useContactedCustomers();
  const { data: messages = [], isLoading: loadingMessages } = useCustomerInteractions(selectedId);
  const { data: selectedCustomer } = useCustomer(selectedId ?? undefined);

  // Filtra apenas interações WhatsApp para a thread
  const thread = messages.filter((m) =>
    ['WHATSAPP', 'WHATSAPP_AI'].includes(m.type),
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Filtra lista de contatos pelo search
  const { data: allCustomers } = useCustomers({ limit: 500 });
  const customerMap = new Map((allCustomers?.data ?? []).map((c) => [c.id, c]));

  const filteredContacts = search.trim()
    ? contacts.filter((c) => {
        const name = customerMap.get(c.customerId)?.companyName?.toLowerCase() ?? '';
        return name.includes(search.toLowerCase());
      })
    : contacts;

  // Scroll para o fundo quando mensagens carregam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.length]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    navigate(`/chat/${id}`, { replace: true });
  };

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-carbon">
      {/* ── Lista de contatos ─────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-pearl/8 bg-onyx">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-base font-semibold text-pearl mb-3">Chat ao Vivo</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-platinum-100/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente…"
              className={cn(
                'w-full h-9 pl-9 pr-3 text-sm rounded-sharp',
                'bg-pearl/5 border border-pearl/10 text-pearl placeholder:text-platinum-100/30',
                'focus:outline-none focus:border-champagne/40',
              )}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loadingContacts && (
            <div className="px-4 py-8 text-center text-sm text-platinum-100/40">Carregando…</div>
          )}
          {!loadingContacts && filteredContacts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-platinum-100/40">
              Nenhum cliente contatado via WhatsApp ainda.
            </div>
          )}
          {filteredContacts.map((c) => (
            <ContactItem
              key={c.customerId}
              customerId={c.customerId}
              lastInteraction={c.lastInteraction}
              isSelected={selectedId === c.customerId}
              onClick={() => handleSelect(c.customerId)}
            />
          ))}
        </div>
      </div>

      {/* ── Thread de mensagens ───────────────────────── */}
      {selectedId ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header da conversa */}
          <div className="shrink-0 px-6 py-4 border-b border-pearl/8 bg-onyx flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-champagne/15 flex items-center justify-center text-champagne font-medium text-sm">
              {(selectedCustomer?.companyName ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-pearl">
                {selectedCustomer?.companyName ?? '…'}
              </p>
              {selectedCustomer?.whatsapp && (
                <p className="text-xs text-platinum-100/40">{selectedCustomer.whatsapp}</p>
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {loadingMessages && (
              <div className="text-center text-sm text-platinum-100/40 py-8">Carregando conversa…</div>
            )}
            {!loadingMessages && thread.length === 0 && (
              <div className="text-center text-sm text-platinum-100/40 py-8">
                Nenhuma mensagem WhatsApp nesta conversa.
              </div>
            )}
            {thread.map((msg) => (
              <MessageBubble key={msg.id} interaction={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-platinum-100/30 text-sm">
          Selecione um cliente para ver a conversa
        </div>
      )}
    </div>
  );
}
