'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type Entry } from '@/utils/scoring';
import { QuickLeaderboard } from '@/components/quick-leaderboard';
import { TournamentInfoSection } from '@/components/tournament-info-section';
import { WhereToWatch } from '@/components/where-to-watch';
import { Button } from '@/components/ui/button';
import { Goal as GolfBall, Trophy } from 'lucide-react';
import Link from 'next/link';
import { LiveLeaderboard } from '@/components/live-leaderboard';
import { TbGolf } from "react-icons/tb";
import { DonationDisplay } from '@/components/donation-display';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showCreateTeam, setShowCreateTeam] = useState(true);

  useEffect(() => {
    async function fetchEntries() {
      const { data } = await supabase
        .from('entries')
        .select('entry_name, calculated_score, display_score')
        .order('calculated_score', { ascending: true });

      setEntries((data || []).map(entry => ({
        entry_name: entry.entry_name as string,
        calculated_score: entry.calculated_score as number,
        display_score: entry.display_score as number,
        topFiveGolfers: []  // Add empty array for home page since we don't need golfer details here
      })));
    }

    async function checkTournamentStatus() {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('status')
        .eq('is_active', true)
        .single();

      setShowCreateTeam(!tournament || (tournament.status !== 'In Progress' && tournament.status !== 'Complete'));
    }

    fetchEntries();
    checkTournamentStatus();
  }, []);

  return (
    <div className="space-y-8 px-2 md:px-6">
      {/* Hero - styled to match tournament info card */}
      <section className="relative rounded-2xl overflow-hidden bg-card/55 border border-border/70 text-foreground py-10 px-6 md:py-12 md:px-10 text-center shadow-lg backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-20%,hsl(var(--header-link)/0.1),transparent)] pointer-events-none" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_85%_115%,hsl(var(--azalea-accent)/0.1),transparent)] pointer-events-none" aria-hidden />
        <div className="relative space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-header-link/95">Majors SZN Pools</h1>
          <p className="text-sm md:text-base text-foreground/85 max-w-2xl mx-auto">
            Create your dream team of professional golfers and compete in real-time during golf&apos;s major tournaments.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center pt-2">
            {showCreateTeam && (
              <Button asChild size="lg" className="bg-header-link hover:bg-header-link/90 text-hero-bg border-0">
                <Link href="/create-team">
                  <GolfBall className="mr-2 h-5 w-5 text-hero-bg" />
                  Create Team
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="secondary" className="bg-card/70 text-foreground hover:bg-card/90 border border-header-link/70">
              <Link href="/leaderboard">
                <Trophy className="mr-2 h-5 w-5" />
                View Leaderboard
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Tournament info + weather */}
      <TournamentInfoSection />
      {/* How to Watch - horizontal, under tournament */}
      <div className="flex justify-center max-w-4xl mx-auto">
        <WhereToWatch />
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 md:gap-8 md:grid-cols-2">
        <div className="w-full max-w-[350px] md:max-w-none mx-auto">
          <QuickLeaderboard />
        </div>
        <div className="w-full max-w-[350px] md:max-w-none mx-auto">
          <LiveLeaderboard />
        </div>
      </div>

      {/* Donation Display 
      <div className="mt-8 max-w-lg mx-auto">
        <DonationDisplay />
      </div>*/}
    </div>
  );
}