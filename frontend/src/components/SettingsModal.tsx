import React, { useState, useEffect } from 'react';
import { X, Search, Save, Check, Cpu, Lightbulb, MapPin, Tag, Eye, EyeOff } from 'lucide-react';
import { rooms } from '../houseLayout';
import { saveDeviceConfig } from '../services/api';

export interface DeviceInfoItem {
  key: string;
  name: string;
  id: string;
  online: boolean;
  room_id: string;
  switches: Record<string, boolean | number>;
  custom_channel_names: Record<string, string>;
  hidden_channels?: string[];
  channel_rooms?: Record<string, string>;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: DeviceInfoItem[];
  deviceRooms: Record<string, string>;
  channelNames: Record<string, Record<string, string>>;
  hiddenChannels?: Record<string, string[]>;
  channelRooms?: Record<string, Record<string, string>>;
  onSaveSuccess: (
    updatedRooms: Record<string, string>,
    updatedChannels: Record<string, Record<string, string>>,
    updatedHidden: Record<string, string[]>,
    updatedChannelRooms: Record<string, Record<string, string>>
  ) => void;
  onToggleSwitch?: (deviceId: string, code: string, currentValue: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  devices,
  deviceRooms,
  channelNames,
  hiddenChannels = {},
  channelRooms = {},
  onSaveSuccess,
  onToggleSwitch
}) => {
  const [localRooms, setLocalRooms] = useState<Record<string, string>>({});
  const [localChannels, setLocalChannels] = useState<Record<string, Record<string, string>>>({});
  const [localHidden, setLocalHidden] = useState<Record<string, string[]>>({});
  const [localChannelRooms, setLocalChannelRooms] = useState<Record<string, Record<string, string>>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Sincronizar estado local quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      setLocalRooms({ ...deviceRooms });
      setLocalChannels(JSON.parse(JSON.stringify(channelNames)));
      setLocalHidden(JSON.parse(JSON.stringify(hiddenChannels)));
      setLocalChannelRooms(JSON.parse(JSON.stringify(channelRooms || {})));
      setSaveMessage(null);
    }
  }, [isOpen, deviceRooms, channelNames, hiddenChannels, channelRooms]);

  if (!isOpen) return null;

  const handleRoomChange = (deviceKey: string, newRoomId: string) => {
    setLocalRooms(prev => ({
      ...prev,
      [deviceKey]: newRoomId
    }));
  };

  const handleChannelRename = (deviceKey: string, code: string, newName: string) => {
    setLocalChannels(prev => ({
      ...prev,
      [deviceKey]: {
        ...(prev[deviceKey] || {}),
        [code]: newName
      }
    }));
  };

  const handleChannelRoomChange = (deviceKey: string, code: string, roomId: string) => {
    setLocalChannelRooms(prev => {
      const devCopy = { ...(prev[deviceKey] || {}) };
      if (!roomId) {
        delete devCopy[code];
      } else {
        devCopy[code] = roomId;
      }
      return {
        ...prev,
        [deviceKey]: devCopy
      };
    });
  };

  const handleToggleHide = (deviceKey: string, code: string) => {
    setLocalHidden(prev => {
      const currentList = prev[deviceKey] || [];
      const isHidden = currentList.includes(code);
      return {
        ...prev,
        [deviceKey]: isHidden ? currentList.filter(c => c !== code) : [...currentList, code]
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    const success = await saveDeviceConfig({
      device_rooms: localRooms,
      channel_names: localChannels,
      hidden_channels: localHidden,
      channel_rooms: localChannelRooms
    });

    setIsSaving(false);
    if (success) {
      setSaveMessage('Configurações salvas com sucesso!');
      onSaveSuccess(localRooms, localChannels, localHidden, localChannelRooms);
      setTimeout(() => {
        setSaveMessage(null);
      }, 2500);
    } else {
      setSaveMessage('Erro ao salvar no servidor. Tente novamente.');
    }
  };

  // Filtragem dos dispositivos
  const filteredDevices = devices.filter(d => {
    const term = searchTerm.toLowerCase();
    const nameMatch = d.name.toLowerCase().includes(term);
    const keyMatch = d.key.toLowerCase().includes(term);
    const roomMatch = rooms.find(r => r.id === localRooms[d.key])?.name.toLowerCase().includes(term);
    return nameMatch || keyMatch || roomMatch;
  });

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-card" onClick={e => e.stopPropagation()}>
        {/* Top Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title-wrap">
            <div className="settings-icon-badge">
              <img src="/logopwa.png" alt="DOMUS" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'contain' }} />
            </div>
            <div>
              <h2 className="settings-modal-title">Gerenciador de Dispositivos</h2>
              <p className="settings-modal-sub">
                Atribua cada dispositivo Tuya a um cômodo e renomeie canais individualmente
              </p>
            </div>
          </div>
          <button className="settings-close-btn" onClick={onClose} title="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Search & Info */}
        <div className="settings-toolbar">
          <div className="settings-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nome do aparelho, cômodo ou chave..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="settings-stats-badge">
            <Cpu size={14} />
            <span>{filteredDevices.length} de {devices.length} dispositivos</span>
          </div>
        </div>

        {/* Devices List */}
        <div className="settings-devices-list">
          {filteredDevices.map(device => {
            const currentRoomId = localRooms[device.key] || '';
            const devChannels = localChannels[device.key] || {};

            // Obter códigos de canais detectados pelo cache ou sugerir padrão
            const detectedSwitchKeys = Object.keys(device.switches || {}).filter(k => k.startsWith('switch_'));
            const customKeys = Object.keys(devChannels);
            const allSwitchKeys = Array.from(new Set([...detectedSwitchKeys, ...customKeys]));
            const switchList = allSwitchKeys.length > 0 ? allSwitchKeys.sort() : ['switch_1'];

            return (
              <div key={device.key} className="settings-device-card">
                {/* Header do Dispositivo */}
                <div className="device-card-header">
                  <div className="device-card-title-group">
                    <div className="device-icon-cube">
                      <Lightbulb size={18} />
                    </div>
                    <div>
                      <div className="device-card-name">{device.name}</div>
                      <div className="device-card-meta">
                        <span className="device-key-tag">chave: {device.key}</span>
                        <span className="device-id-tag">ID: {device.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Cômodo */}
                  <div className="room-selector-group">
                    <label className="room-selector-label">
                      <MapPin size={13} />
                      <span>Cômodo Atribuído:</span>
                    </label>
                    <select
                      className="room-select"
                      value={currentRoomId}
                      onChange={e => handleRoomChange(device.key, e.target.value)}
                    >
                      <option value="">-- Nenhum Cômodo (Geral) --</option>
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Seção de Canais Agrupados */}
                <div className="device-channels-section">
                  <div className="channels-section-header">
                    <Tag size={13} />
                    <span>Canais & Interruptores deste Dispositivo</span>
                  </div>

                  <div className="channels-grid">
                    {switchList.map(code => {
                      const channelNum = code.replace('switch_', '');
                      const customName = devChannels[code] !== undefined ? devChannels[code] : '';
                      const isSwitchOn = !!device.switches?.[code];
                      const isHidden = (localHidden[device.key] || []).includes(code);

                      // Cômodo padrão do dispositivo e override individual do canal
                      const devDefaultRoom = rooms.find(r => r.id === currentRoomId);
                      const defaultLabel = devDefaultRoom ? devDefaultRoom.name : 'Geral';
                      const channelRoomId = localChannelRooms[device.key]?.[code] || '';
                      const hasRoomOverride = !!channelRoomId;

                      return (
                        <div key={code} className={`channel-item-row ${isHidden ? 'is-hidden' : ''}`}>
                          <div className="channel-code-badge">
                            {code.startsWith('switch_') ? `Canal ${channelNum}` : code}
                          </div>

                          <div className="channel-input-wrapper">
                            <input
                              type="text"
                              className="channel-name-input"
                              placeholder={`Nome para ${code} (ex: Lustre, Spots, Pendente)`}
                              value={customName}
                              onChange={e => handleChannelRename(device.key, code, e.target.value)}
                            />
                          </div>

                          {/* Seletor de Cômodo Individual do Canal */}
                          <div
                            className={`channel-room-wrapper ${hasRoomOverride ? 'has-override' : ''}`}
                            title={hasRoomOverride ? "Cômodo específico atribuído a este canal" : "Herdando o cômodo padrão do dispositivo"}
                          >
                            <MapPin size={12} className={`channel-room-icon ${hasRoomOverride ? 'has-override' : ''}`} />
                            <select
                              className={`channel-room-select ${hasRoomOverride ? 'has-override' : ''}`}
                              value={channelRoomId}
                              onChange={e => handleChannelRoomChange(device.key, code, e.target.value)}
                            >
                              <option value="">Padrão ({defaultLabel})</option>
                              {rooms.map(room => (
                                <option key={room.id} value={room.id}>
                                  {room.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            className={`channel-hide-btn ${isHidden ? 'hidden-active' : ''}`}
                            onClick={() => handleToggleHide(device.key, code)}
                            title={isHidden ? "Canal Oculto no Cômodo (clique para exibir)" : "Canal Visível (clique para ocultar no cômodo)"}
                          >
                            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{isHidden ? 'Oculto' : 'Visível'}</span>
                          </button>

                          {onToggleSwitch && (
                            <button
                              type="button"
                              className={`channel-test-toggle ${isSwitchOn ? 'on' : 'off'}`}
                              title={isSwitchOn ? "Ligado (clique para testar)" : "Desligado (clique para testar)"}
                              onClick={() => onToggleSwitch(device.id, code, isSwitchOn)}
                            >
                              <span>{isSwitchOn ? 'LIGADO' : 'DESLIGADO'}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredDevices.length === 0 && (
            <div className="settings-empty-state">
              <Search size={32} />
              <p>
                {searchTerm
                  ? `Nenhum dispositivo encontrado com a busca "${searchTerm}"`
                  : 'Nenhum dispositivo cadastrado no momento.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    marginTop: '8px',
                    padding: '6px 14px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    color: '#CBD5E1',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Limpar busca
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="settings-modal-footer">
          <div className="footer-status-msg">
            {saveMessage && (
              <span className={`status-text ${saveMessage.includes('sucesso') ? 'success' : 'error'}`}>
                {saveMessage.includes('sucesso') && <Check size={14} />}
                {saveMessage}
              </span>
            )}
          </div>

          <div className="footer-buttons">
            <button className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save size={16} />
              <span>{isSaving ? 'Salvando...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
