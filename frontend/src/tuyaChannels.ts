/**
 * Utilitários para filtragem e classificação de canais (DPs) da Tuya.
 * Distingue canais reais de iluminação/relé de Data Points (DPs) de configuração do hardware.
 */

export const CONFIGURATION_DP_KEYWORDS = [
  'inching',        // Inching / Temporizador de pulso
  'type',           // Tipo de botão físico (rocker / bounce)
  'backlight',      // Luz de fundo noturna da tecla do interruptor
  'relay_status',   // Comportamento pós queda de energia
  'countdown',      // Contagem regressiva
  'indicator',      // Modo de LED indicador
  'child_lock',     // Bloqueio infantil
  'cycle_time',     // Ciclo
  'random_time'     // Aleatório
];

/**
 * Retorna true se o código DP for um canal real de iluminação/carga elétrica.
 * Retorna false se for um parâmetro de configuração do interruptor.
 */
export function isLightSwitchChannel(code: string): boolean {
  if (!code) return false;
  const lower = code.toLowerCase();

  // Se contém qualquer termo de configuração do aparelho, descarta
  for (const keyword of CONFIGURATION_DP_KEYWORDS) {
    if (lower.includes(keyword)) {
      return false;
    }
  }

  // Canais reais de carga/iluminação
  return lower.startsWith('switch_') || lower === 'switch';
}
