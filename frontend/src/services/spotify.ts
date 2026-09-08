/**
 * Serviço de Integração Spotify Web API usando OAuth 2.0 PKCE
 */

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '922729d9e3254a6294cecf9861003481';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
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
}

function getRedirectUri(): string {
  // Retorna a URL base atual (sem parâmetros de busca ou hash)
  return window.location.origin + (window.location.pathname === '/' ? '' : window.location.pathname);
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
 */
export async function loginWithSpotify(): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  window.localStorage.setItem('spotify_code_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: getRedirectUri(),
  });

  window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Processa o código retornado na URL após login no Spotify
 */
export async function handleSpotifyCallback(code: string): Promise<boolean> {
  const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) return false;

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
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = window.localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) return null;

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

  // Se expirar em menos de 60 segundos, renova
  if (Date.now() > expiresAt - 60000) {
    return await refreshAccessToken();
  }

  return token;
}

/**
 * Busca o estado de reprodução atual do Spotify
 */
export async function fetchPlaybackState(): Promise<SpotifyTrack | null> {
  const token = await getValidAccessToken();
  if (!token) return null;

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 204 || response.status > 400) {
      return null;
    }

    const data = await response.json();
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
    };
  } catch (err) {
    console.error('Erro ao buscar reprodução Spotify:', err);
    return null;
  }
}

/**
 * Alterna entre Play e Pause
 */
export async function toggleSpotifyPlay(isPlaying: boolean): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;

  const endpoint = isPlaying
    ? 'https://api.spotify.com/v1/me/player/pause'
    : 'https://api.spotify.com/v1/me/player/play';

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 204 || res.ok;
  } catch (err) {
    console.error('Erro ao alternar play/pause:', err);
    return false;
  }
}

/**
 * Pula para a próxima música
 */
export async function nextSpotifyTrack(): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 204 || res.ok;
  } catch (err) {
    console.error('Erro ao pular faixa:', err);
    return false;
  }
}

/**
 * Volta para a música anterior
 */
export async function previousSpotifyTrack(): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/previous', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 204 || res.ok;
  } catch (err) {
    console.error('Erro ao voltar faixa:', err);
    return false;
  }
}

/**
 * Desconecta a conta do Spotify
 */
export function logoutSpotify(): void {
  window.localStorage.removeItem('spotify_access_token');
  window.localStorage.removeItem('spotify_refresh_token');
  window.localStorage.removeItem('spotify_token_expires_at');
  window.localStorage.removeItem('spotify_code_verifier');
}

/**
 * Verifica se já existe uma sessão salva do Spotify
 */
export function isSpotifyConnected(): boolean {
  return !!window.localStorage.getItem('spotify_access_token');
}
