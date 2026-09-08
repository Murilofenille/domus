import React from 'react';
import { X, Star, QrCode } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Link oficial e permanente de avaliação da Área de Lazer no Google Maps
const GOOGLE_REVIEW_URL = 'https://g.page/r/Cf8qOAkjtAgbEBM/review';

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // QR Code de alta resolução em SVG para leitura instantânea por qualquer câmera
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    GOOGLE_REVIEW_URL
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
            Aponte a câmera do seu celular para o QR Code abaixo e deixe sua avaliação com 5 estrelas no Google Maps. Sua presença foi incrível!
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
        </div>
      </div>
    </div>
  );
};
