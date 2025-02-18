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
  const [tournamentData, setTournamentData] = useState<{ current_round: number } | null>(null);

  useEffect(() => {
    async function fetchData() {
      // First check if there's an active tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, current_round')
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
        .order('position', { ascending: true });

      if (error) {
        console.error('Error fetching scores:', error);
        return;
      }

      setScores(data);
      setLoading(false);
    }

    fetchData();
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
        <CardTitle className="flex items-center gap-2">
          Tournament Live Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-[100px]">Position</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right w-[60px]">Total</TableHead>
                  <TableHead className="text-right w-[60px]">
                    <div className="flex justify-end items-center whitespace-nowrap">
                      Rd {tournamentData?.current_round || '-'}
                    </div>
                  </TableHead>
                  <TableHead className="text-right w-[40px] pr-4">Thru</TableHead>
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
                        ${index % 2 === 0 ? 'bg-muted/100 dark:bg-muted/50' : ''}
                        ${score.position === 'CUT' ? 'text-muted-foreground bg-muted/90 dark:bg-muted/70' : ''}
                      `}
                    >
                      <TableCell>{showPosition ? score.position : ''}</TableCell>
                      <TableCell>{score.first_name} {score.last_name}</TableCell>
                      <TableCell className={`text-right font-bold ${score.total.startsWith('-') ? 'text-red-500' : ''}`}>
                        {score.total}
                      </TableCell>
                      <TableCell className="text-right">
                        {score.current_round_score === '-' ? '' : score.current_round_score}
                      </TableCell>
                      <TableCell className="text-right pr-4">{score.thru}</TableCell>
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
