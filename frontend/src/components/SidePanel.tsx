import React from 'react';
import { Lightbulb, X, Radio } from 'lucide-react';
import type { Room } from '../types';
import { isLightSwitchChannel } from '../tuyaChannels';

export interface RoomDeviceItem {
  key: string;
  name: string;
  id: string;
  switches: Record<string, boolean | number>;
  channelNames: Record<string, string>;
  hiddenChannels?: string[];
}

interface SidePanelProps {
  selectedRoom: Room | null;
  onClose: () => void;
  deviceSwitches: Record<string, boolean | number>;
  customChannelNames?: Record<string, string>;
  roomDevices?: RoomDeviceItem[];
  onToggleSwitch: (deviceId: string, code: string, currentValue: boolean) => void;
  isSyncing: boolean;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  selectedRoom,
  onClose,
  deviceSwitches: _deviceSwitches,
  customChannelNames = {},
  roomDevices = [],
  onToggleSwitch,
  isSyncing
}) => {
  // 1. Estado sem nenhum cômodo selecionado
  if (!selectedRoom) {
    return (
      <aside className="side-panel-container">
        <div className="panel-header">
          <div className="panel-header-info">
            <div className="badge-tag">
              <Radio size={12} className="text-blue-400" />
              <span>VISÃO GERAL</span>
            </div>
            <h2 className="panel-title">Nenhum Cômodo Selecionado</h2>
            <p className="panel-sub">Clique em um cômodo na maquete 3D</p>
          </div>
        </div>

        <div className="empty-room-state">
          <p>Selecione um cômodo na casa para ver e controlar os interruptores e aparelhos associados.</p>
        </div>
      </aside>
    );
  }

  const isReal = roomDevices.length > 0 || !!selectedRoom.deviceId;

  return (
    <aside className="side-panel-container">
      {/* Cabeçalho do Card */}
      <div className="panel-header">
        <div className="panel-header-info">
          <div className="badge-tag">
            <Radio size={12} className="text-blue-400" />
            <span>{isReal ? 'DISPOSITIVOS CONECTADOS' : 'CÔMODO DA CASA'}</span>
          </div>
          <h2 className="panel-title">{selectedRoom.name}</h2>
          <p className="panel-sub">
            {roomDevices.length > 0
              ? `${roomDevices.length} aparelho(s) neste cômodo`
              : 'Sem dispositivos atribuídos'}
          </p>
        </div>
        <button onClick={onClose} className="panel-close-btn" title="Fechar">
          <X size={16} />
        </button>
      </div>

      {/* Controles de Canais Agrupados por Dispositivo */}
      <div className="switches-list">
        {roomDevices.length > 0 ? (
          roomDevices.map(dev => {
            const devSwitches = dev.switches || {};
            const devSwitchCodes = Object.keys(devSwitches)
              .filter(isLightSwitchChannel)
              .filter(k => !(dev.hiddenChannels || []).includes(k));

            if (devSwitchCodes.length === 0) return null;

            return (
              <div key={dev.key} className="sidepanel-device-group">
                <div className="sidepanel-device-title">
                  <span className="device-bullet" />
                  <span>{dev.name}</span>
                </div>

                <div className="sidepanel-device-switches">
                  {devSwitchCodes.map(code => {
                    const isOn = !!devSwitches[code];
                    const channelNumber = code.replace('switch_', '');
                    const displayName = dev.channelNames?.[code] || customChannelNames[code] || `Canal ${channelNumber}`;

                    return (
                      <div key={code} className="switch-card">
                        <div className="switch-info">
                          <div className={`switch-icon ${isOn ? 'on' : 'off'}`}>
                            <Lightbulb size={18} />
                          </div>
                          <div>
                            <div className="switch-name">{displayName}</div>
                            <div className="switch-status">{isOn ? 'Ligado' : 'Desligado'}</div>
                          </div>
                        </div>
                        <button
                          disabled={isSyncing}
                          onClick={() => onToggleSwitch(dev.id, code, isOn)}
                          className={`toggle-switch-btn ${isOn ? 'active' : ''}`}
                        >
                          <div className="toggle-thumb" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-room-state">
            <p>Nenhum dispositivo Tuya atribuído a este cômodo.</p>
            <p className="empty-room-sub">
              Abra as <b>Configurações</b> no topo para vincular interruptores ou tomadas aqui.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
