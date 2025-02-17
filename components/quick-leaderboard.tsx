'use client';

import { calculateDisplayScore, calculateRankings, type Entry } from '@/utils/scoring';
import { Archivo } from 'next/font/google';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrophyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500'],
  style: ['italic'],
  variable: '--font-archivo',
  display: 'swap',
});

export function QuickLeaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    async function fetchEntries() {
      // First get all entries
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
        .order('calculated_score', { ascending: true });

      // Get current scores for all golfers
      const { data: scoresData } = await supabase
        .from('golfer_scores')
        .select('player_id, total, position');

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

          return {
            entry_name: entry.entry_name,
            calculated_score: entry.calculated_score,
            display_score: calculateDisplayScore(golferScores)
          };
        });

        setEntries(processedEntries);
      }
    }

    fetchEntries();
  }, []);

  const rankings = calculateRankings(entries);
  const top10Entries = entries.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Top Teams
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {top10Entries.map((entry, index) => (
            <div key={entry.entry_name} className="flex items-center justify-between even:bg-muted/100 even:dark:bg-muted/50 p-2">
              <div className="flex items-center gap-2 w-full">
                <span className={`${archivo.className} text-lg text-muted-foreground w-12 text-right`}>
                  {rankings[index] || '\u00A0'}
                </span>
                <span className="font-medium flex-1 text-center">{entry.entry_name}</span>
                <span className={`${archivo.className} w-12 ${
                  typeof entry.display_score === 'number' && entry.display_score < 0 
                    ? 'text-red-600' 
                    : 'text-muted-foreground'
                }`}>
                  {entry.display_score}
                </span>
              </div>
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