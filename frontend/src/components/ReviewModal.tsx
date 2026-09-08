import React, { useState } from 'react';
import { X, Star, QrCode, ExternalLink, Settings, Check } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose }) => {
  const [reviewUrl, setReviewUrl] = useState<string>(() => {
    return localStorage.getItem('domus_google_review_url') || 'https://maps.google.com';
  });
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>(reviewUrl);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    let cleanUrl = tempUrl.trim();
    if (!cleanUrl) cleanUrl = 'https://maps.google.com';
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    setReviewUrl(cleanUrl);
    localStorage.setItem('domus_google_review_url', cleanUrl);
    setIsEditingUrl(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // URL do gerador de QR Code de alta resolução
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    reviewUrl
  )}&margin=15&format=svg`;

  return (
    <div className="review-modal-overlay" onClick={onClose}>
      <div className="review-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="review-modal-header">
          <div className="review-badge">
            <Star size={12} className="text-amber-400" fill="currentColor" />
            <span>AVALIAÇÃO GOOGLE MAPS</span>
          </div>
          <button onClick={onClose} className="review-close-btn" title="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Corpo Principal */}
        <div className="review-modal-body">
          <div className="review-stars-row">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={28} className="review-star-item" fill="#F59E0B" color="#F59E0B" />
            ))}
          </div>

          <h3 className="review-title">Gostou da Nossa Área de Lazer?</h3>
          <p className="review-sub">
            Aponte a câmera do seu celular para o QR Code abaixo e deixe sua avaliação com 5 estrelas no Google Maps. Sua opinião é muito valiosa para nós!
          </p>

          {/* Card com o QR Code */}
          <div className="review-qr-container">
            <div className="review-qr-frame">
              <img
                src={qrCodeImageUrl}
                alt="QR Code de Avaliação no Google Maps"
                className="review-qr-img"
              />
            </div>
            <div className="review-qr-tip">
              <QrCode size={16} className="text-amber-500" />
              <span>Abra a câmera do celular e aponte para a tela</span>
            </div>
          </div>

          {/* Ações e Configuração de Link */}
          <div className="review-actions-footer">
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="review-direct-link"
            >
              <ExternalLink size={14} />
              <span>Abrir no Navegador</span>
            </a>

            <button
              onClick={() => {
                setTempUrl(reviewUrl);
                setIsEditingUrl(!isEditingUrl);
              }}
              className="review-config-link-btn"
              title="Configurar Link do Google Meu Negócio"
            >
              <Settings size={13} />
              <span>{isEditingUrl ? 'Cancelar' : 'Alterar Link do Google'}</span>
            </button>
          </div>

          {/* Painel expansível para o dono colar o link do Google Meu Negócio */}
          {isEditingUrl && (
            <div className="review-edit-box">
              <label className="review-edit-label">Link de Avaliação do Google Maps:</label>
              <div className="review-input-row">
                <input
                  type="text"
                  placeholder="https://g.page/r/.../review"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  className="review-url-input"
                />
                <button onClick={handleSaveUrl} className="review-url-save-btn">
                  <Check size={14} />
                  <span>Salvar</span>
                </button>
              </div>
              <span className="review-edit-hint">
                Dica: Pegue no painel do Google Meu Negócio em "Solicitar avaliações".
              </span>
            </div>
          )}

          {savedSuccess && (
            <div className="review-saved-alert">
              ✅ Link do Google Maps salvo com sucesso! O QR Code foi atualizado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
