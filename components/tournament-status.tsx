'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlagIcon, CalendarIcon, TrophyIcon, LandPlot } from 'lucide-react';
import { GolfIcon } from '@/components/icons/golf-icon';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';

export function TournamentStatus() {
  const { data: activeTournament, isLoading } = trpc.entries.getActiveTournament.useQuery();

  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <FlagIcon className="h-5 w-5" />
            Loading tournament data...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <FlagIcon className="h-5 w-5 text-primary" />
          <div className="font-semibold flex items-center gap-2">
            {activeTournament?.name}
            {activeTournament?.status && (
              <>
                <span className="text-muted-foreground/40 px-2">•</span>
                <span className="text-muted-foreground">
                  {activeTournament.status}
                  {activeTournament.current_round && ` (Round ${activeTournament.current_round})`}
                </span>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {activeTournament ? (
        <CardContent className="pt-0">
          <div className="grid gap-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                {format(new Date(activeTournament.start_date), 'MMM d')} - {format(new Date(activeTournament.end_date), 'MMM d, yyyy')}
              </div>
              {activeTournament.purse && (
                <div className="flex items-center gap-2 text-primary">
                  <TrophyIcon className="h-4 w-4" />
                  <span className="font-medium">${activeTournament.purse.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <LandPlot className="h-4 w-4 text-muted-foreground" />
              <span>{activeTournament.course_name}</span>
              {activeTournament.par_total && (
                <span className="ml-auto text-sm font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
                  Par {activeTournament.par_total}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      ) : (
        <CardContent>
          <div className="text-muted-foreground text-sm">
            No active tournament.
          </div>
        </CardContent>
      )}
    </Card>
  );
}