/**
 * Utilitário de horário comercial — BRT (UTC-3).
 * Brasil aboliu o horário de verão em 2019, então UTC-3 é fixo.
 *
 * Janela permitida: 07:00 – 20:00 BRT.
 */

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3 em ms
const BUSINESS_START = 7;  // 07:00 BRT  =  10:00 UTC
const BUSINESS_END   = 20; // 20:00 BRT  =  23:00 UTC

/**
 * Retorna quantos milissegundos faltam até o próximo horário permitido.
 * Retorna 0 se já estiver dentro da janela.
 */
export function msUntilBusinessHours(now: Date = new Date()): number {
  // Representa o instante atual no "relógio BRT" usando UTC internamente
  const brtNow = new Date(now.getTime() + BRT_OFFSET_MS);
  const h = brtNow.getUTCHours();

  if (h >= BUSINESS_START && h < BUSINESS_END) {
    return 0; // dentro do horário comercial
  }

  // Próximo 07:00 BRT
  const targetBrt = new Date(brtNow);
  if (h >= BUSINESS_END) {
    // Passou das 20h → próximo dia
    targetBrt.setUTCDate(targetBrt.getUTCDate() + 1);
  }
  targetBrt.setUTCHours(BUSINESS_START, 0, 0, 0);

  // Converte de volta para UTC
  const targetUtcMs = targetBrt.getTime() - BRT_OFFSET_MS;
  return Math.max(0, targetUtcMs - now.getTime());
}

export function isWithinBusinessHours(now: Date = new Date()): boolean {
  return msUntilBusinessHours(now) === 0;
}
