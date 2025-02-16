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

type GolferScore = {
  position: string;
  first_name: string;
  last_name: string;
  total: string;
  thru: string;
};

export function LiveLeaderboard() {
  const [scores, setScores] = useState<GolferScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      const { data, error } = await supabase
        .from('golfer_scores')
        .select('position, first_name, last_name, total, thru')
        .order('position', { ascending: true });

      if (error) {
        console.error('Error fetching scores:', error);
        return;
      }

      // Sort the data:
      // 1. Active players by total score (lowest first)
      // 2. Cut players alphabetically by last name
      const sortedScores = data.sort((a, b) => {
        // If both are cut, sort alphabetically
        if (a.position === 'CUT' && b.position === 'CUT') {
          return a.last_name.localeCompare(b.last_name);
        }
        // Cut players go last
        if (a.position === 'CUT') return 1;
        if (b.position === 'CUT') return -1;
        
        // Convert total scores for numerical comparison
        const totalA = parseInt(a.total.replace('+', '')) || 0;
        const totalB = parseInt(b.total.replace('+', '')) || 0;
        return totalA - totalB;
      });

      setScores(sortedScores);
      setLoading(false);
    }

    fetchScores();
  }, []);

  if (loading) {
    return <div>Loading leaderboard...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Position</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="w-[100px] text-right">Total</TableHead>
            <TableHead className="w-[100px] text-right">Thru</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scores.map((score, index) => (
            <TableRow key={`${score.last_name}-${score.first_name}`}>
              <TableCell>{score.position}</TableCell>
              <TableCell>{score.first_name} {score.last_name}</TableCell>
              <TableCell className="text-right">{score.total}</TableCell>
              <TableCell className="text-right">{score.thru}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
