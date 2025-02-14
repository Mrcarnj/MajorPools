import { QuickLeaderboard } from '@/components/quick-leaderboard';
import { TournamentStatus } from '@/components/tournament-status';
import { Button } from '@/components/ui/button';
import { Goal as GolfBall, Trophy } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">PGA Tour Fantasy Golf</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Create your dream team of professional golfers and compete against other players
          in real-time during PGA Tour tournaments.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/create-team">
              <GolfBall className="mr-2 h-5 w-5" />
              Create Team
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/leaderboard">
              <Trophy className="mr-2 h-5 w-5" />
              View Leaderboard
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <TournamentStatus />
        <QuickLeaderboard />
      </div>
    </div>
  );
}