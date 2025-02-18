'use client';

import { useEffect, useState, Fragment } from 'react';
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
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight } from "lucide-react";

type Tournament = {
  current_round: number;
};

type EntryGolfer = {
  player_id: string;
  first_name: string;
  last_name: string;
  total: string;
  current_round_score: string;
  thru: string;
  position: string;
  status: string;
  tee_time: string;
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

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasActiveTournament, setHasActiveTournament] = useState(false);
  const [tournament, setTournament] = useState<{ current_round?: number } | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      // First check if there's an active tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, status, current_round')
        .eq('is_active', true)
        .single();

      setTournament(tournament);

      setHasActiveTournament(!!tournament && ['In Progress', 'Complete'].includes(tournament.status));

      if (!tournament || !['In Progress', 'Complete'].includes(tournament.status)) {
        setEntries([]);
        setLoading(false);
        return;
      }

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
      const { data: scoresData, error: scoresError } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name, total, current_round_score, thru, position, status, tee_time');

      if (scoresError) {
        console.error('Error fetching scores:', scoresError);
        return;
      }

      // Create a map of player_id to their current score info
      const scoreMap = new Map(
        scoresData.map(score => [score.player_id, score])
      );
      // Transform entries data to include golfer details
      const entriesWithGolfers = entriesData?.map(entry => {
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
            current_round_score: score?.current_round_score || '-',
            thru: score?.thru === '-' && ['CUT', 'WD', 'DQ'].includes(score?.position || '') 
              ? score?.position 
              : score?.thru || '-',
            position: score?.position || '-',
            status: score?.status || '-',
            tee_time: score?.tee_time || '-'
          };
        });

        return {
          entry_name: entry.entry_name,
          calculated_score: entry.calculated_score,
          golfers: sortGolfers(golfers),
          display_score: calculateDisplayScore(golfers)
        };
      }) || [];

      setEntries(entriesWithGolfers);
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading entries...</div>;
  }

  // Calculate rankings for all entries first
  const rankings = calculateRankings(entries);

  // Create a map of entry name to ranking
  const rankingMap = new Map(
    entries.map((entry, index) => [entry.entry_name, rankings[index]])
  );

  // Then filter entries
  const filteredEntries = entries.filter(entry => 
    entry.entry_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (entryName: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryName)) {
        newSet.delete(entryName);
      } else {
        newSet.add(entryName);
      }
      return newSet;
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-8">   
      <div className="max-w-md mx-auto">
        <Input
          placeholder="Search entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {loading ? (
        <div className="text-center">Loading leaderboard...</div>
      ) : !hasActiveTournament ? (
        <div className="text-center text-muted-foreground">
          There is no leaderboard due to no majors being in progress.
        </div>
      ) : (
        <Card className="max-w-fit mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-['Post_Oldstyle'] italic flex items-center justify-center gap-2">
              Entry Leaderboard
              <TbGolf className="text-3xl" />
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Tap entry to expand
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {filteredEntries.map((entry, index) => (
                <div key={entry.entry_name} className="space-y-2">
                  <div 
                    className={`grid
                      grid-cols-[2rem_auto_4rem] md:grid-cols-[2rem_minmax(200px,auto)_auto_4rem] 
                      gap-6 items-center cursor-pointer hover:bg-muted/50 px-4 ${
                      index % 2 === 0 ? '' : 'dark:bg-zinc-800/90 bg-zinc-800/10'
                    }`}
                    onClick={() => toggleExpand(entry.entry_name)}
                  >
                    <div className={`${archivo.className} text-lg md:text-2xl text-foreground dark:text-muted-foreground text-left`}>
                      {rankingMap.get(entry.entry_name) || '\u00A0'}
                    </div>
                    <h3 className="font-semibold text-sm md:text-lg">
                      {entry.entry_name} 
                    </h3>
                    <div className="hidden md:flex gap-1 items-center justify-end text-md text-muted-foreground">
                      {entry.golfers
                        .slice(0, 5)
                        .sort((a, b) => parseInt(a.total.replace('+', '')) - parseInt(b.total.replace('+', '')))
                        .map(golfer => (
                          <span key={golfer.player_id} className={golfer.total.startsWith('-') ? 'text-red-600' : ''}>
                            {golfer.total}
                          </span>
                        ))}
                    </div>
                    <span className={`${archivo.className} text-lg md:text-2xl text-muted-foreground text-right ${
                      typeof entry.display_score === 'number' && entry.display_score < 0 
                        ? '!text-red-600' 
                        : ''
                    }`}>
                      {entry.display_score}
                    </span>
                  </div>
                  
                  {expandedEntries.has(entry.entry_name) && (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[8rem] md:min-w-[10rem]">Golfer</TableHead>
                            <TableHead className="text-left w-[3rem] md:min-w-[2rem] px-1 md:px-5">Total</TableHead>
                            <TableHead className="w-[2rem] md:min-w-[2rem] px-1 md:px-5 whitespace-nowrap">R{tournament?.current_round}</TableHead>
                            <TableHead className="w-[2rem] md:min-w-[2rem] px-1 md:px-5">Thru</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.golfers.map((golfer, absoluteIndex) => (
                            <TableRow key={golfer.player_id}>
                              <TableCell className={`px-1 md:px-2 ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}>
                                {golfer.first_name} {golfer.last_name}
                              </TableCell>
                              <TableCell 
                                className={`text-center py-1 md:py-2 px-1 md:px-2 w-[2rem] md:w-[20px] font-bold ${
                                  absoluteIndex > 4 
                                    ? 'bg-muted ' + (golfer.total.startsWith('-') ? '!text-red-600' : 'text-muted-foreground')
                                    : golfer.total.startsWith('-') 
                                      ? '!text-red-600' 
                                      : ''
                                }`}
                              >
                                {golfer.total}
                              </TableCell>
                              <TableCell className={`text-center py-1 md:py-2 px-1 md:px-2 w-[2rem] md:w-[20px] ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}>
                                {golfer.current_round_score === '-' ? '' : `${golfer.current_round_score}`}
                              </TableCell>
                              <TableCell className={`text-center py-1 md:py-2 px-1 md:px-2 w-[2rem] md:w-[40px] ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}>
                                {golfer.thru === '-' && !['CUT', 'WD', 'DQ'].includes(golfer.position) 
                                  ? golfer.tee_time 
                                  : golfer.thru}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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