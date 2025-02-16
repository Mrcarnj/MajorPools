'use client';

import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Leaderboard() {
  const { data: activeTournament, isLoading: tournamentLoading } = trpc.entries.getActiveTournament.useQuery();
  const { data: entries, isLoading: entriesLoading } = trpc.entries.getEntriesByTournament.useQuery(
    { tournament_id: activeTournament?.id ?? '' },
    { enabled: !!activeTournament }
  );

  if (tournamentLoading || entriesLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold text-center">
        {activeTournament?.name} {activeTournament?.start_date ? new Date(activeTournament.start_date).getFullYear() : ''} Leaderboard
      </h1>

      <div className="grid gap-4">
        {entries?.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold text-primary">
                {entry.entry_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Tier 1</h3>
                  <div className="space-y-1">
                    <p className="text-sm">{entry.tier1_golfer1}</p>
                    <p className="text-sm">{entry.tier1_golfer2}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Tier 2</h3>
                  <div className="space-y-1">
                    <p className="text-sm">{entry.tier2_golfer1}</p>
                    <p className="text-sm">{entry.tier2_golfer2}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Tier 3</h3>
                  <div className="space-y-1">
                    <p className="text-sm">{entry.tier3_golfer1}</p>
                    <p className="text-sm">{entry.tier3_golfer2}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Tier 4</h3>
                  <div className="space-y-1">
                    <p className="text-sm">{entry.tier4_golfer1}</p>
                    <p className="text-sm">{entry.tier4_golfer2}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Tier 5</h3>
                  <div className="space-y-1">
                    <p className="text-sm">{entry.tier5_golfer1}</p>
                    <p className="text-sm">{entry.tier5_golfer2}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <Skeleton className="h-10 w-96 mx-auto" />
      <div className="grid gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}