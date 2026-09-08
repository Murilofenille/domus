import React, { useState, useEffect } from 'react';
import { Wifi, Power, Settings, Maximize, Minimize, Star, Home } from 'lucide-react';

interface TopBarProps {
  isOnline: boolean;
  activeLightsCount: number;
  totalLightsCount: number;
  viewMode: '3D' | '2D';
  onToggleViewMode: () => void;
  onToggleAll: () => void;
  onOpenSettings: () => void;
  onOpenReview?: () => void;
  onNavigateHome?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isOnline,
  activeLightsCount,
  totalLightsCount,
  viewMode,
  onToggleViewMode,
  onToggleAll,
  onOpenSettings,
  onOpenReview,
  onNavigateHome
}) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignora se não permitido
    }
  };

  return (
    <header className="topbar-container">
      {/* Brand & Logotipo Domus */}
      <div className="topbar-left">
        <div className="brand-logo">
          <img
            src="/LogotipoDomus.svg"
            alt="DOMUS Smart Home"
            className="topbar-brand-logo"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.triedFallback) {
                target.dataset.triedFallback = '1';
                target.src = '/logopwa.png';
              }
            }}
          />
        </div>

        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="topbar-home-btn"
            title="Ir para a Tela Inicial / Hub de Lazer"
          >
            <Home size={14} />
            <span>Início</span>
          </button>
        )}
      </div>

      {/* Estatísticas e Status */}
      <div className="topbar-center">
        <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
          <Wifi size={14} className={isOnline ? 'animate-pulse' : ''} />
          <span>{isOnline ? 'TUYA CLOUD CONECTADO' : 'CONECTANDO...'}</span>
        </div>

        <div className="light-counter-pill">
          <span className="counter-dot" style={{ background: activeLightsCount > 0 ? '#FFB703' : '#94A3B8' }} />
          <span>{activeLightsCount} de {totalLightsCount} luzes acesas</span>
        </div>

        {/* Alternador de Visualização 2D / 3D */}
        <div className="viewmode-toggle-pill" title="Alternar entre Planta Baixa 2D e Maquete 3D">
          <button
            type="button"
            className={`viewmode-tab ${viewMode === '2D' ? 'active' : ''}`}
            onClick={() => viewMode !== '2D' && onToggleViewMode()}
          >
            2D
          </button>
          <button
            type="button"
            className={`viewmode-tab ${viewMode === '3D' ? 'active' : ''}`}
            onClick={() => viewMode !== '3D' && onToggleViewMode()}
          >
            3D
          </button>
        </div>
      </div>

      {/* Ações Rápidas & Relógio */}
      <div className="topbar-right">
        {onOpenReview && (
          <button
            onClick={onOpenReview}
            className="topbar-review-btn"
            title="Avaliar nossa Área de Lazer no Google Maps"
          >
            <Star size={14} fill="#F59E0B" color="#F59E0B" />
            <span>Avaliar</span>
          </button>
        )}

        <button
          onClick={handleToggleFullscreen}
          className="topbar-settings-btn"
          title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia Total (Ocultar Barras do Android)"}
          style={{ padding: '8px 10px' }}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>

        <button
          onClick={onOpenSettings}
          className="topbar-settings-btn"
          title="Gerenciar Dispositivos e Canais"
        >
          <Settings size={14} />
          <span>Configurações</span>
        </button>

        <button
          onClick={onToggleAll}
          className="quick-action-btn"
          title={activeLightsCount > 0 ? "Desligar todas" : "Ligar todas"}
        >
          <Power size={14} />
          <span>{activeLightsCount > 0 ? "Apagar Todas" : "Ligar Todas"}</span>
        </button>

        <div className="time-display">
          <span className="clock-text">{time}</span>
        </div>
      </div>
    </header>
  );
};

