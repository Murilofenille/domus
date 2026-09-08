import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  LogOut,
  Tv,
  Smartphone,
  Laptop,
  Speaker,
  Search,
  ListMusic,
  Clock,
  X
} from 'lucide-react';
import {
  isSpotifyConnected,
  loginWithSpotify,
  logoutSpotify,
  fetchPlaybackState,
  toggleSpotifyPlay,
  nextSpotifyTrack,
  previousSpotifyTrack,
  fetchAvailableDevices,
  transferSpotifyPlayback,
  setSpotifyVolume,
  fetchUserPlaylists,
  fetchRecentlyPlayed,
  searchSpotify,
  playSpotifyContext,
  playSpotifyTrack,
  type SpotifyTrack,
  type SpotifyDevice,
  type SpotifyPlaylist,
  type SpotifySearchItem
} from '../services/spotify';

export const SpotifyPlayer: React.FC = () => {
  const [connected, setConnected] = useState<boolean>(() => isSpotifyConnected());
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Estados dos Modais
  const [isDevicesOpen, setIsDevicesOpen] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [libraryTab, setLibraryTab] = useState<'playlists' | 'recent' | 'search'>('playlists');

  // Dados da Biblioteca e Aparelhos
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [recentTracks, setRecentTracks] = useState<SpotifySearchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SpotifySearchItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(50);

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
    if (data?.volumePercent !== undefined) {
      setVolume(data.volumePercent);
    }
  }, []);

  // Escutar eventos de login vindos de outras abas/popups ou ao voltar o foco para o PWA
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('spotify_auth_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
          setConnected(true);
          syncPlayback();
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'spotify_access_token') {
        if (e.newValue) {
          setConnected(true);
          syncPlayback();
        } else {
          setConnected(false);
          setTrack(null);
        }
      }
    };

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        if (isSpotifyConnected()) {
          setConnected(true);
          syncPlayback();
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [syncPlayback]);

  useEffect(() => {
    if (!connected) return;

    syncPlayback();
    const delay = track?.isPlaying ? 2800 : 6000;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncPlayback();
      }
    }, delay);

    return () => clearInterval(interval);
  }, [connected, track?.isPlaying, syncPlayback]);

  // Carregar lista de aparelhos quando abrir o modal de aparelhos
  const loadDevices = async () => {
    const list = await fetchAvailableDevices();
    setDevices(list);
    setIsDevicesOpen(true);
  };

  // Carregar playlists ou recentes
  const loadLibrary = async (tab: 'playlists' | 'recent' | 'search') => {
    setLibraryTab(tab);
    setIsLibraryOpen(true);
    if (tab === 'playlists' && playlists.length === 0) {
      const list = await fetchUserPlaylists();
      setPlaylists(list);
    } else if (tab === 'recent' && recentTracks.length === 0) {
      const list = await fetchRecentlyPlayed();
      setRecentTracks(list);
    }
  };

  // Debounced search
  useEffect(() => {
    if (libraryTab !== 'search' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchSpotify(searchQuery);
      setSearchResults(res);
      setIsSearching(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, libraryTab]);

  // Controles de Reprodução
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

  const handleTransferDevice = async (deviceId: string) => {
    await transferSpotifyPlayback(deviceId, true);
    setIsDevicesOpen(false);
    setTimeout(syncPlayback, 600);
  };

  const handleVolumeChange = async (newVol: number) => {
    setVolume(newVol);
    await setSpotifyVolume(newVol);
  };

  const handlePlayPlaylist = async (uri: string) => {
    await playSpotifyContext(uri);
    setIsLibraryOpen(false);
    setTimeout(syncPlayback, 600);
  };

  const handlePlayTrack = async (uri: string) => {
    await playSpotifyTrack(uri);
    setIsLibraryOpen(false);
    setTimeout(syncPlayback, 600);
  };

  const handleLogout = () => {
    logoutSpotify();
    setConnected(false);
    setTrack(null);
    setIsDevicesOpen(false);
    setIsLibraryOpen(false);
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getDeviceIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('tv') || t.includes('cast')) return <Tv size={16} />;
    if (t.includes('speaker') || t.includes('audio')) return <Speaker size={16} />;
    if (t.includes('computer')) return <Laptop size={16} />;
    return <Smartphone size={16} />;
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
            <span className="spotify-idle-sub">Escolha uma playlist ou dê play</span>
          </div>
          <button
            onClick={() => loadLibrary('playlists')}
            className="spotify-btn-action-sm"
            title="Abrir Playlists"
          >
            <ListMusic size={14} />
            <span>Playlists</span>
          </button>
          <button onClick={handleLogout} className="spotify-btn-ghost" title="Desconectar Spotify">
            <LogOut size={14} />
          </button>
        </div>

        {/* Modal de Biblioteca quando ocioso */}
        {isLibraryOpen && renderLibraryModal()}
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

  // 4. Modal / Popover de Aparelhos (Spotify Connect)
  function renderDevicesModal() {
    return (
      <div className="spotify-modal-overlay" onClick={() => setIsDevicesOpen(false)}>
        <div className="spotify-devices-card" onClick={(e) => e.stopPropagation()}>
          <div className="spotify-modal-header">
            <div className="spotify-modal-title">
              <Speaker size={18} className="text-green-400" />
              <span>Ouvir em um aparelho</span>
            </div>
            <button onClick={() => setIsDevicesOpen(false)} className="spotify-close-btn">
              <X size={16} />
            </button>
          </div>

          <div className="spotify-devices-list">
            {devices.length === 0 ? (
              <p className="spotify-empty-text">Buscando aparelhos na rede...</p>
            ) : (
              devices.map((dev) => (
                <button
                  key={dev.id}
                  onClick={() => handleTransferDevice(dev.id)}
                  className={`spotify-device-item ${dev.isActive ? 'active' : ''}`}
                >
                  <div className="spotify-dev-icon">{getDeviceIcon(dev.type)}</div>
                  <div className="spotify-dev-info">
                    <span className="spotify-dev-name">{dev.name}</span>
                    <span className="spotify-dev-type">
                      {dev.isActive ? 'Tocando agora' : dev.type}
                    </span>
                  </div>
                  {dev.isActive && <div className="spotify-dev-pulse" />}
                </button>
              ))
            )}
          </div>

          {/* Slider de Volume do Aparelho Atual */}
          <div className="spotify-volume-box">
            <div className="spotify-volume-icon">
              {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="spotify-volume-slider"
            />
            <span className="spotify-volume-val">{volume}%</span>
          </div>
        </div>
      </div>
    );
  }

  // 5. Modal / Gaveta de Biblioteca (Playlists, Recentes, Busca)
  function renderLibraryModal() {
    return (
      <div className="spotify-modal-overlay" onClick={() => setIsLibraryOpen(false)}>
        <div className="spotify-library-card" onClick={(e) => e.stopPropagation()}>
          {/* Header com Abas */}
          <div className="spotify-library-header">
            <div className="spotify-tabs-row">
              <button
                className={`spotify-tab-btn ${libraryTab === 'playlists' ? 'active' : ''}`}
                onClick={() => loadLibrary('playlists')}
              >
                <ListMusic size={16} />
                <span>Minhas Playlists</span>
              </button>
              <button
                className={`spotify-tab-btn ${libraryTab === 'recent' ? 'active' : ''}`}
                onClick={() => loadLibrary('recent')}
              >
                <Clock size={16} />
                <span>Recentes</span>
              </button>
              <button
                className={`spotify-tab-btn ${libraryTab === 'search' ? 'active' : ''}`}
                onClick={() => setLibraryTab('search')}
              >
                <Search size={16} />
                <span>Buscar</span>
              </button>
            </div>
            <button onClick={() => setIsLibraryOpen(false)} className="spotify-close-btn">
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo da Aba */}
          <div className="spotify-library-content">
            {/* Aba 1: Playlists */}
            {libraryTab === 'playlists' && (
              <div className="spotify-playlists-grid">
                {playlists.length === 0 ? (
                  <p className="spotify-empty-text">Carregando suas playlists...</p>
                ) : (
                  playlists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => handlePlayPlaylist(pl.uri)}
                      className="spotify-playlist-card"
                      title={pl.name}
                    >
                      <div className="spotify-pl-cover-wrapper">
                        {pl.image ? (
                          <img src={pl.image} alt={pl.name} className="spotify-pl-cover" />
                        ) : (
                          <div className="spotify-pl-placeholder">
                            <Music size={28} />
                          </div>
                        )}
                        <button className="spotify-pl-play-btn" title="Tocar Playlist">
                          <Play size={18} fill="currentColor" />
                        </button>
                      </div>
                      <h5 className="spotify-pl-title">{pl.name}</h5>
                      <span className="spotify-pl-tracks">{pl.tracksTotal} músicas</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Aba 2: Músicas Recentes */}
            {libraryTab === 'recent' && (
              <div className="spotify-tracks-list">
                {recentTracks.length === 0 ? (
                  <p className="spotify-empty-text">Buscando músicas recentes...</p>
                ) : (
                  recentTracks.map((trk) => (
                    <div
                      key={`${trk.id}-${Math.random()}`}
                      onClick={() => handlePlayTrack(trk.uri)}
                      className="spotify-track-row"
                    >
                      <img src={trk.albumArt} alt={trk.name} className="spotify-row-art" />
                      <div className="spotify-row-details">
                        <span className="spotify-row-name">{trk.name}</span>
                        <span className="spotify-row-artist">{trk.artists}</span>
                      </div>
                      <span className="spotify-row-duration">{formatTime(trk.durationMs)}</span>
                      <button className="spotify-row-play">
                        <Play size={14} fill="currentColor" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Aba 3: Buscar */}
            {libraryTab === 'search' && (
              <div className="spotify-search-wrapper">
                <div className="spotify-search-bar">
                  <Search size={18} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="O que você quer ouvir hoje?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="spotify-search-input"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="spotify-clear-btn">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="spotify-search-results">
                  {isSearching ? (
                    <p className="spotify-empty-text">Pesquisando no Spotify...</p>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((trk) => (
                      <div
                        key={trk.id}
                        onClick={() => handlePlayTrack(trk.uri)}
                        className="spotify-track-row"
                      >
                        <img src={trk.albumArt} alt={trk.name} className="spotify-row-art" />
                        <div className="spotify-row-details">
                          <span className="spotify-row-name">{trk.name}</span>
                          <span className="spotify-row-artist">{trk.artists}</span>
                        </div>
                        <span className="spotify-row-duration">{formatTime(trk.durationMs)}</span>
                        <button className="spotify-row-play">
                          <Play size={14} fill="currentColor" />
                        </button>
                      </div>
                    ))
                  ) : searchQuery.trim() ? (
                    <p className="spotify-empty-text">Nenhuma música encontrada.</p>
                  ) : (
                    <p className="spotify-empty-text">Digite o nome de uma música ou artista acima.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 6. Player Principal Completo
  const progressPercent = track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0;

  return (
    <>
      <div className="spotify-card-container">
        {/* Topo do Card: Seletor de Aparelho & Biblioteca */}
        <div className="spotify-card-top">
          <button
            onClick={loadDevices}
            className="spotify-device-pill-btn"
            title="Trocar aparelho onde a música toca"
          >
            <Speaker size={12} className="text-green-400" />
            <span className="spotify-dev-pill-name">{track.deviceName}</span>
            <ChevronDown size={12} />
          </button>

          <div className="spotify-top-actions">
            <button
              onClick={() => loadLibrary('playlists')}
              className="spotify-btn-icon"
              title="Abrir Playlists e Biblioteca"
            >
              <ListMusic size={14} />
            </button>
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
          <div className="spotify-art-wrapper" onClick={() => loadLibrary('playlists')} title="Ver Playlists">
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

      {/* Renderizar Modais se abertos */}
      {isDevicesOpen && renderDevicesModal()}
      {isLibraryOpen && renderLibraryModal()}
    </>
  );
};
