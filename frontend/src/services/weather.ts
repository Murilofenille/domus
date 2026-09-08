/**
 * Serviço de Clima e Previsão do Tempo (Open-Meteo API pública e gratuita)
 */

export interface WeatherData {
  temperatureC: number;
  temperatureF: number;
  conditionText: string;
  conditionCode: number;
  iconType: 'sunny' | 'cloudy' | 'rainy' | 'storm';
  city: string;
  weekday: string;
  humidity: number;
}

// Coordenadas padrão (São Paulo / Interior SP - Região de alta incidência de áreas de lazer)
const DEFAULT_LAT = -22.0;
const DEFAULT_LON = -47.9;
const DEFAULT_CITY = 'Área de Lazer';

function getWeatherCondition(code: number, isDay: boolean): { text: string; icon: 'sunny' | 'cloudy' | 'rainy' | 'storm' } {
  if (code === 0) {
    return { text: isDay ? 'Ensolarado' : 'Céu Limpo', icon: 'sunny' };
  }
  if (code <= 3) {
    return { text: code === 1 ? 'Quase Limpo' : 'Parcialmente Nublado', icon: 'cloudy' };
  }
  if (code >= 45 && code <= 48) {
    return { text: 'Nevoeiro', icon: 'cloudy' };
  }
  if (code >= 51 && code <= 67) {
    return { text: 'Chuvoso', icon: 'rainy' };
  }
  if (code >= 80 && code <= 82) {
    return { text: 'Pancadas de Chuva', icon: 'rainy' };
  }
  if (code >= 95) {
    return { text: 'Tempestade', icon: 'storm' };
  }
  return { text: 'Nublado', icon: 'cloudy' };
}

export async function fetchWeatherData(): Promise<WeatherData> {
  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;
  let city = DEFAULT_CITY;

  // Tenta obter geolocalização do navegador
  try {
    if ('geolocation' in navigator) {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      city = 'Minha Região';
    }
  } catch {
    // Mantém coordenadas padrão
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&timezone=auto`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erro ao buscar clima: ${res.statusText}`);
  }

  const data = await res.json();
  const current = data.current;
  const tempC = Math.round(current.temperature_2m);
  const tempF = Math.round((tempC * 9) / 5 + 32);
  const condition = getWeatherCondition(current.weather_code, Boolean(current.is_day));

  const now = new Date();
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return {
    temperatureC: tempC,
    temperatureF: tempF,
    conditionText: condition.text,
    conditionCode: current.weather_code,
    iconType: condition.icon,
    city,
    weekday: capitalizedWeekday,
    humidity: current.relative_humidity_2m
  };
}
