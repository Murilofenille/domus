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
  RotateCw,
  AlertCircle,
  ArrowLeft,
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
  seekSpotifyTrack,
  fetchAvailableDevices,
  transferSpotifyPlayback,
  setSpotifyVolume,
  fetchUserPlaylists,
  fetchPlaylistTracks,
  fetchRecentlyPlayed,
  searchSpotify,
  playSpotifyContext,
  playSpotifyTrack,
  initSpotifyWebPlayer,
  getLocalDeviceId,
  type SpotifyTrack,
  type SpotifyDevice,
  type SpotifyPlaylist,
  type SpotifyPlaylistTrack,
  type SpotifySearchItem
} from '../services/spotify';

export const SpotifyPlayer: React.FC = () => {
  const [connected, setConnected] = useState<boolean>(() => isSpotifyConnected());
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [seekPositionMs, setSeekPositionMs] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Estados dos Modais
  const [isDevicesOpen, setIsDevicesOpen] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [libraryTab, setLibraryTab] = useState<'playlists' | 'recent' | 'search'>('playlists');

  // Dados da Biblioteca e Aparelhos
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyPlaylistTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);

  const [recentTracks, setRecentTracks] = useState<SpotifySearchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SpotifySearchItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState<boolean>(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(50);

  // Mensagens e Alertas
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null);

  const showAlert = (msg: string) => {
    setAlertMessage(msg);
    setTimeout(() => {
      setAlertMessage(null);
    }, 6000);
  };

  // Inicializa o Web Playback SDK para transformar o DOMUS em caixa de som
  useEffect(() => {
    if (!connected) return;

    initSpotifyWebPlayer({
      onReady: (devId) => {
        setLocalDeviceId(devId);
      },
      onNotReady: () => {
        setLocalDeviceId(null);
      },
      onPlayerStateChanged: (state) => {
        if (state) {
          syncPlayback();
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
  }, [connected]);

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

  // Escutar eventos de login vindos de outras abas ou foco
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
    const delay = track?.isPlaying ? 3000 : 7000;
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

  // Carregar playlists com estado de loading explícito
  const refreshPlaylists = async () => {
    setIsLoadingPlaylists(true);
    const list = await fetchUserPlaylists();
    setPlaylists(list);
    setIsLoadingPlaylists(false);
  };

  // Carregar músicas recentes com estado de loading explícito
  const refreshRecent = async () => {
    setIsLoadingRecent(true);
    const list = await fetchRecentlyPlayed();
    setRecentTracks(list);
    setIsLoadingRecent(false);
  };

  // Carregar playlists ou recentes
  const loadLibrary = async (tab: 'playlists' | 'recent' | 'search') => {
    setLibraryTab(tab);
    setSelectedPlaylist(null); // Volta para grade de playlists se mudar de aba
    setPlaylistError(null);
    setIsLibraryOpen(true);
    if (tab === 'playlists' && playlists.length === 0) {
      await refreshPlaylists();
    } else if (tab === 'recent' && recentTracks.length === 0) {
      await refreshRecent();
    }
  };

  // Abrir uma playlist específica e carregar as músicas dela
  const handleOpenPlaylist = async (pl: SpotifyPlaylist) => {
    setSelectedPlaylist(pl);
    setPlaylistError(null);
    setIsLoadingTracks(true);
    const res = await fetchPlaylistTracks(pl.id);
    setPlaylistTracks(res.tracks);

    // Atualiza a contagem precisa de músicas tanto no banner da playlist quanto na grade
    const accurateTotal = res.total !== undefined && res.total > 0 ? res.total : res.tracks.length;
    if (accurateTotal > 0) {
      setSelectedPlaylist((prev) => (prev ? { ...prev, tracksTotal: accurateTotal } : null));
      setPlaylists((prev) =>
        prev.map((item) => (item.id === pl.id ? { ...item, tracksTotal: accurateTotal } : item))
      );
    }

    if (res.error === 'FORBIDDEN') {
      setPlaylistError('PERMISSIONS_REQUIRED');
    } else if (res.error && res.error !== 'EMPTY') {
      setPlaylistError(res.message || 'Erro ao carregar faixas.');
    }
    setIsLoadingTracks(false);
  };

  // Busca imediata (Enter no teclado ou clique no botão Buscar)
  const executeSearch = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const res = await searchSpotify(trimmed);
    setSearchResults(res);
    setIsSearching(false);
  };

  // Busca debounced enquanto o usuário digita
  useEffect(() => {
    if (libraryTab !== 'search') return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Marca searching IMEDIATAMENTE para não piscar "Nenhuma música encontrada" a cada tecla
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchSpotify(trimmed);
      setSearchResults(res);
      setIsSearching(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery, libraryTab]);

  // Avanço em tempo real do segundo da música enquanto estiver tocando
  useEffect(() => {
    if (!track?.isPlaying || seekPositionMs !== null) return;
    const timer = setInterval(() => {
      setTrack((prev) => {
        if (!prev || !prev.isPlaying || prev.progressMs >= prev.durationMs) return prev;
        return { ...prev, progressMs: Math.min(prev.progressMs + 1000, prev.durationMs) };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [track?.isPlaying, seekPositionMs]);

  const handleSeekChange = (newMs: number) => {
    setSeekPositionMs(newMs);
  };

  const handleSeekCommit = async (targetMs: number) => {
    setSeekPositionMs(null);
    if (track) {
      setTrack({ ...track, progressMs: targetMs });
    }
    await seekSpotifyTrack(targetMs);
    setTimeout(syncPlayback, 500);
  };

  // Controles de Reprodução
  const handleTogglePlay = async () => {
    if (!track || isBusy) return;
    setIsBusy(true);
    const prevPlaying = track.isPlaying;
    setTrack({ ...track, isPlaying: !prevPlaying });

    const ok = await toggleSpotifyPlay(prevPlaying);
    if (!ok) {
      showAlert('Não foi possível alternar a música. Verifique se o Spotify está ativo ou selecione um aparelho.');
    }
    setTimeout(syncPlayback, 500);
    setIsBusy(false);
  };

  const handleNext = async () => {
    if (isBusy) return;
    setIsBusy(true);
    await nextSpotifyTrack();
    setTimeout(syncPlayback, 600);
    setIsBusy(false);
  };

  const handlePrevious = async () => {
    if (isBusy) return;
    setIsBusy(true);
    await previousSpotifyTrack();
    setTimeout(syncPlayback, 600);
    setIsBusy(false);
  };

  const handleTransferDevice = async (deviceId: string) => {
    setIsBusy(true);
    const ok = await transferSpotifyPlayback(deviceId, true);
    setIsDevicesOpen(false);
    if (!ok) {
      showAlert('Não foi possível transferir para o aparelho selecionado.');
    }
    setTimeout(syncPlayback, 700);
    setIsBusy(false);
  };

  const handlePlayOnThisDevice = async () => {
    const devId = localDeviceId || getLocalDeviceId();
    if (!devId) {
      showAlert('O player deste dispositivo requer conta Spotify Premium para tocar som direto no navegador.');
      return;
    }
    await handleTransferDevice(devId);
  };

  const handleVolumeChange = async (newVol: number) => {
    setVolume(newVol);
    await setSpotifyVolume(newVol);
  };


  // Tocar a playlist inteira
  const handlePlayPlaylist = async (uri: string) => {
    setIsBusy(true);
    const result = await playSpotifyContext(uri, track?.deviceId || localDeviceId || undefined);
    setIsBusy(false);

    if (!result.success) {
      if (result.error === 'PREMIUM_REQUIRED') {
        showAlert('⚠️ O Spotify exige uma conta Premium para iniciar músicas remotamente por API.');
      } else if (result.error === 'NO_ACTIVE_DEVICE') {
        showAlert('⚠️ Nenhum aparelho com Spotify encontrado aberto. Abra o Spotify ou clique em "Tocar neste dispositivo".');
      } else {
        showAlert(result.message || 'Erro ao iniciar playlist.');
      }
      return;
    }

    setIsLibraryOpen(false);
    setTimeout(syncPlayback, 700);
  };

  // Tocar uma música específica de dentro da playlist
  const handlePlayTrackInPlaylist = async (playlistUri: string, trackUri: string) => {
    setIsBusy(true);
    const result = await playSpotifyContext(playlistUri, track?.deviceId || localDeviceId || undefined, trackUri);
    setIsBusy(false);

    if (!result.success) {
      if (result.error === 'PREMIUM_REQUIRED') {
        showAlert('⚠️ O Spotify exige uma conta Premium para iniciar músicas remotamente por API.');
      } else if (result.error === 'NO_ACTIVE_DEVICE') {
        showAlert('⚠️ Nenhum aparelho com Spotify encontrado aberto. Abra o Spotify ou clique em "Tocar neste dispositivo".');
      } else {
        showAlert(result.message || 'Erro ao iniciar música.');
      }
      return;
    }

    setIsLibraryOpen(false);
    setTimeout(syncPlayback, 700);
  };

  // Tocar faixa avulsa (de busca ou recentes)
  const handlePlayTrack = async (uri: string) => {
    setIsBusy(true);
    const result = await playSpotifyTrack(uri, track?.deviceId || localDeviceId || undefined);
    setIsBusy(false);

    if (!result.success) {
      if (result.error === 'PREMIUM_REQUIRED') {
        showAlert('⚠️ O Spotify exige uma conta Premium para iniciar músicas remotamente por API.');
      } else if (result.error === 'NO_ACTIVE_DEVICE') {
        showAlert('⚠️ Nenhum aparelho com Spotify encontrado aberto. Abra o Spotify ou clique em "Tocar neste dispositivo".');
      } else {
        showAlert(result.message || 'Erro ao iniciar música.');
      }
      return;
    }

    setIsLibraryOpen(false);
    setTimeout(syncPlayback, 700);
  };

  const handleLogout = () => {
    logoutSpotify();
    setConnected(false);
    setTrack(null);
    setIsDevicesOpen(false);
    setIsLibraryOpen(false);
  };

  const handleReconnect = () => {
    logoutSpotify();
    loginWithSpotify();
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
          <button onClick={loadDevices} className="spotify-btn-ghost" title="Aparelhos de Som">
            <Speaker size={14} />
          </button>
          <button onClick={handleReconnect} className="spotify-btn-ghost" title="Reconectar / Renovar Permissões">
            <RotateCw size={13} />
          </button>
          <button onClick={handleLogout} className="spotify-btn-ghost" title="Desconectar Spotify">
            <LogOut size={14} />
          </button>
        </div>

        {/* Alerta / Mensagem Flutuante */}
        {alertMessage && (
          <div className="spotify-alert-toast">
            <AlertCircle size={14} />
            <span>{alertMessage}</span>
          </div>
        )}

        {/* Modais quando ocioso */}
        {isDevicesOpen && renderDevicesModal()}
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

  // 4. Modal de Aparelhos (Spotify Connect + Som Local)
  function renderDevicesModal() {
    return (
      <div className="spotify-modal-overlay" onClick={() => setIsDevicesOpen(false)}>
        <div className="spotify-devices-card" onClick={(e) => e.stopPropagation()}>
          <div className="spotify-modal-header">
            <div className="spotify-modal-title">
              <Speaker size={18} className="text-green-400" />
              <span>Onde a música deve tocar?</span>
            </div>
            <button onClick={() => setIsDevicesOpen(false)} className="spotify-close-btn">
              <X size={16} />
            </button>
          </div>

          {/* Botão de Destaque: Tocar no Dispositivo Atual (Tablet/Computador) */}
          <div className="spotify-local-player-box">
            <button
              onClick={handlePlayOnThisDevice}
              className="spotify-local-dev-btn"
              title="Transformar este dispositivo em caixa de som do Spotify"
            >
              <Speaker size={18} className="text-amber-400" />
              <div className="spotify-local-dev-info">
                <strong>Tocar Neste Dispositivo (DOMUS)</strong>
                <span>Tocar diretamente no alto-falante deste tablet/computador</span>
              </div>
            </button>
          </div>

          <div className="spotify-devices-list">
            <div className="spotify-section-label">Aparelhos na Rede (Spotify Connect):</div>
            {devices.length === 0 ? (
              <div className="spotify-empty-dev-box">
                <p className="spotify-empty-text">Nenhum aparelho ativo detectado.</p>
                <span className="spotify-dev-hint">
                  Abra o Spotify no celular, Smart TV ou Echo Dot para ele aparecer aqui.
                </span>
              </div>
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
                      {dev.isActive ? '🟢 Tocando agora' : dev.type}
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

  // 5. Modal de Biblioteca (Playlists, Músicas da Playlist, Recentes, Busca)
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
                onClick={() => loadLibrary('search')}
              >
                <Search size={16} />
                <span>Buscar</span>
              </button>
            </div>

            <div className="spotify-lib-header-actions">
              {libraryTab === 'playlists' && !selectedPlaylist && (
                <button
                  onClick={refreshPlaylists}
                  className={`spotify-btn-icon-sm ${isLoadingPlaylists ? 'animate-spin' : ''}`}
                  title="Atualizar Playlists"
                >
                  <RotateCw size={14} />
                </button>
              )}
              {libraryTab === 'recent' && (
                <button
                  onClick={refreshRecent}
                  className={`spotify-btn-icon-sm ${isLoadingRecent ? 'animate-spin' : ''}`}
                  title="Atualizar Recentes"
                >
                  <RotateCw size={14} />
                </button>
              )}
              <button onClick={() => setIsLibraryOpen(false)} className="spotify-close-btn">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Conteúdo da Aba */}
          <div className="spotify-library-content">
            {/* Aba 1: Playlists (Grade ou Visão Detalhada com Lista de Músicas) */}
            {libraryTab === 'playlists' && (
              selectedPlaylist ? (
                /* Detalhes da Playlist com Lista de Músicas para Escolher */
                <div className="spotify-playlist-detail-view">
                  <div className="spotify-playlist-detail-header">
                    <button
                      onClick={() => setSelectedPlaylist(null)}
                      className="spotify-back-btn"
                      title="Voltar para todas as playlists"
                    >
                      <ArrowLeft size={16} />
                      <span>Voltar para Playlists</span>
                    </button>
                  </div>

                  <div className="spotify-playlist-detail-banner">
                    {selectedPlaylist.image ? (
                      <img
                        src={selectedPlaylist.image}
                        alt={selectedPlaylist.name}
                        className="spotify-detail-cover"
                      />
                    ) : (
                      <div className="spotify-detail-cover-placeholder">
                        <Music size={32} />
                      </div>
                    )}
                    <div className="spotify-detail-meta">
                      <span className="spotify-detail-tag">PLAYLIST</span>
                      <h4 className="spotify-detail-title">{selectedPlaylist.name}</h4>
                      <span className="spotify-detail-sub">
                        {isLoadingTracks
                          ? 'Carregando músicas...'
                          : `${(selectedPlaylist.tracksTotal || playlistTracks.length) || 0} ${
                              ((selectedPlaylist.tracksTotal || playlistTracks.length) || 0) === 1
                                ? 'música'
                                : 'músicas'
                            }`}
                      </span>
                      <button
                        onClick={() => handlePlayPlaylist(selectedPlaylist.uri)}
                        className="spotify-detail-play-all"
                        title="Tocar a playlist inteira a partir do início"
                      >
                        <Play size={16} fill="currentColor" />
                        <span>Tocar Playlist Inteira</span>
                      </button>
                    </div>
                  </div>

                  <div className="spotify-tracks-list">
                    {isLoadingTracks ? (
                      <div className="spotify-loading-state">
                        <RotateCw size={24} className="animate-spin text-amber-500" />
                        <p className="spotify-empty-text">Carregando músicas da playlist...</p>
                      </div>
                    ) : playlistError === 'PERMISSIONS_REQUIRED' ? (
                      <div className="spotify-empty-state">
                        <AlertCircle size={32} className="text-amber-500" />
                        <h5 style={{ color: '#FFFFFF', margin: '4px 0', fontWeight: 700 }}>Permissões Desatualizadas</h5>
                        <p className="spotify-empty-text" style={{ padding: '0 0 12px 0' }}>
                          Sua sessão do Spotify foi aberta antes de adicionarmos a leitura das playlists. Clique abaixo para reconectar e liberar o acesso às músicas:
                        </p>
                        <button onClick={handleReconnect} className="spotify-reconnect-btn" style={{ padding: '8px 18px', fontSize: '13px' }}>
                          🔄 Reconectar e Atualizar Acesso
                        </button>
                      </div>
                    ) : playlistTracks.length === 0 ? (
                      <div className="spotify-empty-state">
                        <Music size={28} className="text-gray-500" />
                        <p className="spotify-empty-text" style={{ padding: '0 0 8px 0' }}>
                          {playlistError || 'Nenhuma música encontrada nesta playlist ou playlist privada.'}
                        </p>
                        <button onClick={handleReconnect} className="spotify-reconnect-btn">
                          Reconectar Spotify
                        </button>
                      </div>
                    ) : (
                      playlistTracks.map((trk, idx) => (
                        <div
                          key={`${trk.id}-${idx}`}
                          onClick={() => handlePlayTrackInPlaylist(selectedPlaylist.uri, trk.uri)}
                          className="spotify-track-row"
                          title={`Tocar ${trk.name}`}
                        >
                          <span className="spotify-track-num">{idx + 1}</span>
                          {trk.albumArt ? (
                            <img src={trk.albumArt} alt={trk.name} className="spotify-row-art" />
                          ) : (
                            <div className="spotify-row-art-ph">
                              <Music size={14} />
                            </div>
                          )}
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
                </div>
              ) : (
                /* Grade de Playlists */
                <div className="spotify-playlists-grid">
                  {isLoadingPlaylists ? (
                    <div className="spotify-loading-state">
                      <RotateCw size={24} className="animate-spin text-amber-500" />
                      <p className="spotify-empty-text">Buscando playlists da sua conta...</p>
                    </div>
                  ) : playlists.length === 0 ? (
                    <div className="spotify-empty-state">
                      <Music size={32} className="text-gray-500" />
                      <p className="spotify-empty-text">Nenhuma playlist encontrada ou permissão expirada.</p>
                      <div className="spotify-empty-actions">
                        <button onClick={refreshPlaylists} className="spotify-retry-btn">
                          Tentar Novamente
                        </button>
                        <button onClick={handleReconnect} className="spotify-reconnect-btn">
                          Reconectar Spotify
                        </button>
                      </div>
                    </div>
                  ) : (
                    playlists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => handleOpenPlaylist(pl)}
                        className="spotify-playlist-card"
                        title={`Abrir playlist ${pl.name}`}
                      >
                        <div className="spotify-pl-cover-wrapper">
                          {pl.image ? (
                            <img src={pl.image} alt={pl.name} className="spotify-pl-cover" />
                          ) : (
                            <div className="spotify-pl-placeholder">
                              <Music size={28} />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayPlaylist(pl.uri);
                            }}
                            className="spotify-pl-play-btn"
                            title="Tocar Playlist Direto"
                          >
                            <Play size={18} fill="currentColor" />
                          </button>
                        </div>
                        <h5 className="spotify-pl-title">{pl.name}</h5>
                        <span className="spotify-pl-tracks">
                          {pl.tracksTotal > 0
                            ? `${pl.tracksTotal} ${pl.tracksTotal === 1 ? 'música' : 'músicas'}`
                            : 'Ver músicas'} • Toque p/ abrir
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )
            )}

            {/* Aba 2: Músicas Recentes */}
            {libraryTab === 'recent' && (
              <div className="spotify-tracks-list">
                {isLoadingRecent ? (
                  <div className="spotify-loading-state">
                    <RotateCw size={24} className="animate-spin text-amber-500" />
                    <p className="spotify-empty-text">Buscando faixas tocadas recentemente...</p>
                  </div>
                ) : recentTracks.length === 0 ? (
                  <div className="spotify-empty-state">
                    <Clock size={32} className="text-gray-500" />
                    <p className="spotify-empty-text">Nenhuma música recente encontrada ou sessão expirada.</p>
                    <div className="spotify-empty-actions">
                      <button onClick={refreshRecent} className="spotify-retry-btn">
                        Tentar Novamente
                      </button>
                      <button onClick={handleReconnect} className="spotify-reconnect-btn">
                        Reconectar Spotify
                      </button>
                    </div>
                  </div>
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    executeSearch(searchQuery);
                  }}
                  className="spotify-search-bar"
                >
                  <Search size={18} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Música, artista, banda ou álbum..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="spotify-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setIsSearching(false);
                      }}
                      className="spotify-clear-btn"
                      title="Limpar busca"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="spotify-search-submit-btn"
                    title="Pesquisar agora"
                  >
                    Buscar
                  </button>
                </form>

                <div className="spotify-search-results">
                  {isSearching ? (
                    <div className="spotify-loading-state">
                      <RotateCw size={20} className="animate-spin text-amber-500" />
                      <p className="spotify-empty-text">Pesquisando no catálogo do Spotify...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((trk) => (
                      <div
                        key={trk.id}
                        onClick={() => handlePlayTrack(trk.uri)}
                        className="spotify-track-row"
                        title={`Tocar ${trk.name}`}
                      >
                        {trk.albumArt ? (
                          <img src={trk.albumArt} alt={trk.name} className="spotify-row-art" />
                        ) : (
                          <div className="spotify-row-art-ph">
                            <Music size={14} />
                          </div>
                        )}
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
                    <div className="spotify-empty-state">
                      <Search size={28} className="text-gray-500" />
                      <p className="spotify-empty-text" style={{ padding: '6px 0 12px 0' }}>
                        Nenhuma música encontrada para "{searchQuery}".
                        <br />
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          Tente buscar por outro artista, álbum ou nome da faixa.
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => executeSearch(searchQuery)}
                        className="spotify-retry-btn"
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  ) : (
                    <div className="spotify-search-suggestions">
                      <p className="spotify-empty-text" style={{ paddingBottom: '10px' }}>
                        Digite o nome de uma música, artista ou banda acima.
                      </p>
                      <div className="spotify-suggestion-pills">
                        {['Sertanejo', 'Rock', 'Pop', 'Chitãozinho', 'Coldplay', 'Pagode'].map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => {
                              setSearchQuery(sug);
                              executeSearch(sug);
                            }}
                            className="spotify-sug-pill"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
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
  const currentProgressMs = seekPositionMs !== null ? seekPositionMs : (track.progressMs || 0);
  const progressPercent = track.durationMs > 0 ? (currentProgressMs / track.durationMs) * 100 : 0;

  return (
    <>
      <div className="spotify-card-container">
        {/* Alerta Flutuante */}
        {alertMessage && (
          <div className="spotify-alert-toast">
            <AlertCircle size={14} />
            <span>{alertMessage}</span>
          </div>
        )}

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

        {/* Barra de Progresso com Seek Interativo */}
        <div className="spotify-progress-container">
          <div className={`spotify-progress-bar interactive ${seekPositionMs !== null ? 'is-dragging' : ''}`}>
            <div className="spotify-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
            <div className="spotify-progress-thumb" style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
            <input
              type="range"
              min="0"
              max={track.durationMs || 100}
              value={currentProgressMs}
              onChange={(e) => handleSeekChange(Number(e.target.value))}
              onMouseUp={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
              className="spotify-progress-slider-overlay"
              title="Arraste ou toque para ir para qualquer segundo da música"
            />
          </div>
          <div className="spotify-time-labels">
            <span>{formatTime(currentProgressMs)}</span>
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
