import React, { useState, useEffect } from 'react';
import { X, Users, Copy, Check, Edit3, Save, Sparkles, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';

interface SpotifyJamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'domus_spotify_jam_link';

export const SpotifyJamModal: React.FC<SpotifyJamModalProps> = ({ isOpen, onClose }) => {
  const [jamLink, setJamLink] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved || 'https://open.spotify.com';
    } catch {
      return 'https://open.spotify.com';
    }
  });

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLink, setEditLink] = useState(jamLink);

  useEffect(() => {
    if (!isOpen) return;

    const linkToRender = jamLink.trim() || 'https://open.spotify.com';

    QRCode.toDataURL(linkToRender, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Erro ao gerar QR Code do Spotify Jam:', err));
  }, [isOpen, jamLink]);

  const handleCopyLink = () => {
    if (!jamLink) return;
    navigator.clipboard.writeText(jamLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveLink = () => {
    const formatted = editLink.trim() || 'https://open.spotify.com';
    setJamLink(formatted);
    localStorage.setItem(STORAGE_KEY, formatted);
    setIsEditing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="domus-modal-overlay" onClick={onClose}>
      <div className="domus-modal-card jam-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="domus-modal-header">
          <div className="jam-badge">
            <span className="jam-dot" />
            <Users size={13} className="text-emerald-400" />
            <span>SPOTIFY JAM • FILA DA FESTA</span>
          </div>
          <div className="domus-header-actions">
            <button
              onClick={() => {
                setEditLink(jamLink);
                setIsEditing(!isEditing);
              }}
              className="domus-header-btn"
              title={isEditing ? 'Cancelar edição' : 'Alterar Link da Sessão Jam'}
            >
              <Edit3 size={15} />
            </button>
            <button onClick={onClose} className="domus-close-btn" title="Fechar">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corpo Principal */}
        <div className="domus-modal-body">
          {isEditing ? (
            /* Modo de Edição do Link */
            <div className="jam-edit-form">
              <h3 className="domus-modal-title">Link do Spotify Jam</h3>
              <p className="domus-modal-sub">
                No app do Spotify (celular ou tablet), inicie um <strong>Jam</strong>, copie o link de convite e cole abaixo para atualizar o QR Code dos convidados.
              </p>

              <div className="wifi-input-group">
                <label>Link de Convite do Jam:</label>
                <input
                  type="url"
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  placeholder="https://spotify.link/... ou https://open.spotify.com/..."
                  className="domus-input"
                />
              </div>

              <button onClick={handleSaveLink} className="domus-save-btn jam-save">
                <Save size={16} />
                <span>Salvar e Gerar Novo QR Code</span>
              </button>
            </div>
          ) : (
            /* Exibição do QR Code da Fila da Festa */
            <>
              <h3 className="domus-modal-title">Coloque sua Música na Fila!</h3>
              <p className="domus-modal-sub">
                Aponte a câmera do seu celular para entrar na <strong>Sessão Jam</strong> da Área de Lazer e escolher o que vai tocar.
              </p>

              {/* QR Code Container */}
              <div className="domus-qr-wrapper jam-qr-wrapper">
                <div className="domus-qr-frame">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="QR Code Spotify Jam" className="domus-qr-img" />
                  ) : (
                    <div className="domus-qr-placeholder">Gerando QR Code...</div>
                  )}
                </div>
                <div className="domus-qr-tip jam-tip">
                  <Sparkles size={15} className="text-emerald-400" />
                  <span>Todos na festa podem adicionar músicas pelo celular</span>
                </div>
              </div>

              {/* Ações de Compartilhamento */}
              <div className="jam-share-bar">
                <button onClick={handleCopyLink} className="jam-action-btn">
                  {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  <span>{copied ? 'Link Copiado!' : 'Copiar Link do Jam'}</span>
                </button>

                <a
                  href={jamLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="jam-action-btn subtle"
                  title="Abrir no Spotify"
                >
                  <ExternalLink size={15} />
                  <span>Abrir</span>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
