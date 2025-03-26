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
  // Create a ref to store the previous scores between renders
  const prevScoresRef = useRef<Record<string, string>>({});
  // Force a re-render to clear animations
  const forceUpdate = useState({})[1];

  // Function to generate a unique ID for each golfer
  const generateGolferId = (firstName: string, lastName: string) => {
    return `${lastName}-${firstName}`;
  };

  // Helper function to compare positions
  const comparePositions = (posA: string, posB: string): number | null => {
    // Handle non-numeric positions
    const nonNumericPositions = ['CUT', 'WD', 'DQ', '-'];
    if (nonNumericPositions.includes(posA) || nonNumericPositions.includes(posB)) {
      return null; // Can't compare these positions
    }

    // Extract numeric part from positions like "T1", "2", etc.
    const numA = parseInt(posA.replace(/^T/, ''));
    const numB = parseInt(posB.replace(/^T/, ''));
    
    if (isNaN(numA) || isNaN(numB)) {
      return null;
    }
    
    // For golf positions, LOWER numbers are BETTER
    // So if going from 5 -> 3, that's moving UP (improving)
    // If going from 3 -> 5, that's moving DOWN (getting worse)
    // If going from T3 -> T7, that's moving DOWN (getting worse)
    
    // Using oldPosition - newPosition:
    // Return positive if moving UP (improving position)
    // Return negative if moving DOWN (worsening position)
    
    // If numA > numB (e.g., 5 > 3), result is positive (5-3=2), meaning moving UP (better)
    // If numA < numB (e.g., 3 < 7), result is negative (3-7=-4), meaning moving DOWN (worse)
    return numA - numB;
  };

  useEffect(() => {
    // Create a ref to store the previous scores between renders
    
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

      // Add unique IDs to each golfer
      const dataWithIds = data.map(golfer => ({
        ...golfer,
        id: generateGolferId(golfer.first_name, golfer.last_name)
      }));

      // Sort the data by position
      // This ensures proper ordering and handling of tied positions
      dataWithIds.sort((a, b) => {
        // Handle special positions like 'CUT', 'WD', etc.
        const specialPositions = ['CUT', 'WD', 'DQ'];
        if (specialPositions.includes(a.position) && !specialPositions.includes(b.position)) {
          return 1; // a comes after b
        }
        if (!specialPositions.includes(a.position) && specialPositions.includes(b.position)) {
          return -1; // a comes before b
        }
        if (specialPositions.includes(a.position) && specialPositions.includes(b.position)) {
          return a.position.localeCompare(b.position); // alphabetical order for special positions
        }

        // For normal positions, sort by numeric value (removing 'T' prefix if present)
        const posA = parseInt(a.position.replace(/^T/, ''));
        const posB = parseInt(b.position.replace(/^T/, ''));
        
        if (posA === posB) {
          // If positions are tied, sort alphabetically by last name
          return a.last_name.localeCompare(b.last_name);
        }
        
        return posA - posB;
      });

      // Debug: Log the raw data we received
      console.log('Raw data from database:', dataWithIds.map(g => ({
        name: `${g.first_name} ${g.last_name}`,
        position: g.position,
        total: g.total
      })));
      
      // Create a map of current positions for comparison
      const newPositions: Record<string, string> = {};
      const newMovingRows: Record<string, 'up' | 'down' | null> = {};
      const newUpdatedRows: Record<string, boolean> = {};
      const newHighlightedRows: Record<string, boolean> = {};
      
      // Debug: Log the previous positions we have stored
      console.log('Previous positions stored:', prevScoresRef.current);
      
      dataWithIds.forEach(golfer => {
        const golferId = golfer.id || generateGolferId(golfer.first_name, golfer.last_name);
        const prevPosition = prevScoresRef.current[golferId];
        
        // Store the new position for next comparison
        newPositions[golferId] = golfer.position;
        
        // Debug: Log position for each golfer
        console.log(`${golfer.first_name} ${golfer.last_name}: Previous=${prevPosition || 'none'}, New=${golfer.position}`);
        
        if (prevPosition && prevPosition !== golfer.position) {
          newHighlightedRows[golferId] = true;
          newUpdatedRows[golferId] = true;
          
          // Determine if moved up or down
          const positionComparison = comparePositions(prevPosition, golfer.position);
          console.log(`Position comparison for ${golfer.first_name} ${golfer.last_name}: ${positionComparison} (${prevPosition} -> ${golfer.position})`);
          
          if (positionComparison !== null) {
            if (positionComparison > 0) {
              // Positive value means moved UP (improved position)
              // e.g., going from 5 -> 3: comparePositions(5, 3) = 5-3 = 2 (positive)
              newMovingRows[golferId] = 'up';
              console.log(`🟢 ${golfer.first_name} ${golfer.last_name} moved UP from ${prevPosition} to ${golfer.position}`);
            } else if (positionComparison < 0) {
              // Negative value means moved DOWN (worsened position)
              // e.g., going from 3 -> 7: comparePositions(3, 7) = 3-7 = -4 (negative)
              newMovingRows[golferId] = 'down';
              console.log(`🔴 ${golfer.first_name} ${golfer.last_name} moved DOWN from ${prevPosition} to ${golfer.position}`);
            }
          }
        }
      });
      
      // Debug: Log the final state updates
      console.log('New moving rows:', newMovingRows);
      console.log('New highlighted rows:', newHighlightedRows);
      
      // Update state with new information
      setHighlightedRows(newHighlightedRows);
      setMovingRows(newMovingRows);
      setUpdatedRows(newUpdatedRows);
      
      // Update our ref with the new positions for next comparison
      prevScoresRef.current = newPositions;
      
      // Reset animations after a delay
      setTimeout(() => {
        // Reset animations for all golfers with position changes
        Object.keys(newMovingRows).forEach(golferId => {
          const golfer = dataWithIds.find(g => g.id === golferId || generateGolferId(g.first_name, g.last_name) === golferId);
          if (golfer) {
            console.log(`🔄 Resetting animations for ${golfer.first_name} ${golfer.last_name}`);
          }
        });
        
        // Make sure we're actually clearing the state
        console.log('🧹 Clearing all animation states');
        setHighlightedRows({});
        setMovingRows({});
        setUpdatedRows({});
        
        // Force a re-render to ensure animations are cleared
        forceUpdate({});
        
        // Set animation complete flag
        setAnimationComplete(true);
      }, 5000); // 5 seconds to allow animations to complete

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
          // Enhanced log - show the golfer's name and position if available
          if (payload.new && typeof payload.new === 'object') {
            const golfer = payload.new as any;
            console.log('🔍 GOLFER UPDATE RECEIVED:', {
              id: golfer.id,
              first_name: golfer.first_name,
              last_name: golfer.last_name,
              position: golfer.position,
              old_position: payload.old ? (payload.old as any).position : undefined,
              total: golfer.total,
              old_total: payload.old ? (payload.old as any).total : undefined,
              full_payload: payload
            });
            
            // Debug: Show the current state of our position tracking
            console.log('🧠 Current position tracking state:', {
              prevScoresRef: prevScoresRef.current,
              golferId: golfer.id ? golfer.id : generateGolferId(golfer.first_name, golfer.last_name)
            });
            
            // If we have both old and new position, we can detect position changes directly
            if (payload.old && typeof payload.old === 'object' && 
                'position' in golfer && 'position' in (payload.old as any)) {
              
              const oldPosition = (payload.old as any).position;
              const newPosition = golfer.position;
              
              console.log(`🔄 Position comparison: "${oldPosition}" vs "${newPosition}"`);
              
              if (oldPosition !== newPosition) {
                console.log(`⚠️ POSITION CHANGE DETECTED: ${oldPosition} -> ${newPosition}`);
                
                // Determine if moved up or down
                const positionComparison = comparePositions(oldPosition, newPosition);
                console.log(`Position comparison result: ${positionComparison}`);
                
                if (positionComparison !== null) {
                  const golferId = golfer.id ? golfer.id : generateGolferId(golfer.first_name, golfer.last_name);
                  
                  if (positionComparison > 0) {
                    console.log(`🟢 ${golfer.first_name} ${golfer.last_name} moved UP from ${oldPosition} to ${newPosition}`);
                    // Directly update the moving rows state
                    setMovingRows(prev => ({ ...prev, [golferId]: 'up' }));
                    setHighlightedRows(prev => ({ ...prev, [golferId]: true }));
                    setUpdatedRows(prev => ({ ...prev, [golferId]: true }));
                  } else if (positionComparison < 0) {
                    console.log(`🔴 ${golfer.first_name} ${golfer.last_name} moved DOWN from ${oldPosition} to ${newPosition}`);
                    // Directly update the moving rows state
                    setMovingRows(prev => ({ ...prev, [golferId]: 'down' }));
                    setHighlightedRows(prev => ({ ...prev, [golferId]: true }));
                    setUpdatedRows(prev => ({ ...prev, [golferId]: true }));
                  }
                  
                  // Reset animations after a delay
                  setTimeout(() => {
                    console.log(`🔄 Resetting animations for ${golfer.first_name} ${golfer.last_name}`);
                    
                    // Create new objects instead of modifying existing ones
                    setHighlightedRows(prev => {
                      const newState = {...prev};
                      delete newState[golferId];
                      return newState;
                    });
                    
                    setMovingRows(prev => {
                      const newState = {...prev};
                      delete newState[golferId];
                      return newState;
                    });
                    
                    setUpdatedRows(prev => {
                      const newState = {...prev};
                      delete newState[golferId];
                      return newState;
                    });
                    
                    console.log('Animation states reset for', golferId);
                    
                    // Force a re-render to ensure animations are cleared
                    forceUpdate({});
                    
                    // Set animation complete flag
                    setAnimationComplete(true);

                    // Force the background color to be explicitly set to transparent using DOM manipulation
                    // This is a fallback to ensure the background color is reset even if React state updates don't trigger a re-render
                    setTimeout(() => {
                      const rowElement = document.querySelector(`tr[data-golfer-id="${golferId}"]`) as HTMLElement | null;
                      if (rowElement) {
                        rowElement.style.backgroundColor = 'rgba(0, 0, 0, 0)';
                        console.log(`Explicitly reset background color for ${golfer.first_name} ${golfer.last_name}`);
                      }
                    }, 100); // Small delay to ensure DOM is updated
                  }, 5000); // 5 seconds to allow animations to complete
                }
              } else {
                console.log(`⚪ NO POSITION CHANGE: Position remained at ${newPosition}`);
              }
            } else {
              console.log('⚠️ Cannot compare positions - missing old or new position data');
            }
          } else {
            console.log('⚠️ Received payload without valid golfer data:', payload);
          }
          
          // Always fetch new data
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
          // Simplified log - just show that we received an update
          console.log('Tournament data changed - fetching new data');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []); // Empty dependency array - only run on mount

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

                    const golferId = score.id || generateGolferId(score.first_name, score.last_name);
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

                    // Determine background color for moving rows
                    let bgColor = undefined;
                    let bgColorClass = '';
                    if (isMoving) {
                      if (isMovingUp) {
                        bgColor = 'rgba(16, 185, 129, 0.5)'; // Brighter green
                        bgColorClass = 'bg-green-500/50'; // Tailwind class for green background
                      } else if (isMovingDown) {
                        bgColor = 'rgba(239, 68, 68, 0.5)'; // Brighter red
                        bgColorClass = 'bg-red-500/50'; // Tailwind class for red background
                      } else {
                        bgColor = 'rgba(251, 191, 36, 0.5)'; // Brighter amber
                        bgColorClass = 'bg-amber-500/50'; // Tailwind class for amber background
                      }
                    } else if (isUpdated) {
                      bgColor = 'rgba(251, 191, 36, 0.2)'; // Light amber for updates
                      bgColorClass = 'bg-amber-500/20'; // Tailwind class for light amber background
                    }

                    // For debugging - log when a row should be animated
                    if (isMoving) {
                      console.log(`⚠️ Rendering row with animation:`, {
                        name: `${score.first_name} ${score.last_name}`,
                        direction: movingDirection,
                        isMovingUp,
                        isMovingDown,
                        bgColor,
                        bgColorClass
                      });
                    }

                    return (
                      <motion.tr
                        key={golferId}
                        layout
                        data-golfer-id={golferId}
                        initial={{ 
                          opacity: 1, 
                          backgroundColor: 'rgba(0, 0, 0, 0)' // Use rgba(0,0,0,0) instead of 'transparent'
                        }}
                        animate={{
                          opacity: 1,
                          backgroundColor: bgColor || 'rgba(0, 0, 0, 0)' // Use rgba(0,0,0,0) instead of 'transparent'
                        }}
                        style={{ 
                          backgroundColor: isMoving ? bgColor : 'rgba(0, 0, 0, 0)' // Only apply background color if actually moving
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 30,
                          damping: 12,
                          duration: 1.5
                        }}
                        className={`relative ${rowBgClass} ${cutClass} ${highlightedRows[golferId] ? 'moving-border' : ''} ${isMoving ? bgColorClass : ''}`}
                        onAnimationComplete={() => {
                          // Log when animation completes
                          if (isMoving) {
                            console.log(`🏁 Animation completed for ${score.first_name} ${score.last_name}`);
                            
                            // Directly reset the style after animation completes
                            const element = document.querySelector(`tr[data-golfer-id="${golferId}"]`) as HTMLElement | null;
                            if (element) {
                              // Use a small timeout to ensure the animation has fully completed
                              setTimeout(() => {
                                element.style.backgroundColor = 'rgba(0, 0, 0, 0)';
                                console.log(`🎨 Directly reset background color for ${score.first_name} ${score.last_name}`);
                              }, 100);
                            }
                          }
                        }}
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
