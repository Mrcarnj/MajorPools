'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

type GolferScore = {
  position: string;
  first_name: string;
  last_name: string;
  total: string;
  current_round_score: string;
  thru: string;
  tee_time?: string;
  id?: string;
};

export function LiveLeaderboard() {
  const [scores, setScores] = useState<GolferScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentData, setTournamentData] = useState<{ current_round: number; cut_score?: string } | null>(null);
  const [updatedRows, setUpdatedRows] = useState<Record<string, boolean>>({});
  const [movingRows, setMovingRows] = useState<Record<string, 'up' | 'down' | null>>({});
  const [highlightedRows, setHighlightedRows] = useState<Record<string, boolean>>({});
  const [animationComplete, setAnimationComplete] = useState(true);
  const prevScoresRef = useRef<Record<string, string>>({});
  const forceUpdate = useState({})[1];
  const channelRef = useRef<any>(null);

  const generateGolferId = (first: string, last: string) => `${last}-${first}`;

  const comparePositions = (a: string, b: string): number | null => {
    const special = ['CUT', 'WD', 'DQ', '-'];
    if (special.includes(a) || special.includes(b)) return null;
    const numA = parseInt(a.replace(/^T/, ''));
    const numB = parseInt(b.replace(/^T/, ''));
    if (isNaN(numA) || isNaN(numB)) return null;
    return numA - numB;
  };

  // Helper function to convert tee times to comparable values
  const teeTimeToMinutes = (teeTime: string): number => {
    if (!teeTime) return Number.MAX_SAFE_INTEGER;
    
    const isPM = teeTime.toLowerCase().includes('pm');
    const timeStr = teeTime.replace(/am|pm/i, '').trim();
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Convert to minutes since midnight, adding 12 hours for PM times (except 12 PM)
    let totalMinutes = hours * 60 + (minutes || 0);
    if (isPM && hours !== 12) totalMinutes += 12 * 60;
    if (!isPM && hours === 12) totalMinutes = minutes || 0; // 12 AM is 0 hours
    
    return totalMinutes;
  };

  const fetchData = async () => {
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
      .select('position, first_name, last_name, total, current_round_score, thru, tee_time')
      .eq('tournament_id', tournament.id)
      .order('position', { ascending: true });

    if (error || !data) {
      console.error('Error fetching scores:', error);
      return;
    }

    const dataWithIds = data.map(golfer => ({
      ...golfer,
      id: generateGolferId(golfer.first_name, golfer.last_name)
    }));

    dataWithIds.sort((a, b) => {
      const special = ['CUT', 'WD', 'DQ', '-'];
      const aIsSpecial = special.includes(a.position);
      const bIsSpecial = special.includes(b.position);
      
      // Always put real positions above special positions
      if (aIsSpecial && !bIsSpecial) return 1;
      if (!aIsSpecial && bIsSpecial) return -1;
      
      // If both have special positions
      if (aIsSpecial && bIsSpecial) {
        // Handle cases where both have tee times shown in the "Thru" column
        const aHasTeeTime = a.position === '-' && a.tee_time;
        const bHasTeeTime = b.position === '-' && b.tee_time;
        
        // If both have dash positions and tee times, sort by tee time
        if (aHasTeeTime && bHasTeeTime && a.position === '-' && b.position === '-') {
          return teeTimeToMinutes(a.tee_time!) - teeTimeToMinutes(b.tee_time!);
        }
        
        // Put dash with tee times above other special positions
        if (a.position === '-' && b.position !== '-') return -1;
        if (a.position !== '-' && b.position === '-') return 1;
        
        // Sort other special positions alphabetically
        return a.position.localeCompare(b.position);
      }
      
      // Both have real positions, sort by position number
      const posA = parseInt(a.position.replace(/^T/, ''));
      const posB = parseInt(b.position.replace(/^T/, ''));
      return posA - posB;
    });

    const newPositions: Record<string, string> = {};
    const newMoving: Record<string, 'up' | 'down' | null> = {};
    const newUpdated: Record<string, boolean> = {};
    const newHighlights: Record<string, boolean> = {};

    dataWithIds.forEach(g => {
      const id = g.id!;
      const prev = prevScoresRef.current[id];
      newPositions[id] = g.position;
      if (prev && prev !== g.position) {
        newHighlights[id] = true;
        newUpdated[id] = true;
        const comp = comparePositions(prev, g.position);
        if (comp !== null) {
          newMoving[id] = comp > 0 ? 'up' : comp < 0 ? 'down' : null;
        }
      }
    });

    setHighlightedRows(newHighlights);
    setMovingRows(newMoving);
    setUpdatedRows(newUpdated);
    prevScoresRef.current = newPositions;

    setTimeout(() => {
      setHighlightedRows({});
      setMovingRows({});
      setUpdatedRows({});
      forceUpdate({});
      setAnimationComplete(true);
    }, 5000);

    setScores(dataWithIds);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    if (channelRef.current) return;

    const channel = supabase
      .channel('live_leaderboard_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'golfer_scores' },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const golfer = payload.new as any;
            const golferId = golfer.id ?? generateGolferId(golfer.first_name, golfer.last_name);
            const prev = payload.old as any;

            if (prev?.position && golfer.position && prev.position !== golfer.position) {
              const comparison = comparePositions(prev.position, golfer.position);
              if (comparison !== null) {
                const isUp = comparison > 0;
                const isDown = comparison < 0;

                setMovingRows(prev => ({ ...prev, [golferId]: isUp ? 'up' : isDown ? 'down' : null }));
                setHighlightedRows(prev => ({ ...prev, [golferId]: true }));
                setUpdatedRows(prev => ({ ...prev, [golferId]: true }));

                setTimeout(() => {
                  setHighlightedRows(prev => {
                    const copy = { ...prev };
                    delete copy[golferId];
                    return copy;
                  });

                  setMovingRows(prev => {
                    const copy = { ...prev };
                    delete copy[golferId];
                    return copy;
                  });

                  setUpdatedRows(prev => {
                    const copy = { ...prev };
                    delete copy[golferId];
                    return copy;
                  });

                  forceUpdate({});
                  setAnimationComplete(true);

                  const rowElement = document.querySelector(`tr[data-golfer-id="${golferId}"]`) as HTMLElement | null;
                  if (rowElement) {
                    rowElement.style.backgroundColor = 'rgba(0, 0, 0, 0)';
                  }
                }, 5000);
              }
            }
          }

          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  if (loading) return <div>Loading leaderboard...</div>;

  if (!tournamentData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tournament Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No major tournament is currently active.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tournament Live Leaderboard</span>
          {tournamentData.current_round === 2 && tournamentData.cut_score && (
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
                      R{tournamentData.current_round || '-'}
                    </div>
                  </TableHead>
                  <TableHead className="text-right w-[30px] md:w-[40px] px-1 md:pr-4">Thru</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {scores.map((score, index) => {
                    const golferId = score.id!;
                    const showPosition = score.position === 'CUT' || index === 0 || score.position !== scores[index - 1].position;
                    const isUpdated = updatedRows[golferId];
                    const movingDirection = movingRows[golferId];
                    const isMoving = !!movingDirection;
                    const isMovingUp = movingDirection === 'up';
                    const isMovingDown = movingDirection === 'down';

                    const rowBgClass = animationComplete
                      ? index % 2 === 0 ? 'dark:bg-zinc-800/90 bg-zinc-800/10' : ''
                      : '';
                    const cutClass = score.position === 'CUT' ? 'text-muted-foreground bg-muted/90 dark:bg-muted/70' : '';

                    let bgColorClass = '';
                    if (isMovingUp) bgColorClass = 'bg-green-500/50';
                    else if (isMovingDown) bgColorClass = 'bg-red-500/50';
                    else if (isUpdated) bgColorClass = 'bg-amber-500/20';

                    return (
                      <motion.tr
                        key={golferId}
                        layout
                        data-golfer-id={golferId}
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 30, damping: 12 }}
                        className={`relative ${rowBgClass} ${cutClass} ${highlightedRows[golferId] ? 'moving-border' : ''} ${bgColorClass}`}
                      >
                        <TableCell className="text-center md:text-left py-2 px-1 md:px-4">
                          <motion.span
                            animate={isMovingUp ? {
                              color: ['', '#10b981', '#10b981', ''],
                              fontWeight: [400, 800, 800, 400],
                              scale: [1, 1.3, 1.3, 1],
                              textShadow: ['0 0 0px transparent', '0 0 8px rgba(16, 185, 129, 0.7)', '0 0 8px rgba(16, 185, 129, 0.7)', '0 0 0px transparent']
                            } : isMovingDown ? {
                              color: ['', '#ef4444', '#ef4444', ''],
                              fontWeight: [400, 800, 800, 400],
                              scale: [1, 1.3, 1.3, 1],
                              textShadow: ['0 0 0px transparent', '0 0 8px rgba(239, 68, 68, 0.7)', '0 0 8px rgba(239, 68, 68, 0.7)', '0 0 0px transparent']
                            } : {}}
                            transition={{
                              duration: 4,
                              times: [0, 0.1, 0.9, 1]
                            }}
                            className="font-medium"
                          >
                            {showPosition ? score.position : ''}
                          </motion.span>
                        </TableCell>
                        <TableCell className="py-2 px-1 md:px-4 whitespace-nowrap">
                          {score.first_name} {score.last_name}
                        </TableCell>
                        <TableCell className={`text-center py-2 px-1 md:px-4 font-bold ${score.total.startsWith('-') ? 'text-red-600' : ''}`}>
                          {score.total}
                        </TableCell>
                        <TableCell className="text-center py-2 px-1 md:px-4">
                          {score.current_round_score === '-' ? '' : score.current_round_score}
                        </TableCell>
                        <TableCell className="text-center py-2 px-1 md:pr-4">
                          {score.position === '-' && score.tee_time
                            ? score.tee_time
                            : (tournamentData?.current_round && score.current_round_score === null && score.tee_time)
                              ? score.tee_time
                              : score.thru}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
