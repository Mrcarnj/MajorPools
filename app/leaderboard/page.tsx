'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateDisplayScore } from '@/utils/scoring';
import { Archivo } from 'next/font/google';
import { MdLeaderboard } from "react-icons/md";
import { TbGolf } from "react-icons/tb";

type EntryGolfer = {
  player_id: string;
  first_name: string;
  last_name: string;
  total: string;
  thru: string;
  position: string;
  status: string;
};

type Entry = {
  entry_name: string;
  calculated_score: number;
  golfers: EntryGolfer[];
  display_score: number | "CUT";
};

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500'],
  style: ['italic'],
  variable: '--font-archivo',
  display: 'swap',
});

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEntries() {
      // First get all entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select(`
          entry_name,
          calculated_score,
          tier1_golfer1,
          tier1_golfer2,
          tier2_golfer1,
          tier2_golfer2,
          tier3_golfer1,
          tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1
        `)
        .order('calculated_score', { ascending: true });

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        return;
      }

      // Get current scores for all golfers
      const { data: scoresData, error: scoresError } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name, total, thru, position, status');

      if (scoresError) {
        console.error('Error fetching scores:', scoresError);
        return;
      }

      // Create a map of player_id to their current score info
      const scoreMap = new Map(
        scoresData.map(score => [score.player_id, score])
      );

      // Transform entries data to include golfer details
      const entriesWithGolfers = entriesData.map(entry => {
        const golferIds = [
          entry.tier1_golfer1, entry.tier1_golfer2,
          entry.tier2_golfer1, entry.tier2_golfer2,
          entry.tier3_golfer1, entry.tier3_golfer2,
          entry.tier4_golfer1,
          entry.tier5_golfer1
        ];

        const golfers = golferIds.map(id => {
          const score = scoreMap.get(id);
          
          return {
            player_id: id,
            first_name: score?.first_name || 'Unknown',
            last_name: score?.last_name || 'Golfer',
            total: score?.total || 'N/A',
            thru: score?.thru === '-' && ['CUT', 'WD', 'DQ'].includes(score?.position || '') 
              ? score?.position 
              : score?.thru || '-',
            position: score?.position || '-',
            status: score?.status || '-'
          };
        });

        return {
          entry_name: entry.entry_name,
          calculated_score: entry.calculated_score,
          golfers: sortGolfers(golfers),
          display_score: calculateDisplayScore(golfers)
        };
      });

      setEntries(entriesWithGolfers);
      setLoading(false);
    }

    fetchEntries();
  }, []);

  if (loading) {
    return <div>Loading entries...</div>;
  }

  const rankings = calculateRankings(entries);

  return (
    <div className={`container mx-auto py-8 ${archivo.variable}`}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-['Post_Oldstyle'] italic flex items-center justify-center gap-2">
            Entry Leaderboard
            <TbGolf className="text-3xl" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {entries.map((entry, index) => (
              <div key={entry.entry_name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {entry.entry_name} 
                    <span className="ml-4 text-muted-foreground">
                      <span className={`ml-2 ${archivo.className} text-lg ${
                        typeof entry.display_score === 'number' && entry.display_score < 0 
                          ? '!text-red-600' 
                          : ''
                      }`}>
                        ({entry.display_score})
                      </span>
                    </span>
                  </h3>
                  <div className={`${archivo.className} text-2xl text-muted-foreground pl-4 pr-2`}>
                    {rankings[index] || '\u00A0'}
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Name</TableHead>
                        <TableHead className="text-right w-[70px]">Total</TableHead>
                        <TableHead className="text-right w-[50px]">Thru</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chunk(entry.golfers, 5).map((rowGolfers, rowIndex) => (
                        <TableRow key={`${entry.entry_name}-${rowIndex}`} className="h-[40px]">
                          {rowGolfers.map((golfer, index) => {
                            const absoluteIndex = rowIndex * 5 + index;  // Calculate absolute position
                            return (
                              <>
                                <TableCell className={`py-2 w-[160px] ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}>
                                  {golfer.first_name} {golfer.last_name}
                                </TableCell>
                                <TableCell 
                                  className={`text-right font-bold py-2 w-[70px] ${
                                    absoluteIndex > 4 
                                      ? 'bg-muted ' + (golfer.total.startsWith('-') ? '!text-red-600' : 'text-muted-foreground')
                                      : golfer.total.startsWith('-') 
                                        ? '!text-red-600' 
                                        : ''
                                  }`}
                                >
                                  {golfer.total}
                                </TableCell>
                                <TableCell className={`text-right py-2 w-[50px] ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}>
                                  {golfer.thru}
                                </TableCell>
                              </>
                            );
                          })}
                          {[...Array(5 - rowGolfers.length)].map((_, i) => (
                            <>
                              <TableCell className="py-2"></TableCell>
                              <TableCell className="py-2"></TableCell>
                              <TableCell className="py-2"></TableCell>
                            </>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to split array into chunks
function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
    array.slice(index * size, (index + 1) * size)
  );
}

function sortGolfers(golfers: EntryGolfer[]): EntryGolfer[] {
  return [...golfers].sort((a, b) => {
    // If one is CUT and other isn't, CUT goes last
    if (a.position === 'CUT' && b.position !== 'CUT') return 1;
    if (b.position === 'CUT' && a.position !== 'CUT') return -1;
    
    // If both are CUT or both aren't CUT, sort by total score
    const scoreA = a.total === 'E' ? 0 : Number(a.total.replace('+', ''));
    const scoreB = b.total === 'E' ? 0 : Number(b.total.replace('+', ''));
    return scoreA - scoreB;
  });
}

function calculateRankings(entries: Entry[]): (string | null)[] {
  const rankings: (string | null)[] = new Array(entries.length).fill(null);
  let currentRank = 1;
  let sameScoreCount = 1;

  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      rankings[i] = currentRank.toString();
      continue;
    }

    if (entries[i].calculated_score === entries[i - 1].calculated_score) {
      if (sameScoreCount === 1) {
        // First tie encountered, update previous rank to show T
        rankings[i - 1] = `T${currentRank}`;
      }
      sameScoreCount++;
      // Don't show rank for subsequent ties
      rankings[i] = null;
    } else {
      currentRank += sameScoreCount;
      sameScoreCount = 1;
      rankings[i] = currentRank.toString();
    }
  }

  return rankings;
}