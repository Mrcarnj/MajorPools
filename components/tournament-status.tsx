'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlagIcon, CalendarIcon, TrophyIcon } from 'lucide-react';
import { format } from 'date-fns';
import { PiGolfDuotone } from 'react-icons/pi';
import type { ActiveOrNextTournament } from '@/hooks/use-active-or-next-tournament';

type Props = {
  tournament: ActiveOrNextTournament | null;
  loading: boolean;
};

export function TournamentStatus({ tournament, loading }: Props) {
  if (loading) {
    return (
      <Card className="bg-card/50 w-full md:w-max max-w-full">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <FlagIcon className="h-5 w-5" />
            Loading tournament data...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!tournament) {
    return (
      <Card className="bg-card/50 w-full md:w-max max-w-full">
        <CardHeader>
          <CardTitle>Tournament Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No upcoming tournaments scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2 h-full flex flex-col w-full md:w-max max-w-full">
      {!tournament.is_active && (
        <h2 className="text-base md:text-lg font-semibold text-center md:text-left text-header-link">
          Next Major:
        </h2>
      )}
      <Card className="overflow-hidden bg-card/50 h-full flex flex-col w-full md:w-max max-w-full">
        <CardHeader className="pb-2 px-2 md:px-6">
          <CardTitle className="flex items-center gap-2">
            <FlagIcon className="h-4 md:h-5 w-4 md:w-5 text-primary" />
            <div className="font-semibold flex items-center gap-2 text-sm md:text-lg">
              {tournament.name}
              {tournament.is_active && (
                <>
                  <span className="text-muted-foreground/40 px-1 md:px-2">•</span>
                  <span className="text-muted-foreground text-sm md:text-base">
                    {tournament.status === 'Not Started'
                      ? 'Not Started'
                      : tournament.status === 'In Progress'
                        ? `Round ${tournament.current_round}`
                        : tournament.status === 'Official'
                          ? 'Complete'
                          : tournament.status}
                  </span>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-2 md:px-6 flex-1">
          <div className="grid gap-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2 text-muted-foreground text-xs md:text-base">
                <CalendarIcon className="h-3 md:h-4 w-3 md:w-4" />
                {tournament.start_date && tournament.end_date ? (
                  <>
                    {format(new Date(tournament.start_date), 'MMM d')} -{' '}
                    {format(new Date(tournament.end_date), 'MMM d, yyyy')}
                  </>
                ) : (
                  '—'
                )}
              </div>
              {tournament.is_active && tournament.purse != null && (
                <div className="flex items-center gap-2 text-header-link">
                  <TrophyIcon className="h-3 md:h-4 w-3 md:w-4" />
                  <span className="font-medium text-xs md:text-sm">
                    ${Number(tournament.purse).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <PiGolfDuotone className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
              <span className="text-xs md:text-sm">{tournament.course_name ?? '—'}</span>
              {tournament.par_total != null && (
                <span className="ml-auto text-xs md:text-sm font-semibold bg-primary/10 text-primary px-3 md:px-3 py-1 rounded-full">
                  Par {tournament.par_total}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
