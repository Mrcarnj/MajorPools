'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrophyIcon } from 'lucide-react';

export function QuickLeaderboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Top Teams
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            No teams have been created yet.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}