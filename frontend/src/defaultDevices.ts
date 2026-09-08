import type { DeviceInfoItem } from './components/SettingsModal';

export const DEFAULT_DEVICE_ROOMS: Record<string, string> = {
  "quarto_murilo": "bedroom-01",
  "escritorio_murilo": "bedroom-01",
  "sala": "living",
  "cozinha": "gourmet",
  "lavanderia": "laundry",
  "quarto_marina": "bedroom-02",
  "tomada_marina": "bedroom-02",
  "quarto_alfeo": "suite",
  "tomada_alfeo": "suite",
  "banheiro_alfeo": "suite",
  "banheiro_social": "bath-social",
  "suite_master": "master",
  "banheiro_master": "bath-master",
  "closet": "closet",
  "led_closet": "closet",
  "corredor_principal": "corredor-interno",
  "corredor_suite": "corredor-interno",
  "corredor_claraboia": "corredor-interno",
};

export const DEFAULT_CHANNEL_NAMES: Record<string, Record<string, string>> = {
  "sala": {
    "switch_1": "Spots Sala TV",
    "switch_2": "Lustre Mesa Jantar",
    "switch_3": "Fita LED Cortineiro",
    "switch_4": "Luz Central Sala",
    "switch_5": "Luz Geral Jantar",
    "switch_6": "Spots Balcão",
    "switch_7": "Luz Hall Entrada",
    "switch_8": "Spots Parede"
  },
  "quarto_murilo": {
    "switch_1": "Luz Central Quarto",
    "switch_2": "Spots Cabeceira",
    "switch_3": "Fita LED Sanca"
  },
  "escritorio_murilo": {
    "switch_1": "Luz Mesa Trabalho",
    "switch_2": "Tomada Monitor/PC"
  },
  "cozinha": {
    "switch_1": "Ilha Central",
    "switch_2": "Bancada Pia",
    "switch_3": "Armários Superiores"
  },
  "quarto_marina": {
    "switch_1": "Luz Central",
    "switch_2": "Spots Cama"
  },
  "closet": {
    "switch_1": "Luz Geral Closet",
    "switch_2": "Spots Espelho"
  },
  "led_closet": {
    "switch_1": "Barra LED Guarda-Roupa"
  },
  "lavanderia": {
    "switch_1": "Luz Principal Lavanderia"
  },
  "corredor_principal": {
    "switch_1": "Luz Corredor Central"
  },
  "corredor_suite": {
    "switch_1": "Luz Corredor Suíte Master"
  }
};

export const DEFAULT_DEVICES_LIST: DeviceInfoItem[] = [
  {
    key: "sala",
    name: "Interruptor Sala",
    id: "eb4363d2fae69d1b3ak5lg",
    online: true,
    room_id: "living",
    switches: {
      switch_1: false,
      switch_2: false,
      switch_3: false,
      switch_4: false,
      switch_5: false,
      switch_6: false,
      switch_7: false,
      switch_8: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["sala"],
    hidden_channels: []
  },
  {
    key: "cozinha",
    name: "Cozinha",
    id: "eb0253512b47c620f1b3tg",
    online: true,
    room_id: "gourmet",
    switches: {
      switch_1: false,
      switch_2: false,
      switch_3: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["cozinha"],
    hidden_channels: []
  },
  {
    key: "quarto_murilo",
    name: "Quarto Murilo",
    id: "7173100234ab95105538",
    online: true,
    room_id: "bedroom-01",
    switches: {
      switch_1: false,
      switch_2: false,
      switch_3: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["quarto_murilo"],
    hidden_channels: []
  },
  {
    key: "escritorio_murilo",
    name: "Escritório Murilo",
    id: "eba0bc9062cb902519bv8a",
    online: true,
    room_id: "bedroom-01",
    switches: {
      switch_1: false,
      switch_2: false,
      switch_3: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["escritorio_murilo"],
    hidden_channels: []
  },
  {
    key: "quarto_marina",
    name: "Quarto Marina",
    id: "0076231634ab9510916c",
    online: true,
    room_id: "bedroom-02",
    switches: {
      switch_1: false,
      switch_2: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["quarto_marina"],
    hidden_channels: []
  },
  {
    key: "tomada_marina",
    name: "Tomada Marina",
    id: "eba520de38c7edcd5cdesn",
    online: true,
    room_id: "bedroom-02",
    switches: {
      switch_1: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "quarto_alfeo",
    name: "Quarto Alfeo",
    id: "0076231634ab9510ba04",
    online: true,
    room_id: "suite",
    switches: {
      switch_1: false,
      switch_2: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "tomada_alfeo",
    name: "Tomada Alfeo",
    id: "eb2bf7de07a19292ac2kf4",
    online: true,
    room_id: "suite",
    switches: {
      switch_1: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "banheiro_alfeo",
    name: "Banheiro Alfeo",
    id: "eb4bb2c6b85ca80c08xen2",
    online: true,
    room_id: "suite",
    switches: {
      switch_1: false,
      switch_2: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "banheiro_social",
    name: "Banheiro Social",
    id: "ebea951fa1e1900c21l4op",
    online: true,
    room_id: "bath-social",
    switches: {
      switch_1: false,
      switch_2: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "suite_master",
    name: "Suíte Master",
    id: "eb7b83c1dcb03d24231db5",
    online: true,
    room_id: "master",
    switches: {
      switch_1: false,
      switch_2: false,
      switch_3: false,
      switch_4: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "banheiro_master",
    name: "Banheiro Master",
    id: "eb359369a7c7cd5cacz5cb",
    online: true,
    room_id: "bath-master",
    switches: {
      switch_1: false,
      switch_2: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "closet",
    name: "Closet",
    id: "0076231634ab951d1684",
    online: true,
    room_id: "closet",
    switches: {
      switch_1: false,
      switch_2: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["closet"],
    hidden_channels: []
  },
  {
    key: "led_closet",
    name: "Led Guarda Roupa",
    id: "eb3a48b14417d7cd46g13x",
    online: true,
    room_id: "closet",
    switches: {
      switch_1: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["led_closet"],
    hidden_channels: ["switch_inching", "switch_type"]
  },
  {
    key: "corredor_principal",
    name: "Corredor Principal",
    id: "7753207334ab951d4101",
    online: true,
    room_id: "corredor-interno",
    switches: {
      switch_1: false,
      switch_2: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["corredor_principal"],
    hidden_channels: []
  },
  {
    key: "corredor_suite",
    name: "Corredor Suíte",
    id: "eb7ec51b1a94acaf7ffjqx",
    online: true,
    room_id: "corredor-interno",
    switches: {
      switch_1: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["corredor_suite"],
    hidden_channels: []
  },
  {
    key: "corredor_claraboia",
    name: "Corredor Claraboia",
    id: "ebbfb1b732983a19det4ng",
    online: true,
    room_id: "corredor-interno",
    switches: {
      switch_1: false
    },
    custom_channel_names: {},
    hidden_channels: []
  },
  {
    key: "lavanderia",
    name: "Lavanderia",
    id: "eb06af9cdbe3a70513uvmv",
    online: true,
    room_id: "laundry",
    switches: {
      switch_1: false
    },
    custom_channel_names: DEFAULT_CHANNEL_NAMES["lavanderia"],
    hidden_channels: []
  }
];
