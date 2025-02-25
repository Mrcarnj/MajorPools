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

type GolferScore = {
  position: string;
  first_name: string;
  last_name: string;
  total: string;
  current_round_score: string;
  thru: string;
};

export function LiveLeaderboard() {
  const [scores, setScores] = useState<GolferScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentData, setTournamentData] = useState<{
    current_round: number;
    cut_score?: string;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      // First check if there's an active tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, current_round, cut_score')
        .eq('is_active', true)
        .single();

      if (!tournament) {
        setLoading(false);
        return;
      }

      setTournamentData(tournament);

      const { data, error } = await supabase
        .from('golfer_scores')
        .select('position, first_name, last_name, total, current_round_score, thru')
        .eq('tournament_id', tournament.id)
        .order('position', { ascending: true });

      if (error) {
        console.error('Error fetching scores:', error);
        return;
      }

      // Sort data by total score, handling string scores with +/- signs
      const sortedData = [...data].sort((a, b) => {
        // First handle non-numeric positions
        const nonNumericPositions = ['CUT', 'WD', 'DQ'];
        const aIsNonNumeric = nonNumericPositions.includes(a.position);
        const bIsNonNumeric = nonNumericPositions.includes(b.position);
        
        // If both are non-numeric, sort by their totals
        if (aIsNonNumeric && bIsNonNumeric) {
          const scoreA = parseInt(a.total.replace('+', '')) || 0;
          const scoreB = parseInt(b.total.replace('+', '')) || 0;
          return scoreA - scoreB;
        }
        
        // Put non-numeric positions at the bottom
        if (aIsNonNumeric) return 1;
        if (bIsNonNumeric) return -1;
        
        // For numeric positions, sort by total score
        const scoreA = parseInt(a.total.replace('+', '')) || 0;
        const scoreB = parseInt(b.total.replace('+', '')) || 0;
        return scoreA - scoreB;
      });

      setScores(sortedData);
      setLoading(false);
    }

    fetchData();

    // Subscribe to both tournament and golfer_scores changes
    const channel = supabase
      .channel('live_leaderboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'golfer_scores'
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments'  // Also listen for tournament changes (like current_round updates)
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div>Loading leaderboard...</div>;
  }

  if (!tournamentData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tournament Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No major tournament is currently active.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tournament Live Leaderboard</span>
          {tournamentData?.current_round === 2 && tournamentData.cut_score && (
            <span className="text-sm md:text-lg font-normal">
              Projected Cut: {tournamentData.cut_score}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1 md:p-6">
        <div className="rounded-md border">
          <div className="max-h-[408px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="text-center md:text-left w-[60px] md:w-[100px] px-1 md:px-4">Pos</TableHead>
                  <TableHead className="px-1 md:px-4">Player</TableHead>
                  <TableHead className="text-right w-[40px] md:w-[60px] px-1 md:px-4">Total</TableHead>
                  <TableHead className="text-right w-[40px] md:w-[60px] px-1 md:px-4">
                    <div className="flex justify-end items-center whitespace-nowrap">
                      R{tournamentData?.current_round || '-'}
                    </div>
                  </TableHead>
                  <TableHead className="text-right w-[30px] md:w-[40px] px-1 md:pr-4">Thru</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((score, index) => {
                  const showPosition = score.position === 'CUT' || 
                    index === 0 || 
                    score.position !== scores[index - 1].position;

                  return (
                    <TableRow 
                      key={`${score.last_name}-${score.first_name}`}
                      className={`
                        ${index % 2 === 0 ? 'dark:bg-zinc-800/90 bg-zinc-800/10' : ''}
                        ${score.position === 'CUT' ? 'text-muted-foreground bg-muted/90 dark:bg-muted/70' : ''}
                      `}
                    >
                      <TableCell className="text-center md:text-left py-2 px-1 md:px-4">
                        {showPosition ? score.position : ''}
                      </TableCell>
                      <TableCell className="py-2 px-1 md:px-4 whitespace-nowrap">
                        {score.first_name} {score.last_name}
                      </TableCell>
                      <TableCell className={`text-center py-2 px-1 md:px-4 font-bold ${
                        score.total.startsWith('-') ? 'text-red-600' : ''
                      }`}>
                        {score.total}
                      </TableCell>
                      <TableCell className="text-center py-2 px-1 md:px-4">
                        {score.current_round_score === '-' ? '' : score.current_round_score}
                      </TableCell>
                      <TableCell className="text-center py-2 px-1 md:pr-4">
                        {score.thru}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
