import { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CutawayHouse } from './components/CutawayHouse';
import { TopBar } from './components/TopBar';
import { SidePanel, type RoomDeviceItem } from './components/SidePanel';
import { SettingsModal, type DeviceInfoItem } from './components/SettingsModal';
import { SpotifyPlayer } from './components/SpotifyPlayer';
import { automationPins } from './houseLayout';
import type { Room } from './types';
import { fetchDeviceStatus, sendTuyaCommand, fetchDeviceConfig } from './services/api';
import { handleSpotifyCallback } from './services/spotify';

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

  // Estados do Gerenciador de Dispositivos e Canais
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [devicesList, setDevicesList] = useState<DeviceInfoItem[]>([]);
  const [deviceRooms, setDeviceRooms] = useState<Record<string, string>>({});
  const [channelNames, setChannelNames] = useState<Record<string, Record<string, string>>>({});
  const [hiddenChannels, setHiddenChannels] = useState<Record<string, string[]>>({});
  const [channelRooms, setChannelRooms] = useState<Record<string, Record<string, string>>>({});

  // Carregar configurações salvas no backend com fallback/redundância em localStorage
  const loadConfig = useCallback(async () => {
    let localBackup: any = null;
    try {
      const saved = localStorage.getItem('domus_device_config');
      if (saved) localBackup = JSON.parse(saved);
    } catch {}

    const res = await fetchDeviceConfig();
    if (res) {
      const rooms = { ...(res.device_rooms || {}), ...(localBackup?.device_rooms || {}) };
      const channels = { ...(res.channel_names || {}), ...(localBackup?.channel_names || {}) };
      const hidden = { ...(res.hidden_channels || {}), ...(localBackup?.hidden_channels || {}) };
      const chanRooms = { ...(res.channel_rooms || {}), ...(localBackup?.channel_rooms || {}) };

      setDeviceRooms(rooms);
      setChannelNames(channels);
      setHiddenChannels(hidden);
      setChannelRooms(chanRooms);
      if (res.devices) setDevicesList(res.devices);
    } else if (localBackup) {
      if (localBackup.device_rooms) setDeviceRooms(localBackup.device_rooms);
      if (localBackup.channel_names) setChannelNames(localBackup.channel_names);
      if (localBackup.hidden_channels) setHiddenChannels(localBackup.hidden_channels);
      if (localBackup.channel_rooms) setChannelRooms(localBackup.channel_rooms);
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

  return (
    <div className="app-viewport">
      {/* HUD Superior */}
      <TopBar
        isOnline={isOnline}
        activeLightsCount={activeLightsCount}
        totalLightsCount={totalLightsCount}
        onToggleAll={handleToggleAll}
        onOpenSettings={() => setIsSettingsOpen(true)}
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

      {/* HUD Inferior Esquerdo: Visão Geral da Casa & Spotify Player */}
      <div className="bottom-left-hud">
        <button
          onClick={() => setSelectedRoom(null)}
          className="overview-camera-btn"
          title="Ver Casa Inteira"
        >
          <span>🏠 Visão Geral</span>
        </button>

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
            onToggleLight={handleTogglePinLight}
            onSelectRoom={(room) => setSelectedRoom(room)}
            selectedRoomId={selectedRoom?.id}
          />

          {/* Controles de Câmera com Amortecimento Inercial Fluido (Damping) */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableDamping={true}
            dampingFactor={0.07}
            rotateSpeed={0.8}
            zoomSpeed={0.9}
            panSpeed={0.9}
            minDistance={8}
            maxDistance={80}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, 0]}
          />
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

          // Salvar também em localStorage para redundância
          try {
            localStorage.setItem('domus_device_config', JSON.stringify({
              device_rooms: updatedRooms,
              channel_names: updatedChannels,
              hidden_channels: updatedHidden,
              channel_rooms: updatedChannelRooms
            }));
          } catch {}

          setDevicesList(prev => prev.map(d => ({
            ...d,
            room_id: updatedRooms[d.key] || '',
            custom_channel_names: updatedChannels[d.key] || {},
            hidden_channels: updatedHidden[d.key] || [],
            channel_rooms: updatedChannelRooms[d.key] || {}
          })));
        }}
        onToggleSwitch={handleToggleDeviceSwitch}
      />
    </div>
  );
}


export default App;
