import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, Volume2, ChevronDown, ChevronUp, LogOut } from 'lucide-react';
import {
  isSpotifyConnected,
  loginWithSpotify,
  logoutSpotify,
  fetchPlaybackState,
  toggleSpotifyPlay,
  nextSpotifyTrack,
  previousSpotifyTrack,
  type SpotifyTrack,
} from '../services/spotify';

export const SpotifyPlayer: React.FC = () => {
  const [connected, setConnected] = useState<boolean>(() => isSpotifyConnected());
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Busca periódica do status da música
  const syncPlayback = useCallback(async () => {
    if (!isSpotifyConnected()) {
      setConnected(false);
      setTrack(null);
      return;
    }
    setConnected(true);
    const data = await fetchPlaybackState();
    setTrack(data);
  }, []);

  useEffect(() => {
    if (!connected) return;

    syncPlayback();
    // Se estiver tocando, atualiza a cada 2.8s; se pausado, a cada 6s
    const delay = track?.isPlaying ? 2800 : 6000;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncPlayback();
      }
    }, delay);

    return () => clearInterval(interval);
  }, [connected, track?.isPlaying, syncPlayback]);

  // Controles
  const handleTogglePlay = async () => {
    if (!track || isBusy) return;
    setIsBusy(true);
    const prevPlaying = track.isPlaying;
    setTrack({ ...track, isPlaying: !prevPlaying });

    await toggleSpotifyPlay(prevPlaying);
    setTimeout(syncPlayback, 400);
    setIsBusy(false);
  };

  const handleNext = async () => {
    if (isBusy) return;
    setIsBusy(true);
    await nextSpotifyTrack();
    setTimeout(syncPlayback, 500);
    setIsBusy(false);
  };

  const handlePrevious = async () => {
    if (isBusy) return;
    setIsBusy(true);
    await previousSpotifyTrack();
    setTimeout(syncPlayback, 500);
    setIsBusy(false);
  };

  const handleLogout = () => {
    logoutSpotify();
    setConnected(false);
    setTrack(null);
  };

  // Formatar milissegundos para mm:ss
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 1. Estado Não Conectado
  if (!connected) {
    return (
      <div className="spotify-connect-widget">
        <button
          onClick={loginWithSpotify}
          className="spotify-connect-btn"
          title="Conectar sua conta do Spotify"
        >
          <svg className="spotify-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.306c-.217.355-.678.47-1.033.253-2.828-1.728-6.388-2.119-10.582-1.16-.407.093-.814-.162-.907-.568-.093-.406.162-.813.568-.906 4.6-.1.05 8.547.487 11.7 2.414.355.217.47.678.254 1.033zm1.467-3.262c-.273.444-.855.586-1.299.313-3.238-1.99-8.175-2.566-12.006-1.403-.498.151-1.026-.134-1.177-.632-.152-.498.134-1.026.632-1.178 4.38-1.33 9.82-.693 13.537 1.6 4.444.274.586.855.313 1.3zm.126-3.41c-3.882-2.305-10.292-2.518-14.01-1.388-.596.181-1.229-.158-1.41-.754-.182-.596.158-1.229.754-1.41 4.269-1.296 11.35-1.045 15.823 1.611.536.318.71 1.013.392 1.549-.318.536-1.013.71-1.549.392z" />
          </svg>
          <span>Conectar Spotify</span>
        </button>
      </div>
    );
  }

  // 2. Estado Conectado mas sem música tocando no momento
  if (!track) {
    return (
      <div className="spotify-card-container idle">
        <div className="spotify-idle-content">
          <div className="spotify-idle-icon">
            <Music size={18} />
          </div>
          <div className="spotify-idle-info">
            <span className="spotify-idle-title">Spotify Conectado</span>
            <span className="spotify-idle-sub">Abra o Spotify e dê play</span>
          </div>
          <button onClick={handleLogout} className="spotify-btn-ghost" title="Desconectar Spotify">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    );
  }

  // 3. Estado Minimizado
  if (isMinimized) {
    return (
      <div className="spotify-mini-pill" onClick={() => setIsMinimized(false)}>
        {track.albumArt ? (
          <img src={track.albumArt} alt={track.name} className={`spotify-mini-art ${track.isPlaying ? 'rotating' : ''}`} />
        ) : (
          <Music size={16} />
        )}
        <div className="spotify-mini-text">
          <span className="spotify-mini-title">{track.name}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTogglePlay();
          }}
          className="spotify-mini-play"
        >
          {track.isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <ChevronUp size={14} className="spotify-expand-icon" />
      </div>
    );
  }

  // 4. Player Completo no Canto Inferior Esquerdo
  const progressPercent = track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0;

  return (
    <div className="spotify-card-container">
      {/* Topo do Card: Dispositivo & Minimizar */}
      <div className="spotify-card-top">
        <div className="spotify-device-tag">
          <Volume2 size={12} className="text-green-400" />
          <span>{track.deviceName}</span>
        </div>
        <div className="spotify-top-actions">
          <button onClick={() => setIsMinimized(true)} className="spotify-btn-icon" title="Minimizar Player">
            <ChevronDown size={14} />
          </button>
          <button onClick={handleLogout} className="spotify-btn-icon" title="Desconectar Spotify">
            <LogOut size={12} />
          </button>
        </div>
      </div>

      {/* Meio: Capa & Informações da Faixa */}
      <div className="spotify-track-body">
        <div className="spotify-art-wrapper">
          {track.albumArt ? (
            <img
              src={track.albumArt}
              alt={track.name}
              className={`spotify-album-cover ${track.isPlaying ? 'active' : ''}`}
            />
          ) : (
            <div className="spotify-art-placeholder">
              <Music size={24} />
            </div>
          )}
          {track.isPlaying && <div className="spotify-art-glow" />}
        </div>

        <div className="spotify-track-details">
          <h4 className="spotify-track-title" title={track.name}>
            {track.name}
          </h4>
          <p className="spotify-track-artist" title={track.artists}>
            {track.artists}
          </p>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="spotify-progress-container">
        <div className="spotify-progress-bar">
          <div className="spotify-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="spotify-time-labels">
          <span>{formatTime(track.progressMs)}</span>
          <span>{formatTime(track.durationMs)}</span>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="spotify-controls-row">
        <button onClick={handlePrevious} className="spotify-ctrl-btn" title="Faixa Anterior">
          <SkipBack size={18} />
        </button>

        <button
          onClick={handleTogglePlay}
          className={`spotify-ctrl-btn play-pause ${track.isPlaying ? 'playing' : ''}`}
          title={track.isPlaying ? 'Pausar' : 'Reproduzir'}
        >
          {track.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button onClick={handleNext} className="spotify-ctrl-btn" title="Próxima Faixa">
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
};
