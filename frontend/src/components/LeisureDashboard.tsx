import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  Waves,
  Star,
  CloudRain,
  Sun,
  Cloud,
  CloudLightning,
  Sparkles,
  ArrowRight,
  Speaker,
  Power,
  Flame
} from 'lucide-react';
import {
  isSpotifyConnected,
  loginWithSpotify,
  fetchPlaybackState,
  toggleSpotifyPlay,
  nextSpotifyTrack,
  previousSpotifyTrack,
  seekSpotifyTrack,
  fetchAvailableDevices,
  transferSpotifyPlayback,
  type SpotifyTrack,
  type SpotifyDevice
} from '../services/spotify';
import { fetchWeatherData, type WeatherData } from '../services/weather';

interface LeisureDashboardProps {
  onOpenFloorplan: () => void;
  onOpenReview: () => void;
  onToggleAllLights?: () => void;
  activeLightsCount?: number;
  totalLightsCount?: number;
  poolTemperature?: number | null;
  onToggleShortcut?: (shortcutKey: string) => void;
}

export const LeisureDashboard: React.FC<LeisureDashboardProps> = ({
  onOpenFloorplan,
  onOpenReview,
  onToggleAllLights,
  activeLightsCount = 0,
  poolTemperature = 32
}) => {
  // --- Spotify State ---
  const [spotifyConnected, setSpotifyConnected] = useState<boolean>(() => isSpotifyConnected());
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [seekPosMs, setSeekPosMs] = useState<number | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState<boolean>(false);

  // --- Weather State ---
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // --- Clock State ---
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}h`;
  });

  // Atualizar relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}h`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sincronizar Clima ao montar e a cada 30 minutos
  useEffect(() => {
    let isMounted = true;
    const loadWeather = async () => {
      try {
        const data = await fetchWeatherData();
        if (isMounted) setWeather(data);
      } catch (err) {
        console.warn('Falha ao obter clima:', err);
      }
    };
    loadWeather();
    const interval = setInterval(loadWeather, 30 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sincronizar Spotify
  const syncSpotify = useCallback(async () => {
    if (!isSpotifyConnected()) {
      setSpotifyConnected(false);
      setTrack(null);
      return;
    }
    setSpotifyConnected(true);
    const state = await fetchPlaybackState();
    setTrack(state);
  }, []);

  useEffect(() => {
    syncSpotify();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncSpotify();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [syncSpotify]);

  // Avanço suave do contador do Spotify
  useEffect(() => {
    if (!track?.isPlaying || seekPosMs !== null) return;
    const timer = setInterval(() => {
      setTrack((prev) => {
        if (!prev || !prev.isPlaying || prev.progressMs >= prev.durationMs) return prev;
        return { ...prev, progressMs: Math.min(prev.progressMs + 1000, prev.durationMs) };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [track?.isPlaying, seekPosMs]);

  // Ações de controle Spotify
  const handleTogglePlay = async () => {
    if (!track || isBusy) return;
    setIsBusy(true);
    const prev = track.isPlaying;
    setTrack({ ...track, isPlaying: !prev });
    await toggleSpotifyPlay(prev);
    setTimeout(syncSpotify, 500);
    setIsBusy(false);
  };

  const handleNext = async () => {
    if (isBusy) return;
    setIsBusy(true);
    await nextSpotifyTrack();
    setTimeout(syncSpotify, 600);
    setIsBusy(false);
  };

  const handlePrevious = async () => {
    if (isBusy) return;
    setIsBusy(true);
    await previousSpotifyTrack();
    setTimeout(syncSpotify, 600);
    setIsBusy(false);
  };

  const handleSeekCommit = async (newVal: number) => {
    setSeekPosMs(null);
    if (track) {
      setTrack({ ...track, progressMs: newVal });
    }
    await seekSpotifyTrack(newVal);
    setTimeout(syncSpotify, 500);
  };

  const handleOpenDevices = async () => {
    const list = await fetchAvailableDevices();
    setDevices(list);
    setIsDeviceMenuOpen(prev => !prev);
  };

  const handleSelectDevice = async (devId: string) => {
    await transferSpotifyPlayback(devId, true);
    setIsDeviceMenuOpen(false);
    setTimeout(syncSpotify, 700);
  };

  const formatTrackTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Ícone dinâmico para o clima
  const renderWeatherIcon = () => {
    const iconType = weather?.iconType || 'rainy';
    if (iconType === 'sunny') {
      return <Sun size={68} className="weather-vector-icon sunny" />;
    }
    if (iconType === 'storm') {
      return <CloudLightning size={68} className="weather-vector-icon storm" />;
    }
    if (iconType === 'cloudy') {
      return <Cloud size={68} className="weather-vector-icon cloudy" />;
    }
    return <CloudRain size={68} className="weather-vector-icon rainy" />;
  };

  return (
    <div className="leisure-dashboard-container">
      {/* Grade Principal de 2 Colunas */}
      <div className="leisure-grid">
        
        {/* COLUNA ESQUERDA: Card do Player Spotify */}
        <div className="leisure-spotify-card">
          {spotifyConnected && track ? (
            <>
              <div className="leisure-album-wrapper">
                {track.albumArt ? (
                  <img
                    src={track.albumArt}
                    alt={track.name}
                    className="leisure-album-cover"
                  />
                ) : (
                  <div className="leisure-album-placeholder">
                    <Music size={64} className="text-gray-500" />
                  </div>
                )}
              </div>

              <div className="leisure-track-info">
                <h3 className="leisure-track-title" title={track.name}>
                  {track.name}
                </h3>
                <p className="leisure-track-artist" title={track.artists}>
                  {track.artists}
                </p>
              </div>

              {/* Barra de Progresso */}
              <div className="leisure-progress-container">
                <input
                  type="range"
                  min="0"
                  max={track.durationMs || 100}
                  value={seekPosMs !== null ? seekPosMs : track.progressMs}
                  onChange={(e) => setSeekPosMs(Number(e.target.value))}
                  onMouseUp={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                  className="leisure-progress-bar"
                />
                <div className="leisure-progress-time">
                  <span>{formatTrackTime(seekPosMs !== null ? seekPosMs : track.progressMs)}</span>
                  <span>{formatTrackTime(track.durationMs)}</span>
                </div>
              </div>

              {/* Controles de Reprodução */}
              <div className="leisure-controls-row">
                <button
                  onClick={handleOpenDevices}
                  className="leisure-control-btn-subtle"
                  title="Aparelhos de Som"
                >
                  <Speaker size={20} />
                </button>

                <button
                  onClick={handlePrevious}
                  className="leisure-control-btn"
                  title="Música Anterior"
                >
                  <SkipBack size={26} fill="currentColor" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="leisure-play-pause-btn"
                  title={track.isPlaying ? "Pausar" : "Tocar"}
                >
                  {track.isPlaying ? (
                    <Pause size={28} fill="currentColor" />
                  ) : (
                    <Play size={28} fill="currentColor" style={{ marginLeft: '3px' }} />
                  )}
                </button>

                <button
                  onClick={handleNext}
                  className="leisure-control-btn"
                  title="Próxima Música"
                >
                  <SkipForward size={26} fill="currentColor" />
                </button>

                <button
                  onClick={syncSpotify}
                  className="leisure-control-btn-subtle"
                  title="Atualizar Status"
                >
                  <Sparkles size={20} />
                </button>
              </div>

              {/* Menu Flutuante de Seleção de Caixas de Som */}
              {isDeviceMenuOpen && (
                <div className="leisure-devices-dropdown">
                  <div className="leisure-dropdown-header">
                    <span>Onde tocar?</span>
                    <button onClick={() => setIsDeviceMenuOpen(false)}>✕</button>
                  </div>
                  {devices.length === 0 ? (
                    <div className="leisure-dropdown-empty">Nenhum aparelho detectado</div>
                  ) : (
                    devices.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleSelectDevice(d.id)}
                        className={`leisure-device-opt ${d.isActive ? 'active' : ''}`}
                      >
                        <span>{d.name}</span>
                        {d.isActive && <span className="text-emerald-400 text-xs">● Ativo</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            /* Estado Desconectado do Spotify */
            <div className="leisure-spotify-empty">
              <div className="leisure-album-placeholder">
                <Music size={72} className="text-gray-400" />
              </div>
              <h3 className="leisure-track-title">Spotify Área de Lazer</h3>
              <p className="leisure-track-artist">Conecte sua conta para tocar músicas</p>
              <button onClick={loginWithSpotify} className="leisure-spotify-connect-btn">
                <span>Conectar Spotify</span>
              </button>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: Widgets de Clima e Atalhos/Dispositivos */}
        <div className="leisure-right-col">
          
          {/* 1. Widget de Clima */}
          <div className="leisure-weather-card">
            <div className="weather-card-left">
              <span className="weather-condition-tag">
                {weather?.conditionText || 'Ensolarado'}
              </span>
              <div className="weather-icon-box">
                {renderWeatherIcon()}
              </div>
            </div>

            <div className="weather-divider" />

            <div className="weather-card-right">
              <div className="weather-location-box">
                <h4 className="weather-location-title">{weather?.city || 'Área de Lazer'}</h4>
                <span className="weather-weekday">{weather?.weekday || 'Hoje'}</span>
              </div>
              <div className="weather-temp-box">
                <span className="weather-temp-c">{weather?.temperatureC ?? 25}°</span>
                <span className="weather-temp-f">{weather?.temperatureF ?? 77} F</span>
              </div>
            </div>
          </div>

          {/* 2. Card de Atalhos & Dispositivos */}
          <div className="leisure-shortcuts-card">
            {/* Lado Esquerdo: Atalhos Rápidos */}
            <div className="shortcuts-side">
              <h3 className="shortcuts-title">Atalhos</h3>
              <div className="shortcuts-buttons-list">
                <button
                  onClick={onToggleAllLights}
                  className="shortcut-pill-btn"
                  title={activeLightsCount > 0 ? "Apagar todas as luzes" : "Ligar todas as luzes"}
                >
                  <Power size={16} />
                  <span>{activeLightsCount > 0 ? "Apagar Tudo" : "Ligar Tudo"}</span>
                </button>

                <button
                  onClick={onOpenFloorplan}
                  className="shortcut-pill-btn"
                  title="Iluminação da Área Gourmet"
                >
                  <Flame size={16} />
                  <span>Gourmet</span>
                </button>

                <button
                  onClick={onOpenFloorplan}
                  className="shortcut-pill-btn"
                  title="Iluminação da Piscina"
                >
                  <Waves size={16} />
                  <span>Piscina</span>
                </button>
              </div>
            </div>

            {/* Separador Vertical */}
            <div className="shortcuts-divider" />

            {/* Lado Direito: Acessar Dispositivos / Planta Baixa */}
            <div className="devices-access-side">
              <h3 className="devices-title">Dispositivos</h3>
              <button
                onClick={onOpenFloorplan}
                className="devices-cta-btn"
                title="Acessar Planta Baixa 2D e Maquete 3D"
              >
                <div className="devices-cta-content">
                  <span className="devices-cta-action">Acessar</span>
                  <span className="devices-cta-sub">
                    Direciona para o mapa e interruptores da casa
                  </span>
                </div>
                <div className="devices-cta-arrow">
                  <ArrowRight size={20} />
                </div>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* LINHA INFERIOR: Piscina, Avaliar e Hora */}
      <div className="leisure-bottom-bar">
        {/* Pílula da Temperatura da Piscina */}
        <div className="leisure-pool-pill" title="Temperatura da Água da Piscina em tempo real">
          <div className="pool-icon-box">
            <Waves size={24} className="pool-wave-icon" />
          </div>
          <span className="pool-temp-value">
            {poolTemperature !== null ? `${Math.round(poolTemperature)}°C` : '32°C'}
          </span>
        </div>

        {/* Lado Direito: Avaliar + Hora */}
        <div className="leisure-bottom-actions">
          <button
            onClick={onOpenReview}
            className="leisure-review-btn"
            title="Avaliar nossa Área de Lazer no Google Maps"
          >
            <Star size={18} fill="#D97706" color="#D97706" />
            <span>Avaliar</span>
          </button>

          <div className="leisure-clock-pill">
            <span>{currentTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
