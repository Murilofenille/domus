export interface Room {
  id: string;
  name: string;
  center: [number, number]; // [x, z] em metros
  size: [number, number];   // [width, length] em metros
  color: string;
  pin?: [number, number, number]; // [x, y, z]
  hasLight?: boolean;
  deviceId?: string;
  deviceKey?: string;
  dpCode?: string;
  type?: 'bedroom' | 'living' | 'dining' | 'gourmet' | 'garage' | 'bath' | 'skylight' | 'hall' | 'laundry' | 'closet';
}

export interface WallSegment {
  id: string;
  start: [number, number]; // [x, z]
  end: [number, number];   // [x, z]
  height?: number;
  thickness?: number;
}

export interface AutomationPinItem {
  id: string;
  roomId: string;
  name: string;
  position: [number, number, number]; // [x, y, z] absoluto na casa
  deviceId: string;
  deviceKey: string;
  dpCode: string;
}

export interface TuyaDeviceStatus {
  online: boolean;
  devices?: Record<string, {
    device_id: string;
    online: boolean;
    switches: Record<string, boolean | number>;
  }>;
  switches?: Record<string, boolean | number>;
  updated_at: number;
}

