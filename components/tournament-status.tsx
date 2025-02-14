'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlagIcon, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export function TournamentStatus() {
  const syncMutation = trpc.pga.syncCurrentTournament.useMutation();
  const { data: activeTournament, isLoading, refetch } = trpc.entries.getActiveTournament.useQuery();

  const handleSync = async () => {
    await syncMutation.mutateAsync();
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlagIcon className="h-5 w-5" />
              Loading tournament data...
            </div>
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlagIcon className="h-5 w-5" />
            {activeTournament?.name || 'Tournament Status'}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
        </CardTitle>
      </CardHeader>
      {activeTournament ? (
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Dates:</span>{' '}
              {format(new Date(activeTournament.start_date), 'MMM d')} - {format(new Date(activeTournament.end_date), 'MMM d, yyyy')}
            </p>
            {activeTournament.course_name && (
              <p className="text-sm">
                <span className="font-medium">Course:</span>{' '}
                {activeTournament.course_name}
              </p>
            )}
          </div>
        </CardContent>
      ) : (
        <CardContent>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              No active tournament. Click sync to check for current tournament.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}