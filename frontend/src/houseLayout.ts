import type { Room, WallSegment, AutomationPinItem } from './types';

export const WALL_HEIGHT = 0.85;
export const WALL_THICKNESS = 0.12;

export const rooms: Room[] = [
  {
    id: "piscina",
    name: "PISCINA & DECK",
    center: [5.0, 0.0],
    size: [12.0, 9.0],
    color: "#087da7",
    deviceId: "1000e8f9b1",
    deviceKey: "1000e8f9b1",
    dpCode: "switch_2",
    type: 'gourmet'
  },
  {
    id: "gourmet",
    name: "ESPAÇO GOURMET",
    center: [-5.0, 0.0],
    size: [10.0, 8.0],
    color: "#D97706",
    deviceId: "1000e4a34c",
    deviceKey: "1000e4a34c",
    dpCode: "switch",
    type: 'living'
  },
  {
    id: "escada",
    name: "ACESSO & ESCADA",
    center: [0.0, 0.0],
    size: [4.0, 6.0],
    color: "#3B82F6",
    deviceId: "1000e4a34e",
    deviceKey: "1000e4a34e",
    dpCode: "switch",
    type: 'hall'
  },
  {
    id: "banheiro",
    name: "BANHEIROS",
    center: [-8.0, 3.5],
    size: [3.5, 3.0],
    color: "#64748B",
    type: 'bath'
  }
];

export const walls: WallSegment[] = [];

export const automationPins: AutomationPinItem[] = [
  {
    id: "pin-escada",
    name: "Luz Escada",
    roomId: "escada",
    deviceId: "1000e4a34e",
    deviceKey: "1000e4a34e",
    dpCode: "switch",
    position: [0.0, 1.8, 0.0]
  },
  {
    id: "pin-arandelas",
    name: "Arandela Piscina",
    roomId: "piscina",
    deviceId: "1000e4bd27",
    deviceKey: "1000e4bd27",
    dpCode: "switch",
    position: [4.6, 2.2, -4.6]
  },
  {
    id: "pin-gourmet",
    name: "Iluminação Salão",
    roomId: "gourmet",
    deviceId: "1000e4a34c",
    deviceKey: "1000e4a34c",
    dpCode: "switch",
    position: [-5.5, 2.2, 0.0]
  },
  {
    id: "pin-piscina",
    name: "Piscina",
    roomId: "piscina",
    deviceId: "1000e8f9b1",
    deviceKey: "1000e8f9b1",
    dpCode: "switch_2",
    position: [5.0, 1.2, 0.0]
  }
];
