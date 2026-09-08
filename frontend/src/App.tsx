import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CutawayHouse } from './components/CutawayHouse';
import { TopBar } from './components/TopBar';
import { SidePanel, type RoomDeviceItem } from './components/SidePanel';
import { SettingsModal, type DeviceInfoItem } from './components/SettingsModal';
import { SpotifyPlayer } from './components/SpotifyPlayer';
import { ReviewModal } from './components/ReviewModal';
import { automationPins } from './houseLayout';
import { DEFAULT_DEVICES_LIST, DEFAULT_DEVICE_ROOMS, DEFAULT_CHANNEL_NAMES } from './defaultDevices';
import type { Room } from './types';
import { fetchDeviceStatus, sendTuyaCommand, fetchDeviceConfig } from './services/api';
import { handleSpotifyCallback } from './services/spotify';

interface CameraControllerProps {
  viewMode: '3D' | '2D';
}

function CameraController({ viewMode }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (controlsRef.current) {
      if (viewMode === '2D') {
        // Câmera no topo absoluto olhando para baixo (planta baixa pura)
        camera.position.set(0, 36, 0.001);
        camera.up.set(0, 0, -1); // Orienta planta: garagem embaixo, quartos em cima
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      } else {
        // Modo 3D isométrico fluido
        camera.position.set(12, 24, 25);
        camera.up.set(0, 1, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [viewMode, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={viewMode === '3D'}
      enableDamping={true}
      dampingFactor={0.07}
      rotateSpeed={0.8}
      zoomSpeed={0.9}
      panSpeed={0.9}
      minDistance={6}
      maxDistance={80}
      minPolarAngle={viewMode === '2D' ? 0 : 0}
      maxPolarAngle={viewMode === '2D' ? 0.001 : Math.PI / 2.1}
      target={[0, 0, 0]}
    />
  );
}

export function App() {
  // Mapa de estados de iluminação da maquete 3D { [pinId]: boolean }
  const [lightStates, setLightStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    automationPins.forEach(p => { initial[p.id] = false; });
    return initial;
  });

  // Mapa de status por deviceKey: { [deviceKey]: Record<string, boolean | number> }
  const [allDevicesData, setAllDevicesData] = useState<Record<string, Record<string, boolean | number>>>({});

  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');

  // Estados do Gerenciador de Dispositivos e Canais (com inicialização imediata e fallback resiliente)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const [devicesList, setDevicesList] = useState<DeviceInfoItem[]>(() => {
    try {
      const saved = localStorage.getItem('domus_device_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.devices && Array.isArray(parsed.devices) && parsed.devices.length > 0) {
          return parsed.devices;
        }
      }
    } catch {}
    return DEFAULT_DEVICES_LIST;
  });

  const [deviceRooms, setDeviceRooms] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('domus_device_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.device_rooms) return { ...DEFAULT_DEVICE_ROOMS, ...parsed.device_rooms };
      }
    } catch {}
    return DEFAULT_DEVICE_ROOMS;
  });

  const [channelNames, setChannelNames] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('domus_device_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.channel_names) return { ...DEFAULT_CHANNEL_NAMES, ...parsed.channel_names };
      }
    } catch {}
    return DEFAULT_CHANNEL_NAMES;
  });

  const [hiddenChannels, setHiddenChannels] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('domus_device_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.hidden_channels) return parsed.hidden_channels;
      }
    } catch {}
    return { led_closet: ['switch_inching', 'switch_type'] };
  });

  const [channelRooms, setChannelRooms] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('domus_device_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.channel_rooms) return parsed.channel_rooms;
      }
    } catch {}
    return {};
  });

  // Carregar configurações salvas no backend com fallback/redundância em localStorage
  const loadConfig = useCallback(async () => {
    let localBackup: any = null;
    try {
      const saved = localStorage.getItem('domus_device_config');
      if (saved) localBackup = JSON.parse(saved);
    } catch {}

    const res = await fetchDeviceConfig();
    if (res) {
      const rooms = { ...DEFAULT_DEVICE_ROOMS, ...(res.device_rooms || {}), ...(localBackup?.device_rooms || {}) };
      const channels = { ...DEFAULT_CHANNEL_NAMES, ...(res.channel_names || {}), ...(localBackup?.channel_names || {}) };
      const hidden = { ...(res.hidden_channels || {}), ...(localBackup?.hidden_channels || {}) };
      const chanRooms = { ...(res.channel_rooms || {}), ...(localBackup?.channel_rooms || {}) };

      setDeviceRooms(rooms);
      setChannelNames(channels);
      setHiddenChannels(hidden);
      setChannelRooms(chanRooms);

      if (res.devices && res.devices.length > 0) {
        setDevicesList(res.devices);
      }
    } else if (localBackup) {
      if (localBackup.device_rooms) setDeviceRooms(prev => ({ ...DEFAULT_DEVICE_ROOMS, ...prev, ...localBackup.device_rooms }));
      if (localBackup.channel_names) setChannelNames(prev => ({ ...DEFAULT_CHANNEL_NAMES, ...prev, ...localBackup.channel_names }));
      if (localBackup.hidden_channels) setHiddenChannels(localBackup.hidden_channels);
      if (localBackup.channel_rooms) setChannelRooms(localBackup.channel_rooms);
      if (localBackup.devices && localBackup.devices.length > 0) setDevicesList(localBackup.devices);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Tratar retorno de login do Spotify OAuth PKCE (?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateVerifier = params.get('state');

    if (code) {
      handleSpotifyCallback(code, stateVerifier).then(() => {
        // Notificar outras abas ou janela do PWA
        try {
          const bc = new BroadcastChannel('spotify_auth_channel');
          bc.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' });
          bc.close();
        } catch {}

        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' }, '*');
            window.close();
          } catch {}
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, []);

  // Sincronização periódica com todos os dispositivos da casa
  const syncWithTuya = useCallback(async () => {
    const data = await fetchDeviceStatus();
    if (data && data.online) {
      setIsOnline(true);
      if (data.devices) {
        const nextDevicesData: Record<string, Record<string, boolean | number>> = {};
        const nextLightStates: Record<string, boolean> = {};

        // Atualizar cada dispositivo Tuya no cache
        Object.entries(data.devices).forEach(([devKey, dev]) => {
          nextDevicesData[devKey] = dev.switches || {};
        });

        // Atualizar cada pin interativo mapeado
        automationPins.forEach((pin) => {
          if (pin.deviceKey && data.devices![pin.deviceKey]) {
            const dev = data.devices![pin.deviceKey];
            const dp = pin.dpCode || 'switch_1';
            nextLightStates[pin.id] = !!dev.switches?.[dp];
          } else {
            nextLightStates[pin.id] = lightStates[pin.id] || false;
          }
        });

        setAllDevicesData(nextDevicesData);
        setLightStates(prev => ({ ...prev, ...nextLightStates }));

        // Atualizar também o estado online e switches da lista de dispositivos
        setDevicesList(prev => {
          const base = prev.length > 0 ? prev : DEFAULT_DEVICES_LIST;
          return base.map(item => {
            const live = data.devices![item.key] || data.devices![item.id];
            if (live) {
              return {
                ...item,
                online: live.online !== false,
                switches: { ...item.switches, ...(live.switches || {}) }
              };
            }
            return item;
          });
        });
      }
    } else {
      setIsOnline(false);
    }
  }, [lightStates]);

  // Polling periódico (a cada 3.5 segundos, pausando se a tela do tablet apagar)
  useEffect(() => {
    syncWithTuya();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncWithTuya();
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [syncWithTuya]);

  // Alternar qualquer switch de qualquer dispositivo da casa
  const handleToggleDeviceSwitch = async (deviceId: string, code: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Atualização otimista imediata na cena 3D e nos cards
    const pinToUpdate = automationPins.find(p => p.deviceId === deviceId && (p.dpCode === code || !p.dpCode));
    if (pinToUpdate) {
      setLightStates(prev => ({ ...prev, [pinToUpdate.id]: newValue }));
    }

    if (pinToUpdate?.deviceKey) {
      setAllDevicesData(prev => ({
        ...prev,
        [pinToUpdate.deviceKey]: {
          ...prev[pinToUpdate.deviceKey],
          [code]: newValue
        }
      }));
    }

    setIsSyncing(true);
    const success = await sendTuyaCommand(code, newValue, deviceId);
    setIsSyncing(false);

    if (!success) {
      // Reverter se der erro
      if (pinToUpdate) {
        setLightStates(prev => ({ ...prev, [pinToUpdate.id]: currentValue }));
      }
      if (pinToUpdate?.deviceKey) {
        setAllDevicesData(prev => ({
          ...prev,
          [pinToUpdate.deviceKey]: {
            ...prev[pinToUpdate.deviceKey],
            [code]: currentValue
          }
        }));
      }
    }
  };

  // Clique direto no Pin 3D da casa
  const handleTogglePinLight = async (pinId: string) => {
    const pin = automationPins.find(p => p.id === pinId);
    if (pin && pin.deviceId) {
      const dp = pin.dpCode || 'switch_1';
      const current = !!lightStates[pinId];
      await handleToggleDeviceSwitch(pin.deviceId, dp, current);
    } else {
      setLightStates(prev => ({ ...prev, [pinId]: !prev[pinId] }));
    }
  };

  // Alternar todas as luzes da casa
  const handleToggleAll = () => {
    const activeCount = Object.values(lightStates).filter(Boolean).length;
    const shouldTurnOn = activeCount === 0;

    const nextState: Record<string, boolean> = {};
    automationPins.forEach(p => { nextState[p.id] = shouldTurnOn; });
    setLightStates(nextState);

    // Enviar comando para os dispositivos reais principais
    automationPins.forEach(p => {
      if (p.deviceId) {
        sendTuyaCommand(p.dpCode || 'switch_1', shouldTurnOn, p.deviceId);
      }
    });
  };

  const activeLightsCount = Object.values(lightStates).filter(Boolean).length;
  const totalLightsCount = automationPins.length;

  const currentRoomKey = selectedRoom?.deviceKey || '';
  const currentRoomSwitches = currentRoomKey ? (allDevicesData[currentRoomKey] || {}) : {};

  // Dispositivos dinamicamente atribuídos a este cômodo através do Gerenciador de Configurações
  // Suporta herança: se um canal não tem cômodo específico, herda o do dispositivo
  const currentRoomDevices: RoomDeviceItem[] = useMemo(() => {
    if (!selectedRoom) return [];

    const result: RoomDeviceItem[] = [];

    devicesList.forEach(dev => {
      const devSwitches = allDevicesData[dev.key] || dev.switches || {};
      const devCustomNames = channelNames[dev.key] || dev.custom_channel_names || {};
      const devHidden = hiddenChannels[dev.key] || dev.hidden_channels || [];

      // Obter todos os canais conhecidos deste aparelho
      const detectedSwitchKeys = Object.keys(devSwitches).filter(k => k.startsWith('switch_'));
      const customKeys = Object.keys(devCustomNames);
      const allCodes = Array.from(new Set([...detectedSwitchKeys, ...customKeys]));
      const switchCodes = allCodes.length > 0 ? allCodes.sort() : ['switch_1'];

      // Filtrar apenas os canais cujo cômodo efetivo é o selecionado
      const matchingCodes = switchCodes.filter(code => {
        const channelOverride = channelRooms[dev.key]?.[code];
        if (channelOverride) {
          return channelOverride === selectedRoom.id;
        }
        // Sem override específico: herda o cômodo atribuído ao dispositivo
        const devAssignedRoom = deviceRooms[dev.key] || dev.room_id;
        if (devAssignedRoom) {
          return devAssignedRoom === selectedRoom.id;
        }
        return selectedRoom.deviceKey === dev.key;
      });

      if (matchingCodes.length > 0) {
        // Objeto de switches contendo apenas os canais deste cômodo
        const roomSwitches: Record<string, boolean | number> = {};
        matchingCodes.forEach(code => {
          roomSwitches[code] = devSwitches[code] ?? false;
        });

        result.push({
          key: dev.key,
          name: dev.name,
          id: dev.id,
          switches: roomSwitches,
          channelNames: devCustomNames,
          hiddenChannels: devHidden
        });
      }
    });

    return result;
  }, [selectedRoom, devicesList, allDevicesData, channelNames, hiddenChannels, channelRooms, deviceRooms]);

  // Mapa de atividade de cada cômodo: true se QUALQUER luz/canal daquele cômodo estiver ligado
  const roomActiveStates: Record<string, boolean> = useMemo(() => {
    const map: Record<string, boolean> = {};

    // 1. Verificar através de allDevicesData e mapeamento de cômodos (canais reais Tuya)
    devicesList.forEach(dev => {
      const devSwitches = allDevicesData[dev.key] || dev.switches || {};
      const devRoom = deviceRooms[dev.key] || dev.room_id;

      Object.entries(devSwitches).forEach(([code, val]) => {
        if (code.startsWith('switch_') && Boolean(val)) {
          const specificRoom = channelRooms[dev.key]?.[code] || devRoom;
          if (specificRoom) {
            map[specificRoom] = true;
          }
        }
      });
    });

    // 2. Verificar também através de lightStates dos pins da maquete
    automationPins.forEach(pin => {
      if (lightStates[pin.id]) {
        map[pin.roomId] = true;
      }
    });

    return map;
  }, [devicesList, allDevicesData, deviceRooms, channelRooms, lightStates]);

  return (
    <div className="app-viewport">
      {/* HUD Superior */}
      <TopBar
        isOnline={isOnline}
        activeLightsCount={activeLightsCount}
        totalLightsCount={totalLightsCount}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(v => v === '3D' ? '2D' : '3D')}
        onToggleAll={handleToggleAll}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenReview={() => setIsReviewOpen(true)}
      />

      {/* Painel Lateral com Controles Dinâmicos */}
      <SidePanel
        selectedRoom={selectedRoom}
        onClose={() => setSelectedRoom(null)}
        deviceSwitches={currentRoomSwitches}
        customChannelNames={channelNames[currentRoomKey] || {}}
        roomDevices={currentRoomDevices}
        onToggleSwitch={handleToggleDeviceSwitch}
        isSyncing={isSyncing}
      />

      {/* HUD Inferior Esquerdo: Spotify Player */}
      <div className="bottom-left-hud">
        <SpotifyPlayer />
      </div>

      {/* Canvas 3D Isométrico Otimizado para Tablets */}
      <div className="canvas-wrapper">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            powerPreference: 'high-performance',
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true
          }}
          camera={{
            position: [12, 24, 25],
            fov: 34,
            near: 0.1,
            far: 1000
          }}
        >
          <color attach="background" args={["#EEF2F6"]} />
          <ambientLight intensity={1.5} />

          {/* Sol / Luz Direcional com sombras arquitetônicas suaves (1024x1024 para alta fluidez) */}
          <directionalLight
            position={[-15, 30, 20]}
            intensity={2.2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0001}
          />
          <directionalLight position={[15, 15, -20]} intensity={0.8} />

          {/* Maquete da Casa com Cômodos e Mobília */}
          <CutawayHouse
            lightStates={lightStates}
            roomActiveStates={roomActiveStates}
            onToggleLight={handleTogglePinLight}
            onSelectRoom={(room) => setSelectedRoom(room)}
            selectedRoomId={selectedRoom?.id}
            viewMode={viewMode}
          />

          {/* Controles de Câmera com Alternância 2D / 3D */}
          <CameraController viewMode={viewMode} />
        </Canvas>
      </div>

      {/* Modal Gerenciador de Dispositivos e Canais */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        devices={devicesList}
        deviceRooms={deviceRooms}
        channelNames={channelNames}
        hiddenChannels={hiddenChannels}
        channelRooms={channelRooms}
        onSaveSuccess={(updatedRooms, updatedChannels, updatedHidden, updatedChannelRooms) => {
          setDeviceRooms(updatedRooms);
          setChannelNames(updatedChannels);
          setHiddenChannels(updatedHidden);
          setChannelRooms(updatedChannelRooms);

          const updatedDevices = devicesList.map(d => ({
            ...d,
            room_id: updatedRooms[d.key] || '',
            custom_channel_names: updatedChannels[d.key] || {},
            hidden_channels: updatedHidden[d.key] || [],
            channel_rooms: updatedChannelRooms[d.key] || {}
          }));
          setDevicesList(updatedDevices);

          // Salvar também em localStorage para redundância
          try {
            localStorage.setItem('domus_device_config', JSON.stringify({
              devices: updatedDevices,
              device_rooms: updatedRooms,
              channel_names: updatedChannels,
              hidden_channels: updatedHidden,
              channel_rooms: updatedChannelRooms
            }));
          } catch {}
        }}
        onToggleSwitch={handleToggleDeviceSwitch}
      />

      {/* Modal de Avaliação no Google Maps */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
      />
    </div>
  );
}


export default App;
