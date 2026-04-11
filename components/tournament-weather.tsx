'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CloudSun, Droplets, Sunrise, Sunset, Wind } from 'lucide-react';
import type { ActiveOrNextTournament } from '@/hooks/use-active-or-next-tournament';
import { WeatherConditionIcon } from '@/lib/weather/weather-condition-icon';

type WeatherResponse = {
  weekday: string;
  dateLine: string;
  weatherCode: number;
  forecast: string;
  highTempF: number | null;
  lowTempF: number | null;
  precipitationChancePercent: number | null;
  sunrise: string;
  sunset: string;
  wind?: {
    speedMph: number;
    gustMph: number | null;
    direction: string | null;
  };
};

function compactCardClass(extra = '') {
  return `bg-card/50 border-border/70 w-full md:h-full ${extra}`;
}

type Props = {
  tournament: ActiveOrNextTournament | null;
  loading: boolean;
};

export function TournamentWeather({ tournament, loading }: Props) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const city = tournament?.city != null ? String(tournament.city).trim() : '';
  const state = tournament?.state != null ? String(tournament.state).trim() : '';
  const country = tournament?.country != null ? String(tournament.country).trim() : '';
  const canFetch = Boolean(city || country);

  useEffect(() => {
    if (loading || !canFetch) {
      setData(null);
      setError(null);
      setWeatherLoading(false);
      return;
    }

    let cancelled = false;
    setWeatherLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (country) params.set('country', country);

    fetch(`/api/weather?${params.toString()}`)
      .then(async (res) => {
        const body = (await res.json()) as WeatherResponse & { error?: string };
        if (!res.ok) {
          throw new Error(body.error || 'Weather request failed');
        }
        if (cancelled) return;
        setData(body);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, canFetch, city, state, country]);

  if (loading) {
    return (
      <Card className={compactCardClass('py-3')}>
        <CardContent className="p-3 flex flex-row md:flex-col items-center justify-center md:justify-start gap-3 md:gap-2">
          <CloudSun className="h-8 w-8 shrink-0 text-muted-foreground animate-pulse" />
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (!tournament) {
    return null;
  }

  if (!canFetch) {
    return (
      <Card className={compactCardClass('py-3')}>
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground text-center md:text-center leading-snug">
            Add city and country on the tournament for weather.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (weatherLoading) {
    return (
      <Card className={compactCardClass('py-3')}>
        <CardContent className="p-3 flex flex-row md:flex-col items-center justify-center md:justify-start gap-3 md:gap-2">
          <CloudSun className="h-8 w-8 shrink-0 text-muted-foreground animate-pulse" />
          <p className="text-[11px] text-muted-foreground">Forecast…</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={compactCardClass('py-3')}>
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground text-center leading-snug">
            {error ?? 'Forecast unavailable.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const precip =
    data.precipitationChancePercent != null ? `${data.precipitationChancePercent}%` : '—';

  const windTitle = data.wind
    ? [
        `${data.wind.speedMph} mph`,
        data.wind.gustMph != null ? `gusts ${data.wind.gustMph} mph` : null,
        data.wind.direction ?? null,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const windSub =
    data.wind && (data.wind.gustMph != null || data.wind.direction)
      ? [
          data.wind.gustMph != null ? `G${data.wind.gustMph}` : '',
          data.wind.direction ?? '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  const sourceLink = (
    <a
      href="https://open-meteo.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-2 hover:underline"
    >
      Weather source: Open-Meteo
    </a>
  );

  return (
    <Card className={compactCardClass('overflow-hidden shadow-sm')}>
      <CardContent className="p-0">
        {/* Mobile: full width, wider-than-tall band below tournament status */}
        <div className="md:hidden p-3 flex flex-col gap-1.5">
          <div className="flex flex-row items-center gap-3 min-h-0">
            <WeatherConditionIcon code={data.weatherCode} className="h-9 w-9 shrink-0 text-header-link" />
            <div className="flex flex-col items-center gap-0.5 shrink-0 w-[4.25rem]">
              {data.highTempF != null ? (
                <>
                  <div
                    className="flex justify-center items-baseline gap-0.5"
                    aria-label={`High temperature ${data.highTempF} degrees Fahrenheit`}
                  >
                    <span className="text-2xl font-bold tabular-nums leading-none text-foreground">
                      {data.highTempF}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground leading-none">°F</span>
                  </div>
                  {data.lowTempF != null ? (
                    <p
                      className="text-[10px] text-muted-foreground tabular-nums leading-none"
                      aria-label={`Low temperature ${data.lowTempF} degrees Fahrenheit`}
                    >
                      {data.lowTempF}°F
                    </p>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </div>
            <div className="flex-1 min-w-0 border-l border-border/50 pl-3">
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground truncate">{data.weekday}</p>
                <p className="text-[10px] text-muted-foreground leading-tight shrink-0 tabular-nums text-right">
                  {data.dateLine}
                </p>
              </div>
              <p className="text-[11px] font-medium text-foreground/90 leading-snug line-clamp-2 mt-1">
                {data.forecast}
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-4 gap-x-1 gap-y-0 text-[9px] tabular-nums text-foreground/90 border-t border-border/50 pt-1.5"
            role="list"
          >
            <div className="flex flex-col items-center justify-center gap-0.5 text-center min-w-0" role="listitem" title="Precipitation chance">
              <Droplets className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Precipitation </span>
              <span className="truncate max-w-full">{precip}</span>
            </div>

            {data.wind ? (
              <div
                className="flex flex-col items-center justify-center gap-0.5 text-center min-w-0 leading-tight"
                role="listitem"
                title={windTitle}
              >
                <Wind className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate max-w-full">
                  <span className="sr-only">Wind </span>
                  {data.wind.speedMph} mph
                </span>
                {windSub ? (
                  <span className="text-[8px] text-muted-foreground truncate max-w-full">{windSub}</span>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground" role="listitem">
                <Wind className="h-3 w-3" aria-hidden />
                —
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-0.5 text-center min-w-0" role="listitem" title="Sunrise">
              <Sunrise className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Sunrise </span>
              <span className="leading-tight">{data.sunrise}</span>
            </div>

            <div className="flex flex-col items-center justify-center gap-0.5 text-center min-w-0" role="listitem" title="Sunset">
              <Sunset className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Sunset </span>
              <span className="leading-tight">{data.sunset}</span>
            </div>
          </div>

          <p className="text-[9px] text-center text-muted-foreground/80 leading-tight border-t border-border/40 pt-1">
            {sourceLink}
          </p>
        </div>

        {/* md+: narrow vertical column beside tournament */}
        <div className="hidden md:flex md:flex-col p-3 items-stretch gap-1.5">
          <header className="flex items-baseline justify-between gap-2 w-full min-w-0">
            <p className="text-[15px] font-semibold leading-tight tracking-tight text-foreground truncate min-w-0">
              {data.weekday}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight shrink-0 tabular-nums text-right">
              {data.dateLine}
            </p>
          </header>

          <div className="flex justify-center py-0" aria-hidden>
            <WeatherConditionIcon code={data.weatherCode} className="h-10 w-10 text-header-link" />
          </div>

          <div className="flex flex-col items-center gap-0.5 w-full">
            {data.highTempF != null ? (
              <>
                <div
                  className="flex justify-center items-baseline gap-0.5"
                  aria-label={`High temperature ${data.highTempF} degrees Fahrenheit`}
                >
                  <span className="text-[1.65rem] font-bold tabular-nums leading-none tracking-tight text-foreground">
                    {data.highTempF}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground leading-none">°F</span>
                </div>
                {data.lowTempF != null ? (
                  <p
                    className="text-[11px] text-muted-foreground tabular-nums leading-none text-center w-full"
                    aria-label={`Low temperature ${data.lowTempF} degrees Fahrenheit`}
                  >
                    {data.lowTempF}°F
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>

          <p className="text-center text-[11px] font-medium text-foreground/90 leading-snug line-clamp-2 px-0.5">
            {data.forecast}
          </p>

          <div
            className="grid grid-cols-2 gap-x-1 gap-y-1 w-full border-t border-border/50 pt-1.5 mt-0"
            role="list"
          >
            <div
              className="flex items-center justify-center gap-1 text-[10px] tabular-nums text-foreground/90"
              role="listitem"
              title="Precipitation chance"
            >
              <Droplets className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Precipitation chance </span>
              {precip}
            </div>

            {data.wind ? (
              <div
                className="flex flex-col items-center justify-center gap-0 text-[10px] tabular-nums text-foreground/90 text-center leading-tight"
                role="listitem"
                title={windTitle}
              >
                <div className="flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="sr-only">Wind </span>
                    {data.wind.speedMph} mph
                  </span>
                </div>
                {(data.wind.gustMph != null || data.wind.direction) && (
                  <span className="text-[9px] text-muted-foreground">
                    {data.wind.gustMph != null ? `G${data.wind.gustMph}` : ''}
                    {data.wind.gustMph != null && data.wind.direction ? ' · ' : ''}
                    {data.wind.direction ?? ''}
                  </span>
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"
                role="listitem"
              >
                <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden />
                —
              </div>
            )}

            <div
              className="flex items-center justify-center gap-1 text-[10px] tabular-nums text-foreground/90"
              role="listitem"
              title="Sunrise"
            >
              <Sunrise className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Sunrise </span>
              {data.sunrise}
            </div>

            <div
              className="flex items-center justify-center gap-1 text-[10px] tabular-nums text-foreground/90"
              role="listitem"
              title="Sunset"
            >
              <Sunset className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Sunset </span>
              {data.sunset}
            </div>
          </div>

          <p className="text-[9px] text-center text-muted-foreground/80 leading-tight pt-1 border-t border-border/40">
            {sourceLink}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
