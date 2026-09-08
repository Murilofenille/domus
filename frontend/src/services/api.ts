import type { TuyaDeviceStatus } from '../types';

// Detecção automática inteligente de ambiente (Vite Proxy Local x Vercel)
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') {
    return import.meta.env.VITE_API_URL;
  }
  // Em desenvolvimento (Vite proxy) e produção (Vercel), rota relativa '/api' funciona em localhost, tablet e web
  return '';
};

export const API_BASE = getApiBaseUrl();

export async function fetchDeviceStatus(deviceId?: string): Promise<TuyaDeviceStatus | null> {
  try {
    const url = deviceId ? `${API_BASE}/api/status?device_id=${deviceId}` : `${API_BASE}/api/status`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Não foi possível sincronizar com o backend Tuya:', error);
    return null;
  }
}

export async function sendTuyaCommand(code: string, value: boolean, deviceId?: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, value, device_id: deviceId }),
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Erro ao enviar comando Tuya:', error);
    return false;
  }
}

export async function fetchDeviceConfig(): Promise<{
  device_rooms: Record<string, string>;
  channel_names: Record<string, Record<string, string>>;
  hidden_channels: Record<string, string[]>;
  channel_rooms: Record<string, Record<string, string>>;
  devices: Array<{
    key: string;
    name: string;
    id: string;
    online: boolean;
    room_id: string;
    switches: Record<string, boolean | number>;
    custom_channel_names: Record<string, string>;
    hidden_channels: string[];
    channel_rooms: Record<string, string>;
  }>;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Não foi possível carregar configurações do backend:', error);
    return null;
  }
}

export async function saveDeviceConfig(payload: {
  device_rooms: Record<string, string>;
  channel_names: Record<string, Record<string, string>>;
  hidden_channels: Record<string, string[]>;
  channel_rooms: Record<string, Record<string, string>>;
}): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Erro ao salvar configurações Tuya:', error);
    return false;
  }
}

