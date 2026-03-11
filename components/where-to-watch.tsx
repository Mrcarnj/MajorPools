'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tv, Monitor, ExternalLink, ChevronDown } from 'lucide-react';
import { getWatchConfig, type WatchConfig, type WatchItem } from '@/lib/watch-config';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

/**
 * Converts "11:30 AM" in tournament TZ to user's local time (same calendar day in venue).
 */
function toLocalTime(timeStr: string, tournamentTimezone: string): string | null {
  const match = timeStr.match(/^\s*(\d{1,2}):(\d{2})\s*(am|pm)\s*$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const pm = match[3].toLowerCase() === 'pm';
  if (h === 12) h = pm ? 12 : 0;
  else if (pm) h += 12;
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tournamentTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === 'year')?.value ?? '0', 10);
  const mo = parseInt(parts.find((p) => p.type === 'month')?.value ?? '1', 10) - 1;
  const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '1', 10);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tournamentTimezone, hour: 'numeric', minute: '2-digit', hour12: true });
  const desired = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    for (let utcMin = 0; utcMin < 60; utcMin += 15) {
      const d = new Date(Date.UTC(y, mo, day, utcHour, utcMin));
      if (fmt.format(d) === desired) {
        return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }
  }
  return null;
}

function WatchItemPill({ item, tournamentTZ, timezoneLabel }: { item: WatchItem; tournamentTZ: string; timezoneLabel: string }) {
  const showLocal = item.time && item.time !== 'Check local listings' && item.time !== 'TBD';
  const localTime = showLocal && item.time ? toLocalTime(item.time, tournamentTZ) : null;
  const isStreaming = item.label.includes('LIVE') || item.label.includes('Watch');

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 dark:bg-muted/40 border border-border/60 shrink-0">
      {isStreaming ? (
        <Tv className="h-4 w-4 shrink-0 text-accent" aria-hidden />
      ) : (
        <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-foreground text-sm whitespace-nowrap">{item.label}</span>
        {item.description && (
          <span className="text-muted-foreground text-xs truncate max-w-[140px]">{item.description}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        {item.day && <span>{item.day}</span>}
        {item.time && (
          <span className="whitespace-nowrap">
            {item.time} {timezoneLabel}
            {localTime && <span className="text-foreground/80 ml-0.5">({localTime})</span>}
          </span>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-flex"
            aria-label={`Open ${item.label}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function WhereToWatch({ tournamentName, className }: { tournamentName?: string | null; className?: string }) {
  const [name, setName] = useState<string | null>(tournamentName ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const config: WatchConfig = getWatchConfig(name);

  useEffect(() => {
    if (tournamentName !== undefined) {
      setName(tournamentName);
      return;
    }
    async function fetchActiveTournament() {
      try {
        const { data } = await supabase
          .from('tournaments')
          .select('name')
          .or('is_active.eq.true,start_date.gte.' + new Date().toISOString().slice(0, 10))
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        setName(data?.name ?? null);
      } catch {
        setName(null);
      }
    }
    fetchActiveTournament();
  }, [tournamentName]);

  const hasStructured = config.tv || config.streaming;

  return (
    <Card className={cn('overflow-hidden w-full max-w-xl mx-auto border border-border/80 shadow-sm bg-card', className)}>
      <CardHeader
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse How to Watch' : 'Expand How to Watch'}
        className={cn(
          'pb-4 pt-5 px-5 md:px-6 cursor-pointer select-none hover:bg-muted/30 transition-colors relative',
          isOpen && 'border-b border-border/60'
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        <CardTitle className="flex items-center justify-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Tv className="h-4 w-4" aria-hidden />
            </span>
            How to Watch
          </span>
          <ChevronDown
            className={cn('absolute right-5 md:right-6 top-1/2 -translate-y-1/2 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')}
            aria-hidden
          />
        </CardTitle>
      </CardHeader>
      {isOpen && (
      <CardContent className="p-5 md:p-6 space-y-0">
        {hasStructured ? (
          <div className="flex flex-col gap-6 md:gap-8">
            {config.tv && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tv className="h-4 w-4 text-accent shrink-0" aria-hidden />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-header-link">
                    On TV
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  {config.tv.intro}
                </p>
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  {/* Desktop: table */}
                  <div className="hidden sm:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/80">
                          <th className="text-left font-medium text-foreground px-4 py-3">Day</th>
                          <th className="text-left font-medium text-foreground px-4 py-3">Time</th>
                          <th className="text-left font-medium text-foreground px-4 py-3">Channel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.tv.slots.map((slot, i) => (
                          <tr
                            key={i}
                            className={cn(
                              'border-b border-border/60 last:border-0',
                              i % 2 === 1 && 'bg-muted/20'
                            )}
                          >
                            <td className="px-4 py-2.5 text-foreground font-medium">{slot.day}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{slot.timeRange} {config.timezoneLabel}</td>
                            <td className="px-4 py-2.5 text-foreground">{slot.channel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile: stacked rows */}
                  <div className="sm:hidden divide-y divide-border/60">
                    {config.tv.slots.map((slot, i) => (
                      <div key={i} className="px-4 py-3 flex justify-between items-center gap-3">
                        <span className="text-foreground font-medium text-sm">{slot.day}</span>
                        <span className="text-muted-foreground text-sm shrink-0">{slot.timeRange} {config.timezoneLabel} · {slot.channel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {config.streaming && (
              <section className="space-y-3 border-t border-border/60 pt-6 md:pt-8">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-accent shrink-0" aria-hidden />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-header-link">
                    Streaming
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  {config.streaming.intro}
                </p>
                <div className="flex flex-col gap-2">
                  {config.streaming.options.map((opt, i) => (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{opt.label}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{opt.description}</p>
                      </div>
                      {opt.url && (
                        <a
                          href={opt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/90 shrink-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Watch
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-row flex-wrap gap-2 md:gap-3">
            {config.items.map((item, i) => (
              <WatchItemPill
                key={`${item.label}-${i}`}
                item={item}
                tournamentTZ={config.timezone}
                timezoneLabel={config.timezoneLabel}
              />
            ))}
          </div>
        )}

        {config.note && (
          <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border/60">
            {config.note}
          </p>
        )}
      </CardContent>
      )}
    </Card>
  );
}
