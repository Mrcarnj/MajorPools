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
  display_score: number;
};

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
          tier4_golfer2,
          tier5_golfer1,
          tier5_golfer2
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
          entry.tier4_golfer1, entry.tier4_golfer2,
          entry.tier5_golfer1, entry.tier5_golfer2,
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

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Tournament Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {entries.map((entry) => (
              <div key={entry.entry_name} className="space-y-2">
                <h3 className="font-semibold text-lg px-4">
                  {entry.entry_name} 
                  <span className="ml-4 text-muted-foreground">
                    Score: {entry.calculated_score?.toFixed(10)}
                    <span className="ml-2">({entry.display_score})</span>
                  </span>
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Name</TableHead>
                        <TableHead className="text-right w-[70px]">Total</TableHead>
                        <TableHead className="text-right w-[50px]">Thru</TableHead>
                        <TableHead className="w-[160px]">Name</TableHead>
                        <TableHead className="text-right w-[70px]">Total</TableHead>
                        <TableHead className="text-right w-[50px]">Thru</TableHead>
                        <TableHead className="w-[160px]">Name</TableHead>
                        <TableHead className="text-right w-[70px]">Total</TableHead>
                        <TableHead className="text-right w-[50px]">Thru</TableHead>
                        <TableHead className="w-[160px]">Name</TableHead>
                        <TableHead className="text-right w-[70px]">Total</TableHead>
                        <TableHead className="text-right w-[50px]">Thru</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chunk(entry.golfers, 4).map((rowGolfers, rowIndex) => (
                        <TableRow key={`${entry.entry_name}-${rowIndex}`} className="h-[40px]">
                          {rowGolfers.map((golfer, index) => (
                            <>
                              <TableCell className="py-2 w-[160px]">
                                {golfer.first_name} {golfer.last_name}
                              </TableCell>
                              <TableCell className="text-right font-bold py-2 w-[70px]">
                                {golfer.total}
                              </TableCell>
                              <TableCell className="text-right py-2 w-[50px]">
                                {golfer.thru}
                              </TableCell>
                            </>
                          ))}
                          {[...Array(4 - rowGolfers.length)].map((_, i) => (
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