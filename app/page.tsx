'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type Entry } from '@/utils/scoring';
import { QuickLeaderboard } from '@/components/quick-leaderboard';
import { TournamentStatus } from '@/components/tournament-status';
import { Button } from '@/components/ui/button';
import { Goal as GolfBall, Trophy } from 'lucide-react';
import Link from 'next/link';
import { LiveLeaderboard } from '@/components/live-leaderboard';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    async function fetchEntries() {
      const { data } = await supabase
        .from('entries')
        .select('entry_name, calculated_score, display_score')
        .order('calculated_score', { ascending: true });
      
      setEntries(data || []);
    }
    fetchEntries();
  }, []);

  return (
    <div className="space-y-8">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Majors SZN Pools</h1>
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

      <div className="flex justify-center">
        <TournamentStatus />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <LiveLeaderboard />
        <QuickLeaderboard />
      </div>

    </div>
  );
}