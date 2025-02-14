'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlagIcon } from 'lucide-react';

export function TournamentStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlagIcon className="h-5 w-5" />
          Tournament Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            No active tournament.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}