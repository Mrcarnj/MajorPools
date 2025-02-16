import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrophyIcon } from 'lucide-react';

export default function LiveLeaderboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          LIVE Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Live leaderboard data will be displayed here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
