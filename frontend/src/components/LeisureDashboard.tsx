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
  Speaker,
  Lightbulb,
  ListMusic,
  RotateCw,
  LogOut
} from 'lucide-react';
import {
  isSpotifyConnected,
  loginWithSpotify,
  logoutSpotify,
  fetchPlaybackState,
  toggleSpotifyPlay,
  nextSpotifyTrack,
  previousSpotifyTrack,
  seekSpotifyTrack,
  fetchAvailableDevices,
  transferSpotifyPlayback,
  fetchUserPlaylists,
  playSpotifyContext,
  initSpotifyWebPlayer,
  getLocalDeviceId,
  type SpotifyTrack,
  type SpotifyDevice,
  type SpotifyPlaylist
} from '../services/spotify';
import { fetchWeatherData, type WeatherData } from '../services/weather';

export interface QuickDeviceSwitch {
  id: string;
  name: string;
  isOn: boolean;
  onToggle: () => void;
}

interface LeisureDashboardProps {
  onOpenFloorplan: () => void;
  onOpenReview: () => void;
  onToggleAllLights?: () => void;
  activeLightsCount?: number;
  totalLightsCount?: number;
  poolTemperature?: number | null;
  onToggleShortcut?: (shortcutKey: string) => void;
  quickSwitches?: QuickDeviceSwitch[];
  spotifyAuthKey?: number;
}

export const LeisureDashboard: React.FC<LeisureDashboardProps> = ({
  onOpenFloorplan,
  onOpenReview,
  onToggleAllLights,
  activeLightsCount = 0,
  poolTemperature = 32,
  quickSwitches = [],
  spotifyAuthKey = 0
}) => {
  // --- Spotify State ---
  const [spotifyConnected, setSpotifyConnected] = useState<boolean>(() => isSpotifyConnected());
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [seekPosMs, setSeekPosMs] = useState<number | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState<boolean>(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState<boolean>(false);
  const [isPlaylistsOpen, setIsPlaylistsOpen] = useState<boolean>(false);
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null);

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

  // Sincronizar estado e conexão do Spotify
  const syncSpotify = useCallback(async () => {
    const isConn = isSpotifyConnected();
    setSpotifyConnected(isConn);
    if (!isConn) {
      setTrack(null);
      return;
    }
    const state = await fetchPlaybackState();
    setTrack(state);
  }, []);

  // Sincronizar quando receber authKey ou montar
  useEffect(() => {
    syncSpotify();
  }, [spotifyAuthKey, syncSpotify]);

  // Polling regular a cada 3.5s
  useEffect(() => {
    syncSpotify();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncSpotify();
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [syncSpotify]);

  // Inicializar o Web Playback SDK no tablet para que o DOMUS apareça nos aparelhos Connect
  useEffect(() => {
    if (!spotifyConnected) return;

    initSpotifyWebPlayer({
      onReady: (devId) => {
        setLocalDeviceId(devId);
      },
      onNotReady: () => {
        setLocalDeviceId(null);
      },
      onPlayerStateChanged: (state) => {
        if (state) {
          syncSpotify();
        }
      },
      onError: (type, message) => {
        if (type === 'account_error') {
          console.warn('Spotify Web Playback SDK requer conta Premium:', message);
        }
      }
    });

    const currentLocal = getLocalDeviceId();
    if (currentLocal) setLocalDeviceId(currentLocal);
  }, [spotifyConnected, syncSpotify]);

  // Escutar login do Spotify em tempo real de abas, janelas e eventos locais
  useEffect(() => {
    const handleAuthEvent = () => {
      syncSpotify();
    };

    window.addEventListener('spotify-auth-success', handleAuthEvent);
    window.addEventListener('spotify-auth-changed', handleAuthEvent);
    window.addEventListener('storage', handleAuthEvent);
    window.addEventListener('focus', handleAuthEvent);
    document.addEventListener('visibilitychange', handleAuthEvent);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('spotify_auth_channel');
      bc.onmessage = (e) => {
        if (e.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
          syncSpotify();
        }
      };
    } catch {}

    return () => {
      bc?.close();
      window.removeEventListener('spotify-auth-success', handleAuthEvent);
      window.removeEventListener('spotify-auth-changed', handleAuthEvent);
      window.removeEventListener('storage', handleAuthEvent);
      window.removeEventListener('focus', handleAuthEvent);
      document.removeEventListener('visibilitychange', handleAuthEvent);
    };
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

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await loginWithSpotify();
    } catch (err) {
      console.error('Erro ao conectar Spotify:', err);
      setIsConnecting(false);
    }
  };

  const handleReconnect = () => {
    logoutSpotify();
    setSpotifyConnected(false);
    setTrack(null);
    loginWithSpotify();
  };

  const handleDisconnect = () => {
    logoutSpotify();
    setSpotifyConnected(false);
    setTrack(null);
    setIsPlaylistsOpen(false);
    setIsDeviceMenuOpen(false);
  };

  const handleOpenPlaylists = async () => {
    setIsPlaylistsOpen(true);
    if (playlists.length === 0) {
      setIsLoadingPlaylists(true);
      const list = await fetchUserPlaylists();
      setPlaylists(list);
      setIsLoadingPlaylists(false);
    }
  };

  const handlePlayPlaylist = async (playlistUri: string) => {
    setIsBusy(true);
    await playSpotifyContext(playlistUri, track?.deviceId || localDeviceId || undefined);
    setIsBusy(false);
    setIsPlaylistsOpen(false);
    setTimeout(syncSpotify, 700);
  };

  const formatTrackTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Ícone dinâmico para o clima (tamanho aumentado para dar mais destaque ao widget)
  const renderWeatherIcon = () => {
    const iconType = weather?.iconType || 'sunny';
    if (iconType === 'sunny') {
      return <Sun size={84} className="weather-vector-icon sunny" />;
    }
    if (iconType === 'storm') {
      return <CloudLightning size={84} className="weather-vector-icon storm" />;
    }
    if (iconType === 'cloudy') {
      return <Cloud size={84} className="weather-vector-icon cloudy" />;
    }
    return <CloudRain size={84} className="weather-vector-icon rainy" />;
  };

  const fallbackSwitches: QuickDeviceSwitch[] = [
    { id: '1', name: 'Luz Central Quarto', isOn: false, onToggle: () => {} },
    { id: '2', name: 'Luz Central Sala', isOn: false, onToggle: () => {} },
    { id: '3', name: 'Luz Gourmet', isOn: false, onToggle: () => {} },
  ];
  const displaySwitches = quickSwitches.length > 0 ? quickSwitches.slice(0, 3) : fallbackSwitches;

  return (
    <div className="leisure-dashboard-container">
      {/* Grade Principal de 2 Colunas */}
      <div className="leisure-grid">
        
        {/* COLUNA ESQUERDA: Card do Player Spotify */}
        <div className="leisure-spotify-card">
          {spotifyConnected && track ? (
            /* 1. Estado Conectado & Tocando */
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
                  type="button"
                  onClick={handleOpenPlaylists}
                  className="leisure-control-btn-subtle"
                  title="Abrir Playlists"
                >
                  <ListMusic size={20} />
                </button>

                <button
                  type="button"
                  onClick={handlePrevious}
                  className="leisure-control-btn"
                  title="Música Anterior"
                >
                  <SkipBack size={26} fill="currentColor" />
                </button>

                <button
                  type="button"
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
                  type="button"
                  onClick={handleNext}
                  className="leisure-control-btn"
                  title="Próxima Música"
                >
                  <SkipForward size={26} fill="currentColor" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenDevices}
                  className="leisure-control-btn-subtle"
                  title="Aparelhos de Som"
                >
                  <Speaker size={20} />
                </button>
              </div>
            </>
          ) : spotifyConnected ? (
            /* 2. Estado Conectado mas Ocioso (sem música tocando) */
            <div className="leisure-spotify-idle">
              <div className="leisure-album-placeholder idle">
                <Music size={52} className="text-emerald-400" />
                <span className="idle-pulse-dot" />
              </div>

              <div className="leisure-track-info">
                <div className="spotify-connected-badge">
                  <span className="badge-dot" />
                  <span>Spotify Conectado</span>
                </div>
                <h3 className="leisure-track-title">Área de Lazer Pronta</h3>
                <p className="leisure-track-artist">Escolha uma playlist abaixo ou dê play no seu celular</p>
              </div>

              <div className="leisure-idle-actions">
                <button
                  type="button"
                  onClick={handleOpenPlaylists}
                  className="leisure-idle-cta-btn"
                  title="Ver e Tocar Playlists"
                >
                  <ListMusic size={18} />
                  <span>Escolher Playlist</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenDevices}
                  className="leisure-idle-subtle-btn"
                  title="Onde tocar?"
                >
                  <Speaker size={18} />
                  <span>Aparelhos</span>
                </button>
              </div>

              <div className="leisure-idle-footer">
                <button type="button" onClick={handleReconnect} className="leisure-footer-link" title="Renovar Permissões / Trocar Conta">
                  <RotateCw size={12} />
                  <span>Reconectar</span>
                </button>
                <span className="footer-dot">•</span>
                <button type="button" onClick={handleDisconnect} className="leisure-footer-link" title="Sair do Spotify">
                  <LogOut size={12} />
                  <span>Desconectar</span>
                </button>
              </div>
            </div>
          ) : (
            /* 3. Estado Desconectado do Spotify */
            <div className="leisure-spotify-empty">
              <div className="leisure-album-placeholder">
                <svg className="spotify-icon-empty" viewBox="0 0 24 24" width="56" height="56" fill="#1DB954">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.306c-.217.355-.678.47-1.033.253-2.828-1.728-6.388-2.119-10.582-1.16-.407.093-.814-.162-.907-.568-.093-.406.162-.813.568-.906 4.6-.1.05 8.547.487 11.7 2.414.355.217.47.678.254 1.033zm1.467-3.262c-.273.444-.855.586-1.299.313-3.238-1.99-8.175-2.566-12.006-1.403-.498.151-1.026-.134-1.177-.632-.152-.498.134-1.026.632-1.178 4.38-1.33 9.82-.693 13.537 1.6 4.444.274.586.855.313 1.3zm.126-3.41c-3.882-2.305-10.292-2.518-14.01-1.388-.596.181-1.229-.158-1.41-.754-.182-.596.158-1.229.754-1.41 4.269-1.296 11.35-1.045 15.823 1.611.536.318.71 1.013.392 1.549-.318.536-1.013.71-1.549.392z" />
                </svg>
              </div>
              <h3 className="leisure-track-title">Spotify Área de Lazer</h3>
              <p className="leisure-track-artist">Conecte sua conta para tocar músicas</p>
              <button
                type="button"
                onClick={handleConnect}
                className="leisure-spotify-connect-btn"
                disabled={isConnecting}
              >
                <svg className="spotify-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.306c-.217.355-.678.47-1.033.253-2.828-1.728-6.388-2.119-10.582-1.16-.407.093-.814-.162-.907-.568-.093-.406.162-.813.568-.906 4.6-.1.05 8.547.487 11.7 2.414.355.217.47.678.254 1.033zm1.467-3.262c-.273.444-.855.586-1.299.313-3.238-1.99-8.175-2.566-12.006-1.403-.498.151-1.026-.134-1.177-.632-.152-.498.134-1.026.632-1.178 4.38-1.33 9.82-.693 13.537 1.6 4.444.274.586.855.313 1.3zm.126-3.41c-3.882-2.305-10.292-2.518-14.01-1.388-.596.181-1.229-.158-1.41-.754-.182-.596.158-1.229.754-1.41 4.269-1.296 11.35-1.045 15.823 1.611.536.318.71 1.013.392 1.549-.318.536-1.013.71-1.549.392z" />
                </svg>
                <span>{isConnecting ? "Conectando..." : "Conectar Spotify"}</span>
              </button>
            </div>
          )}

          {/* Menu Flutuante de Seleção de Caixas de Som */}
          {isDeviceMenuOpen && (
            <div className="leisure-devices-dropdown">
              <div className="leisure-dropdown-header">
                <span>Onde tocar?</span>
                <button type="button" onClick={() => setIsDeviceMenuOpen(false)}>✕</button>
              </div>
              {devices.length === 0 ? (
                <div className="leisure-dropdown-empty">Nenhum aparelho detectado</div>
              ) : (
                devices.map((d) => (
                  <button
                    key={d.id}
                    type="button"
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

          {/* Modal de Playlists */}
          {isPlaylistsOpen && (
            <div className="leisure-playlists-overlay" onClick={() => setIsPlaylistsOpen(false)}>
              <div className="leisure-playlists-modal" onClick={(e) => e.stopPropagation()}>
                <div className="leisure-modal-header">
                  <div className="leisure-modal-title-row">
                    <ListMusic size={22} className="text-emerald-400" />
                    <span className="leisure-modal-title">Suas Playlists</span>
                  </div>
                  <button type="button" onClick={() => setIsPlaylistsOpen(false)} className="leisure-modal-close">✕</button>
                </div>

                <div className="leisure-playlists-body">
                  {isLoadingPlaylists ? (
                    <div className="leisure-loading-box">
                      <Sparkles size={24} className="animate-spin text-emerald-400" />
                      <span>Carregando playlists...</span>
                    </div>
                  ) : playlists.length === 0 ? (
                    <div className="leisure-empty-box">
                      <p>Nenhuma playlist encontrada.</p>
                      <button type="button" onClick={handleReconnect} className="leisure-retry-btn">
                        Renovar Permissões
                      </button>
                    </div>
                  ) : (
                    <div className="leisure-playlists-grid">
                      {playlists.map((pl) => (
                        <div
                          key={pl.id}
                          onClick={() => handlePlayPlaylist(pl.uri)}
                          className="leisure-playlist-card"
                          title={`Tocar ${pl.name}`}
                        >
                          <div className="leisure-pl-art-wrap">
                            {pl.image ? (
                              <img src={pl.image} alt={pl.name} className="leisure-pl-img" />
                            ) : (
                              <div className="leisure-pl-fallback">
                                <Music size={24} />
                              </div>
                            )}
                            <div className="leisure-pl-hover-btn">
                              <Play size={18} fill="currentColor" />
                            </div>
                          </div>
                          <span className="leisure-pl-title" title={pl.name}>{pl.name}</span>
                          <span className="leisure-pl-sub">{pl.tracksTotal} faixas</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: Widgets de Clima e Atalhos/Dispositivos */}
        <div className="leisure-right-col">
          
          {/* 1. Widget de Clima (Altura aumentada, mais imponente e informativo) */}
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
                <span className="weather-humidity">Umidade: {weather?.humidity ?? 65}%</span>
              </div>
              <div className="weather-temp-box">
                <span className="weather-temp-c">{weather?.temperatureC ?? 25}°</span>
                <span className="weather-temp-f">{weather?.temperatureF ?? 77} F</span>
              </div>
            </div>
          </div>

          {/* 2. Card de Dispositivos (Redesenhado conforme mockup do usuário) */}
          <div className="leisure-shortcuts-card">
            {/* Lado Esquerdo: Botão 'Ligar tudo' no topo + 3 Interruptores com Toggle Switch */}
            <div className="leisure-quick-switches-col">
              <button
                type="button"
                onClick={onToggleAllLights}
                className="quick-toggle-all-btn"
                title={activeLightsCount > 0 ? "Apagar todas as luzes" : "Ligar todas as luzes"}
              >
                <span>{activeLightsCount > 0 ? "Apagar tudo" : "Ligar tudo"}</span>
              </button>

              <div className="quick-switches-list">
                {displaySwitches.map((sw) => (
                  <div key={sw.id} className="quick-switch-card">
                    <div className={`quick-switch-icon-box ${sw.isOn ? 'active' : ''}`}>
                      <Lightbulb size={20} className={sw.isOn ? 'icon-on' : 'icon-off'} />
                    </div>
                    <div className="quick-switch-info">
                      <span className="quick-switch-title" title={sw.name}>{sw.name}</span>
                      <span className={`quick-switch-status ${sw.isOn ? 'status-on' : 'status-off'}`}>
                        {sw.isOn ? 'Ligado' : 'Desligado'}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={sw.isOn}
                      onClick={sw.onToggle}
                      className={`ios-toggle-switch ${sw.isOn ? 'checked' : ''}`}
                      title={`${sw.name}: ${sw.isOn ? 'Desligar' : 'Ligar'}`}
                    >
                      <span className="ios-toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Lado Direito: Grande Card 'Acessar' (Redireciona para o Mapa/Planta Baixa) */}
            <button
              type="button"
              onClick={onOpenFloorplan}
              className="quick-access-big-card"
              title="Acessar Planta Baixa 2D e Maquete 3D"
            >
              <span className="quick-access-title">Acessar</span>
            </button>
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
