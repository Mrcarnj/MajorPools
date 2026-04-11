'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlagIcon, CalendarIcon, TrophyIcon } from 'lucide-react';
import { format } from 'date-fns';
import { PiGolfDuotone } from 'react-icons/pi';
import type { ActiveOrNextTournament } from '@/hooks/use-active-or-next-tournament';

function activeStatusLine(tournament: ActiveOrNextTournament): string {
  if (tournament.status === 'Not Started') return 'Not Started';
  if (tournament.status === 'In Progress') return `Round ${tournament.current_round}`;
  if (tournament.status === 'Official') return 'Complete';
  return String(tournament.status ?? '—');
}

function dateRangeText(tournament: ActiveOrNextTournament): string {
  if (!tournament.start_date || !tournament.end_date) return '—';
  return `${format(new Date(tournament.start_date), 'MMM d')} - ${format(new Date(tournament.end_date), 'MMM d, yyyy')}`;
}

type Props = {
  tournament: ActiveOrNextTournament | null;
  loading: boolean;
};

export function TournamentStatus({ tournament, loading }: Props) {
  if (loading) {
    return (
      <Card className="bg-card/50 w-full md:w-max max-w-full border-border/70">
        <CardHeader className="pb-0 md:pb-0">
          <CardTitle className="flex items-center gap-2 text-muted-foreground md:hidden">
            <FlagIcon className="h-5 w-5" />
            Loading tournament data...
          </CardTitle>
          <div className="hidden md:flex items-center gap-2.5 py-2 px-5">
            <FlagIcon className="h-5 w-5 text-muted-foreground animate-pulse shrink-0" />
            <div className="h-5 w-44 rounded bg-muted animate-pulse" />
          </div>
        </CardHeader>
        <CardContent className="hidden md:block px-5 pb-4 pt-2">
          <div className="space-y-2.5 border-t border-border/60 pt-3">
            <div className="h-9 rounded-md bg-muted/70 animate-pulse" />
            <div className="h-9 rounded-md bg-muted/70 animate-pulse" />
            <div className="h-9 rounded-md bg-muted/70 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tournament) {
    return (
      <Card className="bg-card/50 w-full md:w-max max-w-full border-border/70">
        <CardHeader>
          <CardTitle>Tournament Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No upcoming tournaments scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  const dates = dateRangeText(tournament);
  const status = activeStatusLine(tournament);
  const purse =
    tournament.is_active && tournament.purse != null
      ? `$${Number(tournament.purse).toLocaleString()}`
      : null;

  return (
    <div className="space-y-2 h-full flex flex-col w-full md:w-max max-w-full">
      {!tournament.is_active && (
        <h2 className="text-base md:text-lg font-semibold text-center md:text-left text-header-link">
          Next Major:
        </h2>
      )}
      <Card className="overflow-hidden bg-card/50 h-full flex flex-col w-full md:w-max max-w-full border-border/70 shadow-sm">
        {/* ——— Mobile (unchanged) ——— */}
        <div className="md:hidden">
          <CardHeader className="pb-2 px-2">
            <CardTitle className="flex items-center gap-2">
              <FlagIcon className="h-4 w-4 text-primary" />
              <div className="font-semibold flex items-center gap-2 text-sm">
                {tournament.name}
                {tournament.is_active && (
                  <>
                    <span className="text-muted-foreground/40 px-1">•</span>
                    <span className="text-muted-foreground text-sm">{status}</span>
                  </>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-2 flex-1">
            <div className="grid gap-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <CalendarIcon className="h-3 w-3" />
                  {dates}
                </div>
                {purse != null && (
                  <div className="flex items-center gap-2 text-header-link">
                    <TrophyIcon className="h-3 w-3" />
                    <span className="font-medium text-xs tabular-nums">{purse}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <PiGolfDuotone className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs min-w-0 truncate">{tournament.course_name ?? '—'}</span>
                {tournament.par_total != null && (
                  <span className="ml-auto shrink-0 text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
                    Par {tournament.par_total}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </div>

        {/* ——— Desktop: vertical list (balanced spacing) ——— */}
        <div className="hidden md:flex md:flex-col md:flex-1 min-w-[16.75rem] max-w-md">
          <CardHeader className="px-5 pt-4 pb-3 border-b border-border/60 space-y-0">
            <div className="flex items-start gap-2.5">
              <FlagIcon className="h-6 w-6 text-header-link shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-lg font-semibold leading-snug tracking-tight text-foreground">
                  {tournament.name}
                </CardTitle>
                <p className="text-sm font-medium text-foreground leading-snug min-w-0">
                  {tournament.course_name ?? '—'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pt-0 pb-4 flex-1 flex flex-col">
            <ul className="flex flex-col divide-y divide-border/60" role="list">
              <li className="flex gap-3 px-5 py-2.5" role="listitem">
                <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Dates
                  </span>
                  <p className="text-sm font-medium text-foreground tabular-nums mt-0.5 leading-snug">
                    {dates}
                  </p>
                </div>
              </li>
              {purse != null && (
                <li className="flex gap-3 px-5 py-2.5 items-center" role="listitem">
                  <TrophyIcon className="h-4 w-4 text-header-link shrink-0" aria-hidden />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                      Purse
                    </span>
                    <p className="text-sm font-semibold text-header-link tabular-nums leading-snug text-right">
                      {purse}
                    </p>
                  </div>
                </li>
              )}
              <li className="flex gap-3 px-5 py-2.5 items-center" role="listitem">
                <PiGolfDuotone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground leading-snug min-w-0">
                    {tournament.is_active ? status : 'Upcoming championship'}
                  </p>
                  {tournament.par_total != null && (
                    <span className="shrink-0 text-xs font-semibold tabular-nums rounded-full border border-header-link/35 bg-header-link/15 px-2.5 py-0.5 text-header-link">
                      Par {tournament.par_total}
                    </span>
                  )}
                </div>
              </li>
            </ul>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
