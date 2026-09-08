import React, { useState, useEffect } from 'react';
import { X, Wifi, QrCode, Copy, Check, Settings, Save } from 'lucide-react';
import QRCode from 'qrcode';

interface WifiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WifiConfig {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
}

const STORAGE_KEY = 'domus_leisure_wifi_config';

const DEFAULT_CONFIG: WifiConfig = {
  ssid: 'Área de Lazer Domus',
  password: 'lazerdomusfesta',
  encryption: 'WPA',
};

export const WifiModal: React.FC<WifiModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<WifiConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSsid, setEditSsid] = useState(config.ssid);
  const [editPassword, setEditPassword] = useState(config.password);

  // Gera a string padrão de conexão Wi-Fi universal (iOS / Android)
  // Sintaxe: WIFI:S:<SSID>;T:<WPA|WEP|nopass>;P:<SENHA>;;
  useEffect(() => {
    if (!isOpen) return;

    const wifiString = `WIFI:S:${config.ssid};T:${config.encryption};P:${config.password};;`;

    QRCode.toDataURL(wifiString, {
      width: 320,
      margin: 2,
      color: {
        dark: '#09090B',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Erro ao gerar QR Code de Wi-Fi:', err));
  }, [isOpen, config]);

  const handleCopyPassword = () => {
    if (!config.password) return;
    navigator.clipboard.writeText(config.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveConfig = () => {
    const updated: WifiConfig = {
      ...config,
      ssid: editSsid.trim() || 'Área de Lazer',
      password: editPassword.trim(),
    };
    setConfig(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setIsEditing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="domus-modal-overlay" onClick={onClose}>
      <div className="domus-modal-card wifi-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="domus-modal-header">
          <div className="wifi-badge">
            <Wifi size={13} className="text-blue-400" />
            <span>WI-FI PARA CONVIDADOS</span>
          </div>
          <div className="domus-header-actions">
            <button
              onClick={() => {
                setEditSsid(config.ssid);
                setEditPassword(config.password);
                setIsEditing(!isEditing);
              }}
              className="domus-header-btn"
              title={isEditing ? 'Cancelar edição' : 'Configurar nome da rede e senha'}
            >
              <Settings size={15} />
            </button>
            <button onClick={onClose} className="domus-close-btn" title="Fechar">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corpo Principal */}
        <div className="domus-modal-body">
          {isEditing ? (
            /* Modo de Edição */
            <div className="wifi-edit-form">
              <h3 className="domus-modal-title">Configurar Rede Wi-Fi</h3>
              <p className="domus-modal-sub">
                Altere o nome e a senha do Wi-Fi para gerar o QR Code correto da Área de Lazer.
              </p>

              <div className="wifi-input-group">
                <label>Nome da Rede (SSID):</label>
                <input
                  type="text"
                  value={editSsid}
                  onChange={(e) => setEditSsid(e.target.value)}
                  placeholder="Ex: Área de Lazer"
                  className="domus-input"
                />
              </div>

              <div className="wifi-input-group">
                <label>Senha do Wi-Fi:</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Senha da rede"
                  className="domus-input"
                />
              </div>

              <button onClick={handleSaveConfig} className="domus-save-btn">
                <Save size={16} />
                <span>Salvar e Atualizar QR Code</span>
              </button>
            </div>
          ) : (
            /* Visualização do QR Code e Dados */
            <>
              <h3 className="domus-modal-title">Conecte-se ao Wi-Fi</h3>
              <p className="domus-modal-sub">
                Aponte a câmera do seu celular para o QR Code abaixo para conectar automaticamente à rede da Área de Lazer.
              </p>

              {/* QR Code Container */}
              <div className="domus-qr-wrapper">
                <div className="domus-qr-frame">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="QR Code Wi-Fi" className="domus-qr-img" />
                  ) : (
                    <div className="domus-qr-placeholder">Gerando QR Code...</div>
                  )}
                </div>
                <div className="domus-qr-tip">
                  <QrCode size={15} className="text-blue-400" />
                  <span>Conexão rápida sem precisar digitar senha</span>
                </div>
              </div>

              {/* Dados Manuais da Rede */}
              <div className="wifi-info-box">
                <div className="wifi-info-row">
                  <span className="wifi-info-label">Rede:</span>
                  <span className="wifi-info-val font-semibold">{config.ssid}</span>
                </div>
                <div className="wifi-info-row">
                  <span className="wifi-info-label">Senha:</span>
                  <span className="wifi-info-val font-mono">{config.password}</span>
                  <button
                    onClick={handleCopyPassword}
                    className="wifi-copy-btn"
                    title="Copiar senha"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Copiada!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
