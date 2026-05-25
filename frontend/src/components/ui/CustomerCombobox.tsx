import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api } from '@/services/api';
import type { Customer, Paginated } from '@/types';
import { Input, Label } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface Props {
  value: string | null;
  onChange: (id: string | null, customer?: Customer) => void;
  label?: string;
  required?: boolean;
}

export function CustomerCombobox({ value, onChange, label = 'Cliente', required }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Carrega o cliente selecionado (para mostrar o nome) quando há value
  const { data: selected } = useQuery({
    queryKey: ['customers', value, 'select'],
    queryFn: async () => {
      const { data } = await api.get<Customer>(`/customers/${value}`);
      return data;
    },
    enabled: !!value && !open,
  });

  // Lista de busca
  const { data: results } = useQuery({
    queryKey: ['customers', 'search', debounced],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Customer>>('/customers', {
        params: { search: debounced || undefined, limit: 8 },
      });
      return data;
    },
    enabled: open,
  });

  return (
    <div className="relative">
      <Label>{label}{required && <span className="text-signal"> *</span>}</Label>

      {!open && value && selected ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setSearch(''); }}
          className="w-full h-11 px-3.5 border border-platinum-100 bg-pearl rounded-sharp text-left text-sm text-onyx flex items-center justify-between hover:border-onyx"
        >
          <span className="truncate">{selected.companyName}</span>
          <span
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-smoke hover:text-onyx shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-smoke" />
          <Input
            value={search}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            placeholder="Buscar cliente por nome ou CNPJ..."
            className="pl-10"
          />
        </div>
      )}

      {open && (
        <>
          {/* overlay para fechar ao clicar fora */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={cn(
            'absolute z-20 top-full left-0 right-0 mt-1',
            'bg-pearl border border-platinum-100 rounded-sharp shadow-lift',
            'max-h-72 overflow-y-auto',
          )}>
            {!results || results.data.length === 0 ? (
              <div className="py-6 text-center text-xs text-smoke">
                {debounced ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
              </div>
            ) : (
              <ul className="divide-y divide-platinum-100/70">
                {results.data.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(c.id, c); setOpen(false); setSearch(''); }}
                      className="w-full px-4 py-2.5 text-left hover:bg-platinum-50/50 transition-colors"
                    >
                      <div className="text-sm text-onyx truncate">{c.companyName}</div>
                      <div className="text-2xs text-smoke truncate">
                        {[c.contactName, c.cnpj, c.salesperson?.name].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
