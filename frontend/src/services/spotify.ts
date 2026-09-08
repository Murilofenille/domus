/**
 * Serviço de Integração Spotify Web API usando OAuth 2.0 PKCE + Spotify Web Playback SDK
 */

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '922729d9e3254a6294cecf9861003481';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';

// Escopos estendidos incluindo streaming e leitura de perfil para o Web Playback SDK
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-recently-played',
  'user-library-read'
].join(' ');

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  deviceName?: string;
  deviceId?: string;
  volumePercent?: number;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isLocal?: boolean;
  volumePercent: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  image: string;
  uri: string;
  tracksTotal: number;
}

export interface SpotifyPlaylistTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string;
  uri: string;
  durationMs: number;
}

export interface SpotifySearchItem {
  id: string;
  name: string;
  artists: string;
  albumArt: string;
  uri: string;
  durationMs: number;
}

export interface PlayResult {
  success: boolean;
  error?: 'NO_ACTIVE_DEVICE' | 'PREMIUM_REQUIRED' | 'AUTH_ERROR' | 'UNKNOWN';
  message?: string;
}

function getRedirectUri(): string {
  return window.location.origin + '/';
}

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Inicia o fluxo de autorização PKCE com o Spotify
 * Em PWA ou mobile, faz o redirecionamento direto na mesma janela para garantir retorno limpo
 */
export async function loginWithSpotify(): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  window.localStorage.setItem('spotify_code_verifier', codeVerifier);

  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    state: codeVerifier,
  });

  const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;

  // Sempre navega diretamente na janela do app para garantir que o PWA receba o redirect
  window.location.href = authUrl;
}

/**
 * Processa o código retornado na URL após login no Spotify
 */
export async function handleSpotifyCallback(code: string, stateVerifier?: string | null): Promise<boolean> {
  const codeVerifier = stateVerifier || window.localStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) {
    console.error('Code verifier não encontrado.');
    return false;
  }

  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    }),
  };

  try {
    const response = await fetch(TOKEN_ENDPOINT, payload);
    const data = await response.json();

    if (data.access_token) {
      window.localStorage.setItem('spotify_access_token', data.access_token);
      if (data.refresh_token) {
        window.localStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      window.localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
      window.localStorage.removeItem('spotify_code_verifier');
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao trocar código por token Spotify:', err);
    return false;
  }
}

/**
 * Renova o access token usando o refresh token
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = window.localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) {
    console.warn('Nenhum refresh token encontrado.');
    return null;
  }

  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  };

  try {
    const response = await fetch(TOKEN_ENDPOINT, payload);
    const data = await response.json();

    if (data.access_token) {
      window.localStorage.setItem('spotify_access_token', data.access_token);
      if (data.refresh_token) {
        window.localStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      window.localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
      console.log('Token Spotify renovado com sucesso!');
      return data.access_token;
    }
    return null;
  } catch (err) {
    console.error('Erro ao renovar token Spotify:', err);
    return null;
  }
}

/**
 * Obtém um token de acesso válido, renovando se necessário
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = window.localStorage.getItem('spotify_access_token');
  const expiresAt = Number(window.localStorage.getItem('spotify_token_expires_at') || '0');

  if (!token) return null;

  // Se expirar em menos de 120 segundos, renova proativamente
  if (Date.now() > expiresAt - 120000) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return refreshed;
    // Se a renovação falhou, limpa sessão morta
    logoutSpotify();
    return null;
  }

  return token;
}

/**
 * Wrapper centralizado para requisições da Spotify API com tratamento automático de 401
 */
export async function spotifyFetch(url: string, options: RequestInit = {}): Promise<Response | null> {
  let token = await getValidAccessToken();
  if (!token) return null;

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    console.error('Erro de rede ao chamar Spotify API:', err);
    return null;
  }

  // Se recebeu 401 (token expirado), tenta renovar imediatamente e repetir a requisição
  if (res.status === 401) {
    console.warn('Spotify retornou 401 Unauthorized. Tentando renovação de emergência...');
    token = await refreshAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      try {
        res = await fetch(url, { ...options, headers });
      } catch (err) {
        console.error('Erro de rede na repetição da chamada:', err);
        return null;
      }
    } else {
      console.warn('Não foi possível renovar sessão do Spotify.');
      logoutSpotify();
      return res;
    }
  }

  return res;
}

/**
 * Desconecta a conta do Spotify
 */
export function logoutSpotify(): void {
  window.localStorage.removeItem('spotify_access_token');
  window.localStorage.removeItem('spotify_refresh_token');
  window.localStorage.removeItem('spotify_token_expires_at');
  window.localStorage.removeItem('spotify_code_verifier');
  if (webPlayerInstance) {
    try {
      webPlayerInstance.disconnect();
    } catch {}
    webPlayerInstance = null;
  }
}

/**
 * Verifica se já existe uma sessão salva do Spotify
 */
export function isSpotifyConnected(): boolean {
  return !!window.localStorage.getItem('spotify_access_token');
}

/**
 * Busca o estado de reprodução atual do Spotify
 */
export async function fetchPlaybackState(): Promise<SpotifyTrack | null> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player');
  if (!res || res.status === 204 || !res.ok) {
    return null;
  }

  try {
    const data = await res.json();
    if (!data || !data.item) return null;

    const item = data.item;
    const albumArt = item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || '';
    const artists = (item.artists || []).map((a: any) => a.name).join(', ');

    return {
      id: item.id,
      name: item.name,
      artists: artists || 'Artista Desconhecido',
      album: item.album?.name || '',
      albumArt,
      durationMs: item.duration_ms || 0,
      progressMs: data.progress_ms || 0,
      isPlaying: !!data.is_playing,
      deviceName: data.device?.name || 'Aparelho Conectado',
      deviceId: data.device?.id,
      volumePercent: data.device?.volume_percent ?? 50,
    };
  } catch (err) {
    console.error('Erro ao processar dados de reprodução:', err);
    return null;
  }
}

/**
 * Alterna entre Play e Pause
 */
export async function toggleSpotifyPlay(isPlaying: boolean): Promise<boolean> {
  const endpoint = isPlaying
    ? 'https://api.spotify.com/v1/me/player/pause'
    : 'https://api.spotify.com/v1/me/player/play';

  const res = await spotifyFetch(endpoint, { method: 'PUT' });
  return !!res && (res.status === 204 || res.ok);
}

/**
 * Pula para a próxima música
 */
export async function nextSpotifyTrack(): Promise<boolean> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player/next', { method: 'POST' });
  return !!res && (res.status === 204 || res.ok);
}

/**
 * Volta para a música anterior
 */
export async function previousSpotifyTrack(): Promise<boolean> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player/previous', { method: 'POST' });
  return !!res && (res.status === 204 || res.ok);
}

/**
 * Busca todos os aparelhos de som disponíveis na casa (Echo, Smart TV, Tablet, PC...)
 */
export async function fetchAvailableDevices(): Promise<SpotifyDevice[]> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player/devices');
  if (!res || !res.ok) return [];

  try {
    const data = await res.json();
    return (data.devices || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      isActive: !!d.is_active,
      isLocal: d.id === localWebPlayerDeviceId,
      volumePercent: d.volume_percent ?? 50,
    }));
  } catch (err) {
    console.error('Erro ao buscar dispositivos:', err);
    return [];
  }
}

/**
 * Transfere a reprodução de áudio para outro aparelho (Spotify Connect)
 */
export async function transferSpotifyPlayback(deviceId: string, play: boolean = true): Promise<boolean> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_ids: [deviceId],
      play,
    }),
  });
  return !!res && (res.status === 204 || res.ok);
}

/**
 * Ajusta o volume do aparelho ativo (0 a 100)
 */
export async function setSpotifyVolume(volumePercent: number): Promise<boolean> {
  const res = await spotifyFetch(
    `https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(volumePercent)}`,
    { method: 'PUT' }
  );
  return !!res && (res.status === 204 || res.ok);
}

/**
 * Pula para um segundo específico da música (Seek / Barra de Progresso)
 */
export async function seekSpotifyTrack(positionMs: number): Promise<boolean> {
  const res = await spotifyFetch(
    `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.round(positionMs)}`,
    { method: 'PUT' }
  );
  return !!res && (res.status === 204 || res.ok);
}

/**
 * Extrai o número total de músicas de um objeto de playlist do Spotify de forma resiliente
 */
function extractTracksTotal(p: any): number {
  if (!p) return 0;
  if (typeof p.tracks?.total === 'number' && p.tracks.total >= 0) return p.tracks.total;
  if (typeof p.items?.total === 'number' && p.items.total >= 0) return p.items.total;
  if (typeof p.total === 'number' && p.total >= 0) return p.total;
  if (typeof p.total_tracks === 'number' && p.total_tracks >= 0) return p.total_tracks;
  if (typeof p.item_count === 'number' && p.item_count >= 0) return p.item_count;
  if (typeof p.tracks === 'number' && p.tracks >= 0) return p.tracks;
  if (p.tracks?.total && !isNaN(Number(p.tracks.total))) return Number(p.tracks.total);
  if (p.items?.total && !isNaN(Number(p.items.total))) return Number(p.items.total);
  if (Array.isArray(p.tracks)) return p.tracks.length;
  if (Array.isArray(p.items)) return p.items.length;
  return 0;
}

/**
 * Busca as playlists do usuário
 */
export async function fetchUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/playlists?limit=50');
  if (!res || !res.ok) {
    console.warn('Falha ao buscar playlists do usuário. Status:', res?.status);
    return [];
  }

  try {
    const data = await res.json();
    const playlists: SpotifyPlaylist[] = (data.items || []).filter((p: any) => p && p.id).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      image: p.images?.[0]?.url || p.images?.[1]?.url || '',
      uri: p.uri,
      tracksTotal: extractTracksTotal(p),
    }));

    // Se alguma playlist ficou com 0 músicas por limitação do endpoint simplificado, busca o total exato
    const zeroCountPlaylists = playlists.filter((pl) => pl.tracksTotal === 0).slice(0, 10);
    if (zeroCountPlaylists.length > 0) {
      await Promise.all(
        zeroCountPlaylists.map(async (pl) => {
          try {
            const detailRes = await spotifyFetch(`https://api.spotify.com/v1/playlists/${pl.id}?fields=tracks(total),items(total)`);
            if (detailRes && detailRes.ok) {
              const detailData = await detailRes.json();
              const count = extractTracksTotal(detailData);
              if (count > 0) {
                pl.tracksTotal = count;
              }
            }
          } catch {}
        })
      );
    }

    return playlists;
  } catch (err) {
    console.error('Erro ao analisar playlists:', err);
    return [];
  }
}

export interface PlaylistTracksResult {
  tracks: SpotifyPlaylistTrack[];
  total?: number;
  error?: 'FORBIDDEN' | 'NOT_FOUND' | 'AUTH_ERROR' | 'EMPTY' | 'UNKNOWN' | null;
  message?: string;
}

/**
 * Busca as faixas de uma playlist específica para permitir ao usuário escolher músicas individuais.
 * Suporta o endpoint moderno do Spotify (/items), o endpoint geral (/playlists/{id}) e o legado (/tracks).
 */
export async function fetchPlaylistTracks(playlistId: string): Promise<PlaylistTracksResult> {
  const cleanId = playlistId.replace('spotify:playlist:', '').trim();

  // 1. Tenta o endpoint moderno do Spotify (Fevereiro 2026): /v1/playlists/{id}/items
  let res = await spotifyFetch(`https://api.spotify.com/v1/playlists/${cleanId}/items?limit=100`);

  // 2. Se falhar ou retornar 403/404, tenta o endpoint da playlist completa: /v1/playlists/{id}
  if (!res || !res.ok) {
    console.warn(`Tentativa em /items retornou status ${res?.status}. Tentando /v1/playlists/${cleanId}...`);
    res = await spotifyFetch(`https://api.spotify.com/v1/playlists/${cleanId}`);
  }

  // 3. Se ainda falhar, tenta o endpoint legado /v1/playlists/{id}/tracks
  if (!res || !res.ok) {
    console.warn(`Tentando fallback legado /v1/playlists/${cleanId}/tracks...`);
    res = await spotifyFetch(`https://api.spotify.com/v1/playlists/${cleanId}/tracks?limit=100`);
  }

  if (!res || !res.ok) {
    console.error(`Falha ao obter faixas da playlist ${cleanId}. Status final:`, res?.status);
    return {
      tracks: [],
      error: res?.status === 403 ? 'FORBIDDEN' : res?.status === 404 ? 'NOT_FOUND' : 'UNKNOWN',
      message: `Não foi possível carregar as músicas da playlist (Status ${res?.status || 0}).`,
    };
  }

  try {
    const data = await res.json();
    // Extrai itens de qualquer uma das estruturas possíveis (items, items.items, tracks.items)
    const rawItems = data.items?.items || data.items || data.tracks?.items || [];
    const totalCount =
      (typeof data.total === 'number' && data.total >= 0 ? data.total : null) ??
      (typeof data.tracks?.total === 'number' && data.tracks.total >= 0 ? data.tracks.total : null) ??
      (typeof data.items?.total === 'number' && data.items.total >= 0 ? data.items.total : null) ??
      rawItems.length;

    const tracks: SpotifyPlaylistTrack[] = rawItems
      .map((item: any) => {
        const t = item.item || item.track || item;
        if (!t || (!t.name && !t.id)) return null;
        return {
          id: t.id || t.uri || String(Math.random()),
          name: t.name || 'Faixa sem título',
          artists: (t.artists || []).map((a: any) => a.name).join(', ') || 'Artista Desconhecido',
          album: t.album?.name || '',
          albumArt: t.album?.images?.[0]?.url || t.album?.images?.[1]?.url || '',
          uri: t.uri || '',
          durationMs: t.duration_ms || 0,
        };
      })
      .filter((t: any): t is SpotifyPlaylistTrack => t !== null);

    return {
      tracks,
      total: totalCount > 0 ? totalCount : tracks.length,
      error: tracks.length === 0 ? 'EMPTY' : null
    };
  } catch (err) {
    console.error('Erro ao processar faixas da playlist:', err);
    return { tracks: [], error: 'UNKNOWN', message: 'Erro ao processar lista de músicas.' };
  }
}

/**
 * Busca as músicas tocadas recentemente
 */
export async function fetchRecentlyPlayed(): Promise<SpotifySearchItem[]> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player/recently-played?limit=25');
  if (!res || !res.ok) {
    console.warn('Falha ao buscar recentes. Status:', res?.status);
    return [];
  }

  try {
    const data = await res.json();
    return (data.items || []).filter((i: any) => i && i.track).map((item: any) => {
      const track = item.track;
      return {
        id: track.id,
        name: track.name,
        artists: (track.artists || []).map((a: any) => a.name).join(', '),
        albumArt: track.album?.images?.[0]?.url || track.album?.images?.[1]?.url || '',
        uri: track.uri,
        durationMs: track.duration_ms || 0,
      };
    });
  } catch (err) {
    console.error('Erro ao analisar recentes:', err);
    return [];
  }
}

/**
 * Pesquisa faixas no Spotify
 */
export async function searchSpotify(query: string): Promise<SpotifySearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await spotifyFetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=track&limit=25`);
  if (!res || !res.ok) {
    console.warn('Falha na busca Spotify. Status:', res?.status);
    return [];
  }

  try {
    const data = await res.json();
    return (data.tracks?.items || []).map((track: any) => ({
      id: track.id,
      name: track.name,
      artists: (track.artists || []).map((a: any) => a.name).join(', '),
      albumArt: track.album?.images?.[0]?.url || track.album?.images?.[1]?.url || '',
      uri: track.uri,
      durationMs: track.duration_ms || 0,
    }));
  } catch (err) {
    console.error('Erro ao processar busca:', err);
    return [];
  }
}

/**
 * Encontra um dispositivo alvo automático caso nenhum esteja fornecido
 */
async function resolveTargetDeviceId(providedDeviceId?: string): Promise<string | undefined> {
  if (providedDeviceId) return providedDeviceId;
  if (localWebPlayerDeviceId) return localWebPlayerDeviceId;

  const devices = await fetchAvailableDevices();
  const active = devices.find((d) => d.isActive);
  if (active) return active.id;
  if (devices.length > 0) return devices[0].id;
  return undefined;
}

/**
 * Toca um contexto (Playlist ou Álbum), opcionalmente a partir de uma faixa específica
 */
export async function playSpotifyContext(
  contextUri: string,
  targetDeviceId?: string,
  offsetTrackUri?: string
): Promise<PlayResult> {
  const resolvedDeviceId = await resolveTargetDeviceId(targetDeviceId);
  const url = resolvedDeviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${resolvedDeviceId}`
    : 'https://api.spotify.com/v1/me/player/play';

  const body: any = { context_uri: contextUri };
  if (offsetTrackUri) {
    body.offset = { uri: offsetTrackUri };
  }

  const res = await spotifyFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res) {
    return { success: false, error: 'AUTH_ERROR', message: 'Sessão do Spotify não autenticada ou expirada.' };
  }

  if (res.status === 204 || res.ok) {
    return { success: true };
  }

  if (res.status === 404) {
    return {
      success: false,
      error: 'NO_ACTIVE_DEVICE',
      message: 'Nenhum aparelho ativo encontrado. Abra o Spotify ou clique em "Tocar neste Aparelho".',
    };
  }

  if (res.status === 403) {
    return {
      success: false,
      error: 'PREMIUM_REQUIRED',
      message: 'O Spotify exige uma conta Premium para iniciar músicas remotamente.',
    };
  }

  return { success: false, error: 'UNKNOWN', message: `Erro ao reproduzir (Status ${res.status}).` };
}

/**
 * Toca uma faixa específica com resolução automática de dispositivo e captura de erros
 */
export async function playSpotifyTrack(trackUri: string, targetDeviceId?: string): Promise<PlayResult> {
  const resolvedDeviceId = await resolveTargetDeviceId(targetDeviceId);
  const url = resolvedDeviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${resolvedDeviceId}`
    : 'https://api.spotify.com/v1/me/player/play';

  const res = await spotifyFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [trackUri] }),
  });

  if (!res) {
    return { success: false, error: 'AUTH_ERROR', message: 'Sessão do Spotify não autenticada ou expirada.' };
  }

  if (res.status === 204 || res.ok) {
    return { success: true };
  }

  if (res.status === 404) {
    return {
      success: false,
      error: 'NO_ACTIVE_DEVICE',
      message: 'Nenhum aparelho ativo encontrado. Abra o Spotify ou clique em "Tocar neste Aparelho".',
    };
  }

  if (res.status === 403) {
    return {
      success: false,
      error: 'PREMIUM_REQUIRED',
      message: 'O Spotify exige uma conta Premium para iniciar músicas remotamente.',
    };
  }

  return { success: false, error: 'UNKNOWN', message: `Erro ao reproduzir (Status ${res.status}).` };
}

/* =========================================================================
 * Integração com Spotify Web Playback SDK (Tocar no Navegador / Tablet DOMUS)
 * ========================================================================= */

let webPlayerInstance: any = null;
let localWebPlayerDeviceId: string | null = null;

export function getLocalDeviceId(): string | null {
  return localWebPlayerDeviceId;
}

export function isLocalPlayerReady(): boolean {
  return !!localWebPlayerDeviceId;
}

export interface WebPlayerCallbacks {
  onReady?: (deviceId: string) => void;
  onNotReady?: () => void;
  onPlayerStateChanged?: (state: any) => void;
  onError?: (type: string, message: string) => void;
}

/**
 * Inicializa o Spotify Web Playback SDK no tablet / navegador
 */
export function initSpotifyWebPlayer(callbacks: WebPlayerCallbacks): void {
  if (!isSpotifyConnected()) return;
  if (webPlayerInstance) return;

  const setupPlayer = () => {
    if (!window.Spotify || !window.Spotify.Player) {
      console.warn('Spotify Web Playback SDK ainda não disponível.');
      return;
    }

    try {
      const player = new window.Spotify.Player({
        name: 'DOMUS (Este Dispositivo)',
        getOAuthToken: (cb: (token: string) => void) => {
          getValidAccessToken().then((token) => {
            if (token) cb(token);
          });
        },
        volume: 0.8,
      });

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('DOMUS Web Player pronto com ID:', device_id);
        localWebPlayerDeviceId = device_id;
        callbacks.onReady?.(device_id);
      });

      player.addListener('not_ready', () => {
        console.warn('DOMUS Web Player desconectado.');
        localWebPlayerDeviceId = null;
        callbacks.onNotReady?.();
      });

      player.addListener('player_state_changed', (state: any) => {
        callbacks.onPlayerStateChanged?.(state);
      });

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Erro de inicialização do Spotify Player:', message);
        callbacks.onError?.('initialization_error', message);
      });

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Erro de autenticação do Spotify Player:', message);
        callbacks.onError?.('authentication_error', message);
      });

      player.addListener('account_error', ({ message }: { message: string }) => {
        console.warn('Aviso de conta Spotify (Premium necessário para tocar no navegador):', message);
        callbacks.onError?.('account_error', message);
      });

      player.connect().then((success: boolean) => {
        if (success) {
          console.log('Conexão ao Spotify Web Playback SDK estabelecida com sucesso!');
        }
      });

      webPlayerInstance = player;
    } catch (err) {
      console.error('Erro ao instanciar Spotify.Player:', err);
    }
  };

  if (window.Spotify && window.Spotify.Player) {
    setupPlayer();
  } else {
    window.onSpotifyWebPlaybackSDKReady = () => {
      setupPlayer();
    };
  }
}
