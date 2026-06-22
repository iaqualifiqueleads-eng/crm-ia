import { useRef, useState } from 'react';
import { Upload, Download, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useCreateCustomer, type CreateCustomerInput } from '@/features/customers/useCustomers';
import type { CustomerStatus, ForecastMode } from '@/types';
import { cn } from '@/lib/utils';

// ── CSV parsing ────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(field.trim());
        if (row.some((c) => c !== '')) rows.push(row);
        row = []; field = '';
      } else { field += ch; }
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some((c) => c !== '')) rows.push(row); }
  return rows;
}

// ── Column mapping ─────────────────────────────────────────────────────────────

const COLUMNS: Array<{ header: string; field: keyof CreateCustomerInput; required?: boolean }> = [
  { header: 'razao_social',   field: 'companyName',        required: true },
  { header: 'nome_fantasia',  field: 'tradeName' },
  { header: 'cnpj',          field: 'cnpj' },
  { header: 'email',         field: 'email' },
  { header: 'telefone',      field: 'phone' },
  { header: 'whatsapp',      field: 'whatsapp',       required: true },
  { header: 'contato_nome',  field: 'contactName' },
  { header: 'contato_cargo', field: 'contactRole' },
  { header: 'cidade',        field: 'city' },
  { header: 'estado',        field: 'state' },
  { header: 'status',        field: 'status' },
  { header: 'origem',        field: 'origin' },
  { header: 'notas',         field: 'notes' },
  { header: 'previsao',      field: 'forecastMode' },
  { header: 'intervalo_dias',field: 'manualIntervalDays' },
];

const VALID_STATUS: CustomerStatus[] = ['LEAD', 'PROSPECT', 'ACTIVE', 'AT_RISK', 'CHURNED'];
const VALID_FORECAST: ForecastMode[] = ['AUTO', 'MANUAL'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Validation ─────────────────────────────────────────────────────────────────

function validateRow(raw: Record<string, string>): { data: CreateCustomerInput | null; errors: string[] } {
  const errors: string[] = [];

  const companyName = raw['razao_social'] ?? '';
  if (!companyName.trim()) errors.push('Razão social é obrigatória');
  else if (companyName.length > 200) errors.push('Razão social: máx 200 caracteres');

  const email = raw['email']?.trim();
  if (email && !EMAIL_RE.test(email)) errors.push('E-mail inválido');

  const cnpj = raw['cnpj']?.trim();
  if (cnpj && cnpj.length > 20) errors.push('CNPJ: máx 20 caracteres');

  const phone = raw['telefone']?.trim();
  if (phone && phone.length > 30) errors.push('Telefone: máx 30 caracteres');

  const whatsapp = raw['whatsapp']?.trim();
  if (!whatsapp) errors.push('WhatsApp é obrigatório');
  else if (whatsapp.length > 30) errors.push('WhatsApp: máx 30 caracteres');

  const statusRaw = raw['status']?.trim().toUpperCase() as CustomerStatus;
  if (statusRaw && !VALID_STATUS.includes(statusRaw)) {
    errors.push(`Status inválido: use ${VALID_STATUS.join(', ')}`);
  }

  const forecastRaw = raw['previsao']?.trim().toUpperCase() as ForecastMode;
  if (forecastRaw && !VALID_FORECAST.includes(forecastRaw)) {
    errors.push(`Previsão inválida: use AUTO ou MANUAL`);
  }

  const intervalRaw = raw['intervalo_dias']?.trim();
  const intervalDays = intervalRaw ? parseInt(intervalRaw, 10) : undefined;
  if (intervalRaw && (isNaN(intervalDays!) || intervalDays! < 1)) {
    errors.push('intervalo_dias deve ser um número inteiro ≥ 1');
  }

  if (errors.length > 0) return { data: null, errors };

  return {
    errors: [],
    data: {
      companyName: companyName.trim(),
      tradeName:   raw['nome_fantasia']?.trim()  || undefined,
      cnpj:        cnpj                          || undefined,
      email:       email                         || undefined,
      phone:       phone                         || undefined,
      whatsapp:    whatsapp                      || undefined,
      contactName: raw['contato_nome']?.trim()   || undefined,
      contactRole: raw['contato_cargo']?.trim()  || undefined,
      city:        raw['cidade']?.trim()         || undefined,
      state:       raw['estado']?.trim()         || undefined,
      status:      statusRaw                     || undefined,
      origin:      raw['origem']?.trim()         || undefined,
      notes:       raw['notas']?.trim()          || undefined,
      forecastMode: forecastRaw                  || undefined,
      manualIntervalDays: intervalDays,
    },
  };
}

// ── Template download ──────────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = COLUMNS.map((c) => c.header).join(',');
  const example = [
    'Construtora Alpha LTDA', 'Alpha Construções', '00.000.000/0001-00',
    'contato@alpha.com.br', '(27) 9 9999-0000', '5527999990000',
    'João Silva', 'Comprador', 'Vitória', 'ES',
    'ACTIVE', 'indicação', '', 'AUTO', '',
  ].join(',');
  const csv = `${headers}\n${example}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'modelo_importacao_clientes.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ParsedRow = { index: number; raw: Record<string, string>; errors: string[]; data: CreateCustomerInput | null };
type ImportResult = { index: number; companyName: string; ok: boolean; error?: string };

// ── Modal ──────────────────────────────────────────────────────────────────────

interface Props { open: boolean; onClose: () => void }

export function CustomerImportModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [headerError, setHeaderError] = useState('');
  const createCustomer = useCreateCustomer();

  const reset = () => {
    setRows([]); setStep('idle'); setResults([]); setProgress(0); setHeaderError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) { setHeaderError('O arquivo está vazio ou sem dados.'); return; }

      const headers = parsed[0].map((h) => h.toLowerCase().trim());
      const knownHeaders = COLUMNS.map((c) => c.header);
      const requiredHeaders = COLUMNS.filter((c) => c.required).map((c) => c.header);
      const missing = requiredHeaders.filter((h) => !headers.includes(h));
      if (missing.length) { setHeaderError(`Coluna obrigatória ausente: ${missing.join(', ')}`); return; }

      setHeaderError('');
      const data = parsed.slice(1).map((cols, i) => {
        const raw: Record<string, string> = {};
        headers.forEach((h, idx) => { raw[h] = cols[idx] ?? ''; });
        const { data, errors } = validateRow(raw);
        return { index: i + 2, raw, errors, data };
      });
      setRows(data);
      setStep('preview');
    };
    reader.readAsText(file, 'utf-8');
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    const res: ImportResult[] = [];
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await createCustomer.mutateAsync({
        ...row.data!,
        firstContactDelayMinutes: i * 10,
      });
        res.push({ index: row.index, companyName: row.data!.companyName, ok: true });
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? 'Erro desconhecido';
        res.push({ index: row.index, companyName: row.data!.companyName, ok: false, error: msg });
      }
      setProgress(i + 1);
    }
    setResults(res);
    setStep('done');
  };

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      eyebrow="Importação em massa"
      title="Importar clientes via CSV"
      size="xl"
      footer={
        step === 'idle' ? (
          <>
            <Button variant="ghost" onClick={handleClose} type="button">Cancelar</Button>
            <Button onClick={() => fileRef.current?.click()} icon={<Upload className="w-4 h-4" />}>
              Selecionar arquivo
            </Button>
          </>
        ) : step === 'preview' ? (
          <>
            <Button variant="ghost" onClick={reset} type="button">Escolher outro arquivo</Button>
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0}
            >
              Importar {validRows.length} cliente{validRows.length !== 1 ? 's' : ''}
            </Button>
          </>
        ) : step === 'done' ? (
          <Button onClick={handleClose}>Fechar</Button>
        ) : null
      }
    >
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

      {/* ── IDLE ── */}
      {step === 'idle' && (
        <div className="space-y-5">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-platinum-100 rounded-sharp p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-onyx transition-colors"
          >
            <Upload className="w-8 h-8 text-smoke" />
            <p className="text-sm text-graphite">Clique para selecionar um arquivo <strong>.csv</strong></p>
            <p className="text-xs text-smoke">Codificação UTF-8, separador vírgula</p>
          </div>

          {headerError && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {headerError}
            </p>
          )}

          <div className="bg-platinum-50/60 rounded-sharp p-4 space-y-2">
            <p className="text-xs font-medium text-onyx uppercase tracking-micro">Colunas esperadas</p>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNS.map((c) => (
                <span key={c.field} className={cn(
                  'text-2xs px-2 py-0.5 rounded font-mono',
                  c.required ? 'bg-onyx text-pearl' : 'bg-platinum-100 text-graphite'
                )}>
                  {c.header}{c.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-2xs text-smoke pt-1">
              Status válidos: LEAD, PROSPECT, ACTIVE, AT_RISK, CHURNED &nbsp;·&nbsp;
              Previsão: AUTO, MANUAL
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={downloadTemplate}
            type="button"
          >
            Baixar modelo .csv
          </Button>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> {validRows.length} válido{validRows.length !== 1 ? 's' : ''}
            </span>
            {invalidRows.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-500 font-medium">
                <XCircle className="w-4 h-4" /> {invalidRows.length} com erro
              </span>
            )}
            <span className="text-smoke ml-auto text-xs">{rows.length} linhas lidas</span>
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-sharp border border-platinum-100">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-platinum-50 border-b border-platinum-100">
                <tr>
                  <th className="text-left px-3 py-2 text-smoke font-medium w-10">#</th>
                  <th className="text-left px-3 py-2 text-smoke font-medium">Razão social</th>
                  <th className="text-left px-3 py-2 text-smoke font-medium">CNPJ</th>
                  <th className="text-left px-3 py-2 text-smoke font-medium">Status</th>
                  <th className="text-left px-3 py-2 text-smoke font-medium">Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum-100/60">
                {rows.map((row) => (
                  <tr key={row.index} className={row.errors.length ? 'bg-red-50/50' : ''}>
                    <td className="px-3 py-2 text-smoke tabular-nums">{row.index}</td>
                    <td className="px-3 py-2 font-medium text-onyx">{row.raw['razao_social'] || '—'}</td>
                    <td className="px-3 py-2 text-graphite font-mono">{row.raw['cnpj'] || '—'}</td>
                    <td className="px-3 py-2 text-graphite">{row.raw['status'] || '—'}</td>
                    <td className="px-3 py-2">
                      {row.errors.length > 0 ? (
                        <span className="text-red-600">{row.errors.join('; ')}</span>
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invalidRows.length > 0 && validRows.length > 0 && (
            <p className="text-xs text-smoke flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              As linhas com erro serão ignoradas. Apenas os {validRows.length} registros válidos serão importados.
            </p>
          )}
          {validRows.length === 0 && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Nenhum registro válido para importar. Corrija o arquivo e tente novamente.
            </p>
          )}
        </div>
      )}

      {/* ── IMPORTING ── */}
      {step === 'importing' && (
        <div className="flex flex-col items-center gap-5 py-8">
          <Loader2 className="w-8 h-8 text-onyx animate-spin" />
          <div className="w-full max-w-sm space-y-2">
            <div className="flex justify-between text-xs text-smoke">
              <span>Importando...</span>
              <span className="tabular-nums">{progress} / {validRows.length}</span>
            </div>
            <div className="h-1.5 bg-platinum-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-onyx rounded-full transition-all duration-200"
                style={{ width: `${(progress / validRows.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> {successCount} importado{successCount !== 1 ? 's' : ''}
            </span>
            {failCount > 0 && (
              <span className="flex items-center gap-1.5 text-red-500 font-medium">
                <XCircle className="w-4 h-4" /> {failCount} falha{failCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {failCount > 0 && (
            <div className="max-h-[280px] overflow-y-auto rounded-sharp border border-platinum-100 divide-y divide-platinum-100/60">
              {results.filter((r) => !r.ok).map((r) => (
                <div key={r.index} className="px-4 py-2.5 bg-red-50/40 flex items-start gap-2 text-xs">
                  <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-onyx">{r.companyName}</span>
                    <span className="text-red-600 ml-2">{r.error}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
