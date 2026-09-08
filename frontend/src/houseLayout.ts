import type { Room, WallSegment, AutomationPinItem } from './types';

export const WALL_HEIGHT = 0.85;
export const WALL_THICKNESS = 0.12;

/**
 * Geometria 100% calibrada com a Planta Baixa Simplificada com os eixos corretos:
 * X: 0.00 (ESQUERDA) a 10.00 (DIREITA)
 * Z: 0.00 (TRÁS / FUNDOS) a 25.00 (FRENTE / GARAGEM)
 *
 * Visualização natural:
 * FRENTE (Garagem) no primeiro plano / parte inferior
 * TRÁS (Suíte Master / Closet) no fundo / parte superior
 * ESQUERDA (Murilo / Visitas / Lavanderia / Closet) no lado esquerdo da tela
 * DIREITA (Marina / Sala / Jantar / Suíte Master) no lado direito da tela
 */
export const rooms: Room[] = [
  // --- FRENTE: GARAGEM ---
  {
    id: "garage",
    name: "GARAGEM",
    center: [5.00, 21.66],
    size: [10.00, 6.67],
    color: "#E2DCD5",
    type: 'garage'
  },

  // --- FAIXA ESQUERDA: CORREDOR LATERAL, LAVANDERIA, CORREDOR EXTERNO ---
  // Passagem aberta ao lado da cozinha até a garagem
  {
    id: "corredor-lateral",
    name: "CORREDOR",
    center: [0.99, 16.01],
    size: [1.98, 3.64],
    color: "#E2E8F0",
    type: 'hall'
  },
  // Lavanderia (cômodo fechado pequeno entre o corredor lateral e o corredor externo)
  {
    id: "laundry",
    name: "LAVANDERIA",
    center: [0.99, 13.00],
    size: [1.98, 2.37],
    color: "#D7E8DE",
    deviceId: "eb06af9cdbe3a70513uvmv",
    deviceKey: "lavanderia",
    dpCode: "switch_1",
    type: 'laundry'
  },
  // Corredor Externo que margeia os quartos até os fundos
  {
    id: "corredor-externo",
    name: "CORREDOR EXTERNO",
    center: [0.99, 8.05],
    size: [1.98, 7.54],
    color: "#E2E8F0",
    type: 'hall'
  },

  // --- ÁREA SOCIAL / GOURMET (FRENTE) ---
  // Cozinha (Esquerda, aberta para o jantar)
  {
    id: "gourmet",
    name: "COZINHA",
    center: [3.73, 16.01],
    size: [3.50, 3.64],
    color: "#CFE6DC",
    deviceId: "eb0253512b47c620f1b3tg",
    deviceKey: "cozinha",
    dpCode: "switch_1",
    type: 'gourmet'
  },
  // Mesa de Jantar (Direita, em frente à garagem)
  {
    id: "dining",
    name: "MESA DE JANTAR",
    center: [7.74, 16.51],
    size: [4.52, 4.64],
    color: "#F4E3C1",
    deviceId: "eb4363d2fae69d1b3ak5lg",
    deviceKey: "sala",
    dpCode: "switch_3",
    type: 'dining'
  },
  // Sala de TV (Direita, acima da mesa de jantar)
  {
    id: "living",
    name: "SALA DE TV",
    center: [7.74, 13.00],
    size: [4.52, 2.37],
    color: "#F6E8CE",
    deviceId: "eb4363d2fae69d1b3ak5lg",
    deviceKey: "sala",
    dpCode: "switch_1",
    type: 'living'
  },

  // --- ALA MEIO-ESQUERDA (VISITAS E MURILO) ---
  // Suíte Visitas (Antiga Alfeo)
  {
    id: "suite",
    name: "SUÍTE VISITAS",
    center: [3.73, 12.19],
    size: [3.50, 4.00],
    color: "#DDD6EE",
    deviceId: "0076231634ab9510ba04",
    deviceKey: "quarto_alfeo",
    dpCode: "switch_1",
    type: 'bedroom'
  },
  // Banheiro Visitas (entre a Suíte Visitas e o Quarto Murilo)
  {
    id: "bath-suite",
    name: "BANHEIRO VISITAS",
    center: [3.73, 9.25],
    size: [3.50, 1.88],
    color: "#C9DFEE",
    deviceId: "eb4bb2c6b85ca80c08xen2",
    deviceKey: "banheiro_alfeo",
    dpCode: "switch_1",
    type: 'bath'
  },
  // Quarto Murilo (com Escritório Murilo embutido)
  {
    id: "bedroom-01",
    name: "QUARTO MURILO",
    center: [3.73, 6.29],
    size: [3.50, 4.03],
    color: "#D6CBEF",
    deviceId: "7173100234ab95105538",
    deviceKey: "quarto_murilo",
    dpCode: "switch_1",
    type: 'bedroom'
  },

  // --- CORREDOR CENTRAL ---
  {
    id: "hall",
    name: "CORREDOR",
    center: [6.01, 8.05],
    size: [1.05, 7.54],
    color: "#F6EBD0",
    deviceId: "7753207334ab951d4101",
    deviceKey: "corredor_principal",
    dpCode: "switch_1",
    type: 'hall'
  },

  // --- ALA MEIO-DIREITA (BANHEIRO SOCIAL, CLARABOIA E QUARTO MARINA) ---
  // Banheiro Social (recesso em frente ao corredor)
  {
    id: "bath-social",
    name: "BANHEIRO",
    center: [8.46, 11.00],
    size: [3.08, 1.63],
    color: "#C7DFEE",
    deviceId: "ebea951fa1e1900c21l4op",
    deviceKey: "banheiro_social",
    dpCode: "switch_1",
    type: 'bath'
  },
  // Claraboia (Jardim de Inverno lateral)
  {
    id: "skylight-east",
    name: "CLARABOIA",
    center: [8.27, 9.25],
    size: [3.47, 1.88],
    color: "#D3E9D2",
    deviceId: "ebbfb1b732983a19det4ng",
    deviceKey: "corredor_claraboia",
    dpCode: "switch_1",
    type: 'skylight'
  },
  // Quarto Marina
  {
    id: "bedroom-02",
    name: "QUARTO MARINA",
    center: [8.27, 6.29],
    size: [3.47, 4.03],
    color: "#D6DCF2",
    deviceId: "0076231634ab9510916c",
    deviceKey: "quarto_marina",
    dpCode: "switch_1",
    type: 'bedroom'
  },

  // --- FUNDOS / TRÁS (SUÍTE MASTER) ---
  // Corredor Suíte Master
  {
    id: "rear-hall",
    name: "CORREDOR SUÍTE MASTER",
    center: [3.94, 3.62],
    size: [3.92, 1.31],
    color: "#F6EBD0",
    deviceId: "eb7ec51b1a94acaf7ffjqx",
    deviceKey: "corredor_suite",
    dpCode: "switch_1",
    type: 'hall'
  },
  // Closet
  {
    id: "closet",
    name: "CLOSET",
    center: [0.99, 2.14],
    size: [1.98, 4.28],
    color: "#EFEBE0",
    deviceId: "0076231634ab951d1684",
    deviceKey: "closet",
    dpCode: "switch_1",
    type: 'closet'
  },
  // Banheiro Master
  {
    id: "bath-master",
    name: "BANHEIRO",
    center: [2.84, 1.49],
    size: [1.73, 2.97],
    color: "#C7DFEE",
    deviceId: "eb359369a7c7cd5cacz5cb",
    deviceKey: "banheiro_master",
    dpCode: "switch_1",
    type: 'bath'
  },
  // Claraboia Master
  {
    id: "skylight-master",
    name: "CLARABOIA",
    center: [4.80, 1.49],
    size: [2.19, 2.97],
    color: "#D3E9D2",
    type: 'skylight'
  },
  // Suíte Master
  {
    id: "master",
    name: "SUÍTE MASTER",
    center: [7.95, 2.14],
    size: [4.10, 4.28],
    color: "#D9D2F0",
    deviceId: "eb7b83c1dcb03d24231db5",
    deviceKey: "suite_master",
    dpCode: "switch_1",
    type: 'bedroom'
  }
];

/**
 * 26 Paredes arquitetônicas cortadas (Cutaway Walls)
 * Direção e eixos 100% alinhados com os identificadores do usuário:
 * X: 0 (Esquerda) a 10 (Direita)
 * Z: 0 (Trás) a 25 (Frente)
 */
export const walls: WallSegment[] = [
  // --- PAREDES PERIMETRAIS EXTERNAS ---
  { id: "west_wall", start: [0.00, 0.00], end: [0.00, 25.00] }, // Parede lateral Esquerda
  { id: "north_wall", start: [0.00, 0.00], end: [10.00, 0.00] }, // Parede dos Fundos (Trás)
  { id: "east_wall", start: [10.00, 0.00], end: [10.00, 25.00] }, // Parede lateral Direita
  { id: "south_curb", start: [0.00, 25.00], end: [10.00, 25.00], height: 0.15 }, // Cordão rebaixado na Frente da Garagem

  // --- DIVISÃO DA GARAGEM COM A CASA ---
  { id: "garage_back_left", start: [0.00, 17.83], end: [5.48, 17.83] },
  { id: "garage_step", start: [5.48, 17.83], end: [5.48, 18.83] },
  { id: "garage_back_right", start: [5.48, 18.83], end: [10.00, 18.83] },

  // --- FAIXA ESQUERDA: CORREDOR LATERAL, LAVANDERIA, CORREDOR EXTERNO ---
  { id: "wall_corredor_lat_lav", start: [0.00, 14.19], end: [1.98, 14.19] }, // Divisão Corredor Lateral / Lavanderia
  { id: "wall_lav_corredor_ext", start: [0.00, 11.82], end: [1.98, 11.82] }, // Divisão Lavanderia / Corredor Externo
  { id: "wall_faixa_esq_cozinha_suite", start: [1.98, 11.82], end: [1.98, 17.83] }, // Parede vertical Cozinha/Lavanderia
  { id: "wall_corredor_ext_quartos", start: [1.98, 4.28], end: [1.98, 11.82] }, // Parede vertical Corredor Externo
  { id: "wall_closet_bath_master", start: [1.98, 0.00], end: [1.98, 2.97] }, // Parede entre Closet e Banheiro Master

  // --- DIVISÕES HORIZONTAIS ESQUERDA/CENTRO ---
  { id: "wall_cozinha_suite", start: [1.98, 14.19], end: [5.48, 14.19] }, // Cozinha / Suíte Visitas
  { id: "wall_suite_banheiro_visitas", start: [1.98, 10.19], end: [5.48, 10.19] }, // Suíte Visitas / Banheiro Visitas
  { id: "wall_banheiro_quarto_murilo", start: [1.98, 8.31], end: [5.48, 8.31] }, // Banheiro Visitas / Quarto Murilo
  { id: "wall_top_quarto_murilo", start: [1.98, 4.28], end: [5.48, 4.28] }, // Topo Quarto Murilo / Corredor Master
  { id: "wall_top_corredor_externo", start: [0.00, 4.28], end: [1.98, 4.28] }, // Fechando Suíte Master / Corredor Externo
  { id: "wall_top_corredor_interno", start: [5.48, 4.28], end: [6.53, 4.28] }, // Fechando Suíte Master / Corredor Interno

  // --- PAREDE ESQUERDA DO CORREDOR CENTRAL ---
  { id: "wall_corredor_left", start: [5.48, 4.28], end: [5.48, 14.19] },

  // --- DIVISÕES HORIZONTAIS LADO DIREITO ---
  { id: "wall_banheiro_sala_tv", start: [6.92, 11.82], end: [10.00, 11.82] }, // Banheiro Social / Sala de TV
  { id: "wall_banheiro_claraboia", start: [6.53, 10.19], end: [10.00, 10.19] }, // Banheiro Social / Claraboia
  { id: "wall_claraboia_quarto_marina", start: [6.53, 8.31], end: [10.00, 8.31] }, // Claraboia / Quarto Marina
  { id: "wall_top_quarto_marina", start: [6.53, 4.28], end: [10.00, 4.28] }, // Topo Quarto Marina / Suíte Master

  // --- PAREDE DIREITA DO CORREDOR CENTRAL ---
  { id: "wall_bath_social_left", start: [6.92, 10.19], end: [6.92, 11.82] },
  { id: "wall_corredor_step_right", start: [6.53, 10.19], end: [6.92, 10.19] },
  { id: "wall_corredor_right", start: [6.53, 4.28], end: [6.53, 10.19] },

  // --- SUÍTE MASTER E BANHEIROS DOS FUNDOS (TRÁS) ---
  { id: "wall_master_bath_bottom", start: [1.98, 2.97], end: [5.90, 2.97] },
  { id: "wall_master_bath_claraboia", start: [3.71, 0.00], end: [3.71, 2.97] },
  { id: "wall_claraboia_suite_master", start: [5.90, 0.00], end: [5.90, 2.97] },
  { id: "wall_suite_master_left", start: [5.90, 2.97], end: [5.90, 4.28] }, // Fechando lateral da Suíte Master com o corredor
  { id: "wall_closet_right", start: [1.98, 2.97], end: [1.98, 4.28] }, // Fechando lateral do Closet com o corredor
];


/**
 * Pins de Automação Tuya nas posições espaciais corretas
 */
export const automationPins: AutomationPinItem[] = [
  {
    id: "pin-garage",
    roomId: "garage",
    name: "Garagem",
    position: [5.00, 0.35, 21.66],
    deviceId: "",
    deviceKey: "garagem",
    dpCode: "switch_1"
  },
  {
    id: "pin-cozinha",
    roomId: "gourmet",
    name: "Cozinha",
    position: [3.73, 0.35, 16.01],
    deviceId: "eb0253512b47c620f1b3tg",
    deviceKey: "cozinha",
    dpCode: "switch_1"
  },
  {
    id: "pin-jantar",
    roomId: "dining",
    name: "Mesa de Jantar",
    position: [7.74, 0.35, 16.51],
    deviceId: "eb4363d2fae69d1b3ak5lg",
    deviceKey: "sala",
    dpCode: "switch_3"
  },
  {
    id: "pin-sala",
    roomId: "living",
    name: "Sala de TV",
    position: [7.74, 0.35, 13.00],
    deviceId: "eb4363d2fae69d1b3ak5lg",
    deviceKey: "sala",
    dpCode: "switch_1"
  },
  {
    id: "pin-lavanderia",
    roomId: "laundry",
    name: "Lavanderia",
    position: [0.99, 0.35, 13.00],
    deviceId: "eb06af9cdbe3a70513uvmv",
    deviceKey: "lavanderia",
    dpCode: "switch_1"
  },
  {
    id: "pin-suite",
    roomId: "suite",
    name: "Suíte Visitas",
    position: [3.73, 0.35, 12.19],
    deviceId: "0076231634ab9510ba04",
    deviceKey: "quarto_alfeo",
    dpCode: "switch_1"
  },
  {
    id: "pin-bath-visitas",
    roomId: "bath-suite",
    name: "Banheiro Visitas",
    position: [3.73, 0.35, 9.25],
    deviceId: "eb4bb2c6b85ca80c08xen2",
    deviceKey: "banheiro_alfeo",
    dpCode: "switch_1"
  },
  // Quarto Murilo: Luz Principal
  {
    id: "pin-quarto-murilo",
    roomId: "bedroom-01",
    name: "Quarto Murilo",
    position: [4.20, 0.35, 7.20],
    deviceId: "7173100234ab95105538",
    deviceKey: "quarto_murilo",
    dpCode: "switch_1"
  },
  // Quarto Murilo: Escritório Murilo
  {
    id: "pin-escritorio-murilo",
    roomId: "bedroom-01",
    name: "Escritório Murilo",
    position: [2.65, 0.35, 5.35],
    deviceId: "eba0bc9062cb902519bv8a",
    deviceKey: "escritorio_murilo",
    dpCode: "switch_1"
  },
  {
    id: "pin-corredor",
    roomId: "hall",
    name: "Corredor",
    position: [6.01, 0.35, 8.05],
    deviceId: "7753207334ab951d4101",
    deviceKey: "corredor_principal",
    dpCode: "switch_1"
  },
  {
    id: "pin-bath-social",
    roomId: "bath-social",
    name: "Banheiro Social",
    position: [8.46, 0.35, 11.00],
    deviceId: "ebea951fa1e1900c21l4op",
    deviceKey: "banheiro_social",
    dpCode: "switch_1"
  },
  {
    id: "pin-claraboia",
    roomId: "skylight-east",
    name: "Claraboia",
    position: [8.27, 0.35, 9.25],
    deviceId: "ebbfb1b732983a19det4ng",
    deviceKey: "corredor_claraboia",
    dpCode: "switch_1"
  },
  {
    id: "pin-quarto-marina",
    roomId: "bedroom-02",
    name: "Quarto Marina",
    position: [8.27, 0.35, 6.29],
    deviceId: "0076231634ab9510916c",
    deviceKey: "quarto_marina",
    dpCode: "switch_1"
  },
  {
    id: "pin-corredor-suite",
    roomId: "rear-hall",
    name: "Corredor Suíte",
    position: [3.94, 0.35, 3.62],
    deviceId: "eb7ec51b1a94acaf7ffjqx",
    deviceKey: "corredor_suite",
    dpCode: "switch_1"
  },
  // Closet: Luz Principal
  {
    id: "pin-closet",
    roomId: "closet",
    name: "Closet",
    position: [0.99, 0.35, 3.20],
    deviceId: "0076231634ab951d1684",
    deviceKey: "closet",
    dpCode: "switch_1"
  },
  // Closet: Led Guarda Roupa
  {
    id: "pin-led-closet",
    roomId: "closet",
    name: "Led Guarda Roupa",
    position: [0.99, 0.35, 1.20],
    deviceId: "eb3a48b14417d7cd46g13x",
    deviceKey: "led_closet",
    dpCode: "switch_1"
  },
  {
    id: "pin-bath-master",
    roomId: "bath-master",
    name: "Banheiro Master",
    position: [2.84, 0.35, 1.49],
    deviceId: "eb359369a7c7cd5cacz5cb",
    deviceKey: "banheiro_master",
    dpCode: "switch_1"
  },
  {
    id: "pin-suite-master",
    roomId: "master",
    name: "Suíte Master",
    position: [7.95, 0.35, 2.14],
    deviceId: "eb7b83c1dcb03d24231db5",
    deviceKey: "suite_master",
    dpCode: "switch_1"
  }
];
