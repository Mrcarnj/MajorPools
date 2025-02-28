'use client';

import { useEffect, useState, useRef } from 'react';
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
import { motion, AnimatePresence } from "framer-motion";

type GolferScore = {
  position: string;
  first_name: string;
  last_name: string;
  total: string;
  current_round_score: string;
  thru: string;
  tee_time?: string;
  id?: string; // Adding id to help with animations
};

export function LiveLeaderboard() {
  const [scores, setScores] = useState<GolferScore[]>([]);
  const [prevScores, setPrevScores] = useState<GolferScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentData, setTournamentData] = useState<{
    current_round: number;
    cut_score?: string;
  } | null>(null);
  const [updatedRows, setUpdatedRows] = useState<Record<string, boolean>>({});
  const [movingRows, setMovingRows] = useState<Record<string, 'up' | 'down' | null>>({});
  const [animationComplete, setAnimationComplete] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);
  const [highlightedRows, setHighlightedRows] = useState<Record<string, boolean>>({});
  const [prevPositions, setPrevPositions] = useState<Record<string, string>>({}); // Track previous positions

  // Function to generate a unique ID for each golfer
  const generateGolferId = (firstName: string, lastName: string) => {
    return `${lastName}-${firstName}`;
  };


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
        .select('position, first_name, last_name, total, current_round_score, thru, tee_time')
        .eq('tournament_id', tournament.id)
        .order('position', { ascending: true });

      if (error) {
        console.error('Error fetching scores:', error);
        return;
      }

      // Sort data by total score, handling string scores with +/- signs
      const sortedData = [...data].sort((a, b) => {
        // First handle position '-' (move to bottom)
        if (a.position === '-' && b.position !== '-') return 1;
        if (a.position !== '-' && b.position === '-') return -1;

        // If both have position '-', sort by tee_time
        if (a.position === '-' && b.position === '-') {
          if (a.tee_time && b.tee_time) {
            // Convert time strings like "11:50am" to comparable values
            const parseTimeString = (timeStr: string) => {
              const [timePart, ampm] = timeStr.match(/(\d+:\d+)([ap]m)/i)?.slice(1) || [];
              if (!timePart || !ampm) return 0;

              const [hours, minutes] = timePart.split(':').map(Number);
              let totalMinutes = hours * 60 + minutes;

              // Adjust for PM times
              if (ampm.toLowerCase() === 'pm' && hours !== 12) {
                totalMinutes += 12 * 60;
              }
              // Adjust for 12am
              if (ampm.toLowerCase() === 'am' && hours === 12) {
                totalMinutes -= 12 * 60;
              }

              return totalMinutes;
            };

            return parseTimeString(a.tee_time) - parseTimeString(b.tee_time);
          }
          return 0;
        }

        // Then handle non-numeric positions
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

      // Add unique IDs to each golfer
      const dataWithIds = sortedData.map(golfer => ({
        ...golfer,
        id: generateGolferId(golfer.first_name, golfer.last_name)
      }));

      // Save previous scores for comparison AFTER sorting but BEFORE updating state
      // Only save if we have existing scores to compare against
      if (scores.length > 0) {
        setPrevScores([...scores]);
      }

      // Update scores state with the new data
      setScores(dataWithIds);
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
        (payload) => {
          console.log('Golfer scores changed:', payload);
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
        (payload) => {
          console.log('Tournament data changed:', payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []); // Empty dependency array - only run on mount

  useEffect(() => {
    if (scores.length === 0) return;
  
    const newHighlightedRows: Record<string, boolean> = {};
    const newPositions: Record<string, string> = {};
  
    scores.forEach((golfer) => {
      const golferId = generateGolferId(golfer.first_name, golfer.last_name);
      newPositions[golferId] = golfer.position;
  
      // Check if position changed from the previous state
      if (prevPositions[golferId] && prevPositions[golferId] !== golfer.position) {
        newHighlightedRows[golferId] = true;
      }
    });
  
    // Update highlighted rows
    setHighlightedRows(newHighlightedRows);
  
    // Store new positions for the next comparison
    setPrevPositions(newPositions);
  
    // Remove highlight after 3 seconds
    setTimeout(() => {
      setHighlightedRows({});
    }, 3000);
  }, [scores]); // Depend only on scores

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
          <div className="max-h-[408px] overflow-y-auto" ref={tableRef}>
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
                <AnimatePresence initial={false}>
                  {scores.map((score, index) => {
                    const showPosition = score.position === 'CUT' ||
                      index === 0 ||
                      score.position !== scores[index - 1].position;

                    const golferId = generateGolferId(score.first_name, score.last_name);
                    const isUpdated = updatedRows[golferId];
                    const movingDirection = movingRows[golferId];
                    const isMoving = !!movingDirection;
                    const isMovingUp = movingDirection === 'up';
                    const isMovingDown = movingDirection === 'down';

                    // Determine row background color (alternating rows)
                    // Only apply alternating colors when animation is complete
                    const rowBgClass = animationComplete
                      ? index % 2 === 0 ? 'dark:bg-zinc-800/90 bg-zinc-800/10' : ''
                      : '';

                    const cutClass = score.position === 'CUT' ? 'text-muted-foreground bg-muted/90 dark:bg-muted/70' : '';

                    // Determine border color based on movement
                    let borderColor = 'transparent';
                    if (isMoving) {
                      borderColor = '#fbbf24'; // Amber/gold color
                    }

                    // Determine background color for moving rows
                    let bgColor = undefined;
                    if (isMoving) {
                      bgColor = isMovingUp
                        ? 'rgba(16, 185, 129, 0.3)' // More visible green
                        : isMovingDown
                          ? 'rgba(239, 68, 68, 0.3)' // More visible red
                          : 'rgba(251, 191, 36, 0.3)'; // Amber for position change without direction
                    } else if (isUpdated) {
                      bgColor = 'rgba(251, 191, 36, 0.1)'; // Very light amber for updates
                    }

                    // For debugging - log when a row should be animated
                    if (isMoving && process.env.NODE_ENV !== 'production') {
                      console.log(`Rendering moving row for ${score.first_name} ${score.last_name}:`, {
                        direction: movingDirection,
                        isMovingUp,
                        isMovingDown
                      });
                    }

                    return (
                      <motion.tr
                        key={golferId}
                        layout
                        initial={{ opacity: 1 }}
                        animate={{
                          opacity: 1,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 30,
                          damping: 12,
                          duration: 1.5
                        }}
                        className={`relative ${rowBgClass} ${cutClass} ${highlightedRows[golferId] ? 'moving-border' : ''}`}
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
                              duration: 4, // Increased from 2 to 4 seconds
                              times: [0, 0.1, 0.9, 1] // Hold the color for longer
                            }}
                            className="font-medium"
                          >
                            {showPosition ? score.position : ''}
                          </motion.span>
                        </TableCell>
                        <TableCell className="py-2 px-1 md:px-4 whitespace-nowrap">
                          {score.first_name} {score.last_name}
                        </TableCell>
                        <TableCell className={`text-center py-2 px-1 md:px-4 font-bold ${score.total.startsWith('-') ? 'text-red-600' : ''
                          }`}>
                          {score.total}
                        </TableCell>
                        <TableCell className="text-center py-2 px-1 md:px-4">
                          {score.current_round_score === '-' ? '' : score.current_round_score}
                        </TableCell>
                        <TableCell className="text-center py-2 px-1 md:pr-4">
                          {score.position === '-' && score.tee_time
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
