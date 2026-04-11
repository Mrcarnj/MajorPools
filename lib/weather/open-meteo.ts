import { format, parseISO } from 'date-fns';
import { wmoWeatherDescription } from './wmo-weather-code';
import { US_STATE_BY_ABBREV } from './us-state-names';

const DAILY_REVALIDATE_SECONDS = 86_400;

type GeocodeResult = {
  latitude: number;
  longitude: number;
  name: string;
};

type GeoApiHit = {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country_code?: string;
};

type ForecastDaily = {
  time: string[];
  weather_code: number[];
  precipitation_probability_max: (number | null)[];
  sunrise: string[];
  sunset: string[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  wind_gusts_10m_max?: (number | null)[];
  wind_direction_10m_dominant?: (number | null)[];
};

function degreesToCompass(deg: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const i = ((Math.round(deg / 22.5) % 16) + 16) % 16;
  return dirs[i];
}

function formatWallClock(isoLocal: string): string {
  const match = isoLocal.match(/T(\d{2}):(\d{2})/);
  if (!match) return isoLocal;
  const hour = parseInt(match[1], 10);
  const minute = match[2];
  const isPm = hour >= 12;
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${isPm ? 'PM' : 'AM'}`;
}

function normalizeCountryCode(country: string | null | undefined): string | undefined {
  if (!country) return undefined;
  const t = country.trim();
  if (!t) return undefined;
  const lower = t.toLowerCase();
  if (lower === 'us' || lower === 'usa' || lower === 'united states' || lower === 'united states of america') {
    return 'US';
  }
  if (lower === 'uk' || lower === 'gb' || lower === 'great britain' || lower === 'united kingdom') {
    return 'GB';
  }
  if (t.length === 2) return t.toUpperCase();
  return undefined;
}

function admin1MatchesState(admin1: string, state: string): boolean {
  const st = state.trim();
  if (!st) return false;
  const a = admin1.trim().toLowerCase();
  if (st.length === 2) {
    const full = US_STATE_BY_ABBREV[st.toUpperCase()];
    if (full && a === full.toLowerCase()) return true;
  }
  return a === st.toLowerCase() || a.includes(st.toLowerCase()) || st.toLowerCase().includes(a);
}

async function searchGeocode(params: Record<string, string>): Promise<GeoApiHit[]> {
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString(), { next: { revalidate: DAILY_REVALIDATE_SECONDS } });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: GeoApiHit[] };
  return data.results ?? [];
}

function hitToResult(hit: GeoApiHit): GeocodeResult {
  return { latitude: hit.latitude, longitude: hit.longitude, name: hit.name };
}

async function geocodeVenue(input: {
  city: string | null;
  state: string | null;
  country: string | null;
}): Promise<GeocodeResult | null> {
  const city = input.city?.trim() || '';
  const state = input.state?.trim() || '';
  const country = input.country?.trim() || '';
  const countryCode = normalizeCountryCode(country || null);

  if (city && countryCode) {
    const hits = await searchGeocode({
      name: city,
      country: countryCode,
      count: '15',
      language: 'en',
      format: 'json',
    });
    if (hits.length) {
      if (state) {
        const byState = hits.find((h) => h.admin1 && admin1MatchesState(h.admin1, state));
        if (byState) return hitToResult(byState);
      }
      return hitToResult(hits[0]);
    }
  }

  const query = [city, state, country].filter(Boolean).join(' ');
  if (!query.trim()) return null;

  const hits = await searchGeocode({
    name: query,
    count: '8',
    language: 'en',
    format: 'json',
  });
  if (!hits[0]) return null;
  if (state && hits.length > 1) {
    const byState = hits.find((h) => h.admin1 && admin1MatchesState(h.admin1, state));
    if (byState) return hitToResult(byState);
  }
  return hitToResult(hits[0]);
}

async function fetchDailyForecast(
  lat: number,
  lon: number,
  /** ISO date YYYY-MM-DD — included so Next.js fetch cache rolls forward each calendar day. */
  calendarDay: string
): Promise<ForecastDaily | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      'weather_code,precipitation_probability_max,sunrise,sunset,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    start_date: calendarDay,
    end_date: calendarDay,
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: DAILY_REVALIDATE_SECONDS } });
  if (!res.ok) return null;
  const json = (await res.json()) as { daily?: ForecastDaily };
  return json.daily ?? null;
}

export type VenueWeatherPayload = {
  weekday: string;
  dateLine: string;
  weatherCode: number;
  forecast: string;
  highTempF: number | null;
  lowTempF: number | null;
  precipitationChancePercent: number | null;
  sunrise: string;
  sunset: string;
  /** Daily max wind / gusts (mph) and dominant direction; omitted when API has no wind fields. */
  wind?: {
    speedMph: number;
    gustMph: number | null;
    direction: string | null;
  };
};

export async function fetchVenueWeatherToday(input: {
  city: string | null;
  state: string | null;
  country: string | null;
  /** Client local calendar day YYYY-MM-DD — new day = new upstream cache + correct "today" forecast. */
  calendarDay: string;
}): Promise<VenueWeatherPayload | { error: string }> {
  const parts = [input.city, input.state, input.country].filter((p) => p && String(p).trim());
  const locationQuery = parts.join(', ');
  if (!locationQuery.trim()) {
    return { error: 'Missing location' };
  }

  const geo = await geocodeVenue(input);
  if (!geo) {
    return { error: 'Location not found' };
  }

  const daily = await fetchDailyForecast(geo.latitude, geo.longitude, input.calendarDay);
  if (!daily?.time?.length) {
    return { error: 'Forecast unavailable' };
  }

  const i = 0;
  const dateStr = daily.time[i];
  const code = daily.weather_code[i] ?? 0;
  const precip = daily.precipitation_probability_max[i];
  const sunrise = daily.sunrise[i];
  const sunset = daily.sunset[i];
  const windSpeed = daily.wind_speed_10m_max?.[i];
  const windGust = daily.wind_gusts_10m_max?.[i];
  const windDirDeg = daily.wind_direction_10m_dominant?.[i];
  const tMax = daily.temperature_2m_max?.[i];
  const tMin = daily.temperature_2m_min?.[i];

  const parsed = parseISO(dateStr);

  const payload: VenueWeatherPayload = {
    weekday: format(parsed, 'EEEE'),
    dateLine: format(parsed, 'MMM d, yyyy'),
    weatherCode: code,
    forecast: wmoWeatherDescription(code),
    highTempF: typeof tMax === 'number' && !Number.isNaN(tMax) ? Math.round(tMax) : null,
    lowTempF: typeof tMin === 'number' && !Number.isNaN(tMin) ? Math.round(tMin) : null,
    precipitationChancePercent: typeof precip === 'number' ? precip : null,
    sunrise: sunrise ? formatWallClock(sunrise) : '—',
    sunset: sunset ? formatWallClock(sunset) : '—',
  };

  if (typeof windSpeed === 'number' && !Number.isNaN(windSpeed)) {
    const gustOk = typeof windGust === 'number' && !Number.isNaN(windGust);
    const dirOk = typeof windDirDeg === 'number' && !Number.isNaN(windDirDeg);
    payload.wind = {
      speedMph: Math.round(windSpeed),
      gustMph: gustOk ? Math.round(windGust) : null,
      direction: dirOk ? degreesToCompass(windDirDeg) : null,
    };
  }

  return payload;
}
