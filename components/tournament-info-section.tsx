'use client';

import { useActiveOrNextTournament } from '@/hooks/use-active-or-next-tournament';
import { TournamentStatus } from '@/components/tournament-status';
import { TournamentWeather } from '@/components/tournament-weather';

export function TournamentInfoSection() {
  const { tournament, loading } = useActiveOrNextTournament();

  return (
    <div className="flex flex-col md:flex-row gap-4 justify-center items-stretch max-w-5xl mx-auto w-full">
      {/* Mobile: status first (full width), weather second (full width, horizontal strip) */}
      <div className="w-full flex justify-center md:justify-center md:w-auto md:shrink-0 self-stretch order-1">
        <TournamentStatus tournament={tournament} loading={loading} />
      </div>
      <div className="w-full md:w-[12.5rem] md:shrink-0 lg:w-[13rem] self-stretch order-2">
        <TournamentWeather tournament={tournament} loading={loading} />
      </div>
    </div>
  );
}
