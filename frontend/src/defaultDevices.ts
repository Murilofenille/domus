import type { DeviceInfoItem } from './components/SettingsModal';

export const DEFAULT_DEVICE_ROOMS: Record<string, string> = {
  "1000e4a34e": "escada",
  "1000e4bd27": "piscina",
  "1000e4a34c": "gourmet",
  "1000e8f9b1": "piscina",
  "termostato": "piscina"
};

export const DEFAULT_CHANNEL_NAMES: Record<string, Record<string, string>> = {
  "1000e8f9b1": {
    "switch_1": "Cascata",
    "switch_2": "Iluminação Piscina",
    "switch_3": "Hidromassagem",
    "switch_4": "Bomba Filtro"
  },
  "1000e4a34e": {
    "switch": "Luz Escada"
  },
  "1000e4bd27": {
    "switch": "Arandela Piscina"
  },
  "1000e4a34c": {
    "switch": "Iluminação Salão"
  },
  "termostato": {
    "switch": "Aquecimento Piscina"
  }
};

export const DEFAULT_DEVICES_LIST: DeviceInfoItem[] = [
  {
    key: "1000e4a34e",
    name: "Luz Escada",
    id: "1000e4a34e",
    online: true,
    room_id: "escada",
    switches: {
      switch: false
    },
    custom_channel_names: { switch: "Luz Escada" },
    hidden_channels: []
  },
  {
    key: "1000e4bd27",
    name: "Arandela Piscina",
    id: "1000e4bd27",
    online: true,
    room_id: "piscina",
    switches: {
      switch: false
    },
    custom_channel_names: { switch: "Arandela Piscina" },
    hidden_channels: []
  },
  {
    key: "1000e4a34c",
    name: "Iluminação Salão Inferior",
    id: "1000e4a34c",
    online: true,
    room_id: "gourmet",
    switches: {
      switch: false
    },
    custom_channel_names: { switch: "Iluminação Salão" },
    hidden_channels: []
  },
  {
    key: "1000e8f9b1",
    name: "Piscina",
    id: "1000e8f9b1",
    online: true,
    room_id: "piscina",
    switches: {
      switch_1: false,
      switch_2: false,
      switch_3: false,
      switch_4: false
    },
    custom_channel_names: {
      switch_1: "Cascata",
      switch_2: "Iluminação Piscina",
      switch_3: "Hidromassagem",
      switch_4: "Bomba Filtro"
    },
    hidden_channels: []
  },
  {
    key: "termostato",
    name: "Termostato Piscina",
    id: "ebb44c0ed17053d7ba7c57",
    online: true,
    room_id: "piscina",
    switches: {
      switch: true,
      temp_current: 310,
      temp_set: 32
    },
    custom_channel_names: {},
    hidden_channels: []
  }
];
