'use client';

import { calculateDisplayScore, calculateRankings, type Entry } from '@/utils/scoring';
import { Archivo } from 'next/font/google';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrophyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculatePrizePool } from '@/utils/scoring';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500'],
  style: ['italic'],
  variable: '--font-archivo',
  display: 'swap',
});

export function QuickLeaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [tournamentStarted, setTournamentStarted] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // First get active tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, status')
        .eq('is_active', true)
        .single();

      if (!tournament) {
        setEntries([]);
        return;
      }

      setTournamentStarted(tournament.status !== 'Not Started');

      // Get entries for active tournament
      const { data: entriesData } = await supabase
        .from('entries')
        .select(`
          entry_name,
          calculated_score,
          tier1_golfer1, tier1_golfer2,
          tier2_golfer1, tier2_golfer2,
          tier3_golfer1, tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1
        `)
        .eq('tournament_id', tournament.id)
        .order('calculated_score', { ascending: true });

      // Get current scores for all golfers
      const { data: scoresData } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name, total, position');

      if (entriesData && scoresData) {
        const scoreMap = new Map(scoresData.map(score => [score.player_id, score]));

        const processedEntries = entriesData.map(entry => {
          const golferIds = [
            entry.tier1_golfer1, entry.tier1_golfer2,
            entry.tier2_golfer1, entry.tier2_golfer2,
            entry.tier3_golfer1, entry.tier3_golfer2,
            entry.tier4_golfer1,
            entry.tier5_golfer1
          ];

          const golferScores = golferIds.map(id => ({
            ...scoreMap.get(id) || { total: 'E', position: '-' },
            player_id: id
          }));

          // Sort golfers by score and take top 5
          const topFiveGolfers = golferScores
            .sort((a, b) => {
              const scoreA = a.total === 'E' ? 0 : Number(a.total.replace('+', ''));
              const scoreB = b.total === 'E' ? 0 : Number(b.total.replace('+', ''));
              return scoreA - scoreB;
            })
            .slice(0, 5);

          return {
            entry_name: entry.entry_name,
            calculated_score: entry.calculated_score,
            display_score: calculateDisplayScore(golferScores),
            topFiveGolfers
          };
        });

        setEntries(processedEntries);
      }
    }

    fetchData();
  }, []);

  const rankings = calculateRankings(entries);
  const { totalPot, payouts } = calculatePrizePool(entries);
  const top10Entries = entries.slice(0, 10);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrophyIcon className="h-5 w-5" />
            Top Teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No teams have been created for the current tournament.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Top Teams 
          {tournamentStarted && (
            <span className="text-sm font-normal ml-2">(Pot: ${totalPot})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {top10Entries.map((entry, index) => (
            <div key={entry.entry_name} className={index % 2 === 1 ? 'bg-muted/100 dark:bg-muted/50' : ''}>
              <div 
                onClick={() => {
                  setExpandedEntries(prev => {
                    const next = new Set(prev);
                    if (next.has(entry.entry_name)) {
                      next.delete(entry.entry_name);
                    } else {
                      next.add(entry.entry_name);
                    }
                    return next;
                  });
                }}
                className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={`${archivo.className} text-lg text-foreground dark:text-muted-foreground w-12 text-right`}>
                    {rankings[index] || '\u00A0'}
                  </span>
                  {tournamentStarted && payouts.get(entry.entry_name) && (
                    <span className="text-green-600 w-16 text-right">
                      ${payouts.get(entry.entry_name)}
                    </span>
                  )}
                  <span className="font-medium flex-1 text-center">{entry.entry_name}</span>
                  <span className={`${archivo.className} w-12 text-right ${
                    typeof entry.display_score === 'number' && entry.display_score < 0 
                      ? 'text-red-600' 
                      : 'text-muted-foreground'
                  }`}>
                    {entry.display_score}
                  </span>
                </div>
              </div>
              
              {expandedEntries.has(entry.entry_name) && (
                <div className="pl-12 pr-4 py-2">
                  <div className="flex flex-wrap gap-x-4 text-sm">
                    {entry.topFiveGolfers.map(golfer => (
                      <div key={golfer.player_id} className="flex items-center gap-1">
                        <span>{golfer.first_name} {golfer.last_name}</span>
                        <span className={`${archivo.className} ${
                          golfer.total.startsWith('-') ? 'text-red-600' : ''
                        }`}>
                          ({['CUT', 'WD', 'DQ'].includes(golfer.position) ? golfer.position : golfer.total})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No teams have been created yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}