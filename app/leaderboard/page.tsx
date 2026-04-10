'use client';

import { useEffect, useState, Fragment, useRef } from 'react';
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
import {
  calculateDisplayScore,
  calculatePrizePool,
  type Entry as ScoringEntry,
} from '@/utils/scoring';
import { Archivo } from 'next/font/google';
import { TbGolf } from "react-icons/tb";
import { Input } from "@/components/ui/input";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [prevEntries, setPrevEntries] = useState<Entry[]>([]);
  const [highlightedEntries, setHighlightedEntries] = useState<Record<string, boolean>>({});
  const [movingEntries, setMovingEntries] = useState<Record<string, 'up' | 'down' | null>>({});
  const [animationComplete, setAnimationComplete] = useState(true);
  const [prevRankings, setPrevRankings] = useState<Record<string, number>>({});
  const initialLoadRef = useRef(true);
  const [favoriteEntries, setFavoriteEntries] = useState<Set<string>>(new Set());
  const favoritesInitializedRef = useRef(false);

  useEffect(() => {
    if (favoritesInitializedRef.current) return;
    try {
      const stored = localStorage.getItem('majorsPoolFavorites');
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFavoriteEntries(new Set(parsed.filter((x): x is string => typeof x === 'string')));
        }
      }
    } catch {
      /* ignore */
    }
    favoritesInitializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!favoritesInitializedRef.current) return;
    try {
      localStorage.setItem(
        'majorsPoolFavorites',
        JSON.stringify(Array.from(favoriteEntries))
      );
    } catch {
      /* ignore */
    }
  }, [favoriteEntries]);

  const toggleFavorite = (entryName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryName)) next.delete(entryName);
      else next.add(entryName);
      return next;
    });
  };

  useEffect(() => {
    async function fetchData() {
      // First check if there's an active tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, status, current_round')
        .eq('is_active', true)
        .single();

      setTournament(tournament as { current_round: number });

      setHasActiveTournament(!!tournament && ['In Progress', 'Official'].includes(tournament.status as string));

      if (!tournament || !['In Progress', 'Official'].includes(tournament.status as string)) {
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
        .eq('tournament_id', tournament.id as any)
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
      const entriesWithGolfers = entriesData?.map((entry: any) => {
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
            player_id: id as string,
            first_name: score?.first_name as string || 'Unknown',
            last_name: score?.last_name as string || 'Golfer',
            total: score?.total as string || 'N/A',
            current_round_score: score?.current_round_score as string || '-',
            thru: score?.thru === '-' && ['CUT', 'WD', 'DQ'].includes(score?.position as string || '') 
              ? score?.position as string
              : score?.thru as string || '-',
            position: score?.position as string || '-',
            status: score?.status as string || '-',
            tee_time: score?.tee_time as string || '-'
          };
        });

        return {
          entry_name: entry.entry_name as string,
          calculated_score:
            entry.calculated_score === null || entry.calculated_score === undefined
              ? 0
              : (entry.calculated_score as number),
          golfers: sortGolfers(golfers as EntryGolfer[]),
          display_score: calculateDisplayScore(golfers as any)
        };
      }) || [];

      // Save previous entries for comparison BEFORE updating state
      if (entries.length > 0) {
        setPrevEntries([...entries]);
      } else if (initialLoadRef.current) {
        // This is the first load - just store the data without animations
        initialLoadRef.current = false;
        setEntries(entriesWithGolfers as Entry[]);
        setLoading(false);
        return;
      }

      // Use a short timeout to ensure prevEntries is set before entries state updates
      setTimeout(() => {
        setEntries(entriesWithGolfers as Entry[]);
        setLoading(false);
      }, 10);
    }

    fetchData();

    // Subscribe to changes
    const channel = supabase
      .channel('leaderboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'golfer_scores' // and/or other tables you want to monitor
        },
        () => {
          // Refetch data when changes occur
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'entries' // Add subscription to entries table
        },
        () => {
          // Refetch data when entries change
          fetchData();
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      channel.unsubscribe();
    };
  }, []);

  // When entries change, detect position changes and highlight entries
  useEffect(() => {
    if (entries.length === 0) {
      return;
    }
    
    if (prevEntries.length === 0) {
      setPrevEntries([...entries]);
      return;
    }

    setAnimationComplete(false);
    
    const newRankings = calculateRankings(entries);
    const oldRankings = calculateRankings(prevEntries);
    
    // Create a map of entry names to their previous rankings
    const prevRankMap: Record<string, number> = {};
    prevEntries.forEach((entry, index) => {
      const rankValue = oldRankings[index] ?? index + 1;
      prevRankMap[entry.entry_name] = typeof rankValue === 'string' ? Number(rankValue.replace('T', '')) : rankValue;
    });
    
    // Track which entries moved up or down
    const newMovingEntries: Record<string, 'up' | 'down' | null> = {};
    const newHighlightedEntries: Record<string, boolean> = {};
    
    entries.forEach((entry, index) => {
      const rankValue = newRankings[index] ?? index + 1;
      const currentRank = typeof rankValue === 'string' ? Number(rankValue.replace('T', '')) : rankValue;
      const previousRank = prevRankMap[entry.entry_name];
      
      if (previousRank !== undefined) {
        if (currentRank < previousRank) {
          // Entry moved up
          newMovingEntries[entry.entry_name] = 'up';
          newHighlightedEntries[entry.entry_name] = true;
        } else if (currentRank > previousRank) {
          // Entry moved down
          newMovingEntries[entry.entry_name] = 'down';
          newHighlightedEntries[entry.entry_name] = true;
        } else {
          const prevEntryScore = prevEntries.find(e => e.entry_name === entry.entry_name)?.calculated_score;
          
          if (entry.calculated_score !== prevEntryScore) {
            // Score changed but ranking didn't
            newHighlightedEntries[entry.entry_name] = true;
          }
        }
      }
    });
    
    setPrevRankings(prevRankMap);
    setMovingEntries(newMovingEntries);
    setHighlightedEntries(newHighlightedEntries);
    
    // Clear animations after 3 seconds
    const animationTimer = setTimeout(() => {
      setHighlightedEntries({});
      setMovingEntries({});
      setAnimationComplete(true);
      
      // Create a new map with current rankings to use for future comparisons
      const currentRankMap: Record<string, number> = {};
      entries.forEach((entry, index) => {
        const rankValue = newRankings[index] ?? index + 1;
        currentRankMap[entry.entry_name] = typeof rankValue === 'string' ? Number(rankValue.replace('T', '')) : rankValue;
      });
      setPrevRankings(currentRankMap);
      
      // Also update prevEntries to match current entries
      setPrevEntries([...entries]);
    }, 3000);
    
    return () => {
      clearTimeout(animationTimer);
    };
  }, [entries]);

  if (loading) {
    return <div>Loading entries...</div>;
  }

  // Calculate rankings for all entries first
  const rankings = calculateRankings(entries);

  // Create a map of entry name to ranking
  const rankingMap = new Map(
    entries.map((entry, index) => [entry.entry_name, rankings[index]])
  );

  const prizePoolInputs: ScoringEntry[] = entries.map((e) => ({
    entry_name: e.entry_name,
    calculated_score: e.calculated_score,
    display_score: e.display_score,
    topFiveGolfers: [],
  }));
  const { payouts } = calculatePrizePool(prizePoolInputs);

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

  const formatDisplayScore = (display_score: Entry['display_score']) => {
    if (typeof display_score === 'number') {
      if (display_score === 0) return 'E';
      if (display_score > 0) return `+${display_score}`;
      return String(display_score);
    }
    return display_score;
  };

  const favoriteRowsSorted = Array.from(favoriteEntries)
    .map((name) => {
      const entry = entries.find((e) => e.entry_name === name);
      if (!entry) return null;
      const idx = entries.findIndex((e) => e.entry_name === name);
      return { entry, idx };
    })
    .filter((row): row is { entry: Entry; idx: number } => row !== null)
    .sort((a, b) => a.idx - b.idx);

  return (
    <div className="container mx-auto min-w-0 max-w-full px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <div className="max-w-md mx-auto w-full min-w-0">
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
        <Card className="w-full min-w-0 max-w-full md:max-w-fit mx-auto">
          <CardHeader className="text-center px-3 py-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl font-['Post_Oldstyle'] italic flex items-center justify-center gap-2 text-header-link">
              Entry Leaderboard
              <TbGolf className="text-2xl sm:text-3xl shrink-0" />
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Tap entry to expand
            </p>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {favoriteRowsSorted.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs sm:text-sm font-medium text-header-link mb-2 px-0.5">
                  Favorites
                </h3>
                <div className="space-y-2 max-h-[min(40vh,22rem)] overflow-y-auto overflow-x-hidden pr-0.5 sm:pr-1 -mx-0.5 px-0.5 sm:mx-0 sm:px-0">
                  {favoriteRowsSorted.map(({ entry }) => {
                    const isMoving = !!movingEntries[entry.entry_name];
                    const isMovingUp = movingEntries[entry.entry_name] === 'up';
                    const isMovingDown =
                      movingEntries[entry.entry_name] === 'down';
                    const isHighlighted =
                      highlightedEntries[entry.entry_name];
                    return (
                      <motion.div
                        key={`fav-${entry.entry_name}`}
                        layout="position"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2"
                      >
                        <div
                          className="grid grid-cols-[1.25rem_1.625rem_2.125rem_minmax(0,1fr)_2.5rem] sm:grid-cols-[1.5rem_1.75rem_2.25rem_minmax(0,1fr)_2.75rem] md:grid-cols-[1.75rem_2rem_2.75rem_minmax(0,1fr)_13rem_3.5rem] gap-x-1 sm:gap-x-2 md:gap-x-6 items-center cursor-pointer hover:bg-muted/50 px-1.5 sm:px-2 md:px-4 py-1 rounded-sm bg-muted/40 min-w-0"
                          onClick={() => toggleExpand(entry.entry_name)}
                        >
                          <Star
                            className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 shrink-0 cursor-pointer text-yellow-400 fill-yellow-400"
                            onClick={(e) => toggleFavorite(entry.entry_name, e)}
                            aria-label={`Remove ${entry.entry_name} from favorites`}
                          />
                          <motion.div
                            className={`${archivo.className} text-xs sm:text-sm md:text-xl text-foreground dark:text-muted-foreground text-left tabular-nums min-w-0`}
                            animate={
                              isMovingUp
                                ? {
                                    color: [
                                      '',
                                      '#10b981',
                                      '#10b981',
                                      'currentColor',
                                    ],
                                    fontWeight: [400, 800, 800, 400],
                                    scale: [1, 1.25, 1.25, 1],
                                  }
                                : isMovingDown
                                  ? {
                                      color: [
                                        '',
                                        '#ef4444',
                                        '#ef4444',
                                        'currentColor',
                                      ],
                                      fontWeight: [400, 800, 800, 400],
                                      scale: [1, 1.25, 1.25, 1],
                                    }
                                  : {}
                            }
                            transition={{
                              duration: 3,
                              times: [0, 0.1, 0.9, 1],
                            }}
                          >
                            {rankingMap.get(entry.entry_name) || '\u00A0'}
                          </motion.div>
                          <span className="text-green-600 text-[10px] sm:text-xs md:text-sm text-right tabular-nums leading-none shrink-0 min-w-0">
                            {(payouts.get(entry.entry_name) || 0) > 0
                              ? `$${payouts.get(entry.entry_name)}`
                              : ''}
                          </span>
                          <h3 className="font-semibold text-xs sm:text-sm md:text-lg min-w-0 truncate">
                            {entry.entry_name}
                          </h3>
                          <TopFiveScoreStrip golfers={entry.golfers} />
                          <motion.span
                            className={`${archivo.className} text-xs sm:text-sm md:text-xl text-muted-foreground text-right tabular-nums min-w-0 ${
                              typeof entry.display_score === 'number' &&
                              entry.display_score < 0
                                ? '!text-red-600'
                                : ''
                            }`}
                            animate={
                              isHighlighted && !isMovingUp && !isMovingDown
                                ? {
                                    scale: [1, 1.12, 1],
                                    fontWeight: [400, 800, 400],
                                  }
                                : {}
                            }
                            transition={{
                              duration: 3,
                              times: [0, 0.5, 1],
                            }}
                          >
                            {formatDisplayScore(entry.display_score)}
                          </motion.span>
                        </div>
                        <AnimatePresence mode="wait" initial={false}>
                          {expandedEntries.has(entry.entry_name) && (
                            <ExpandedGolfersTable
                              golfers={entry.golfers}
                              currentRound={tournament?.current_round}
                            />
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="h-0.5 bg-muted-foreground/25 dark:bg-muted-foreground/35 my-5" />
              </div>
            )}

            <div className="space-y-0 min-w-0">
              <AnimatePresence initial={false}>
                {filteredEntries.map((entry, index) => {
                  const isMoving = !!movingEntries[entry.entry_name];
                  const isMovingUp = movingEntries[entry.entry_name] === 'up';
                  const isMovingDown = movingEntries[entry.entry_name] === 'down';
                  const isHighlighted = highlightedEntries[entry.entry_name];
                  const isFavorite = favoriteEntries.has(entry.entry_name);
                  
                  // Only apply alternating colors when animation is complete
                  const rowBgClass = animationComplete
                    ? index % 2 === 1 ? 'dark:bg-zinc-800/90 bg-zinc-800/10' : ''
                    : '';
                  
                  // Determine background and border colors for moving rows
                  let bgColor = undefined;
                  let borderColor = 'transparent';
                  let borderWidth = isMoving || isHighlighted ? '2px' : '0px';
                  let borderStyle = isMoving || isHighlighted ? 'solid' : 'none';
                  
                  if (isMoving) {
                    borderColor = '#fbbf24'; // Amber/gold color
                    bgColor = isMovingUp
                      ? 'rgba(16, 185, 129, 0.3)' // More visible green
                      : isMovingDown
                        ? 'rgba(239, 68, 68, 0.3)' // More visible red
                        : 'rgba(251, 191, 36, 0.3)'; // Amber for position change without direction
                  } else if (isHighlighted) {
                    borderColor = '#fbbf24'; // Amber/gold color
                    bgColor = 'rgba(251, 191, 36, 0.1)'; // Very light amber for updates
                  }
                  
                  return (
                    <motion.div 
                      key={entry.entry_name}
                      layout="position"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 30,
                        damping: 12,
                        duration: 1.5
                      }}
                      className="space-y-2"
                    >
                      <div 
                        style={{ 
                          backgroundColor: bgColor,
                          borderColor,
                          borderWidth,
                          borderStyle,
                        }}
                        className={`grid
                          grid-cols-[1.25rem_1.625rem_2.125rem_minmax(0,1fr)_2.5rem] sm:grid-cols-[1.5rem_1.75rem_2.25rem_minmax(0,1fr)_2.75rem] md:grid-cols-[1.75rem_2rem_2.75rem_minmax(0,1fr)_13rem_3.5rem] 
                          gap-x-1 sm:gap-x-2 md:gap-x-6 items-center cursor-pointer hover:bg-muted/50 px-2 sm:px-4 rounded-sm min-w-0 ${rowBgClass} ${(isHighlighted || isMoving) ? 'moving-border' : ''}`}
                        onClick={() => toggleExpand(entry.entry_name)}
                      >
                        <Star
                          className={`h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 shrink-0 cursor-pointer transition-colors ${
                            isFavorite
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-muted-foreground hover:text-yellow-400'
                          }`}
                          onClick={(e) => toggleFavorite(entry.entry_name, e)}
                          aria-label={
                            isFavorite
                              ? `Remove ${entry.entry_name} from favorites`
                              : `Add ${entry.entry_name} to favorites`
                          }
                        />
                        <motion.div 
                          className={`${archivo.className} text-sm sm:text-base md:text-2xl text-foreground dark:text-muted-foreground text-left tabular-nums min-w-0`}
                          animate={isMovingUp ? {
                            color: ['', '#10b981', '#10b981', 'currentColor'],
                            fontWeight: [400, 800, 800, 400],
                            scale: [1, 1.3, 1.3, 1],
                            textShadow: ['0 0 0px transparent', '0 0 8px rgba(16, 185, 129, 0.7)', '0 0 8px rgba(16, 185, 129, 0.7)', '0 0 0px transparent']
                          } : isMovingDown ? {
                            color: ['', '#ef4444', '#ef4444', 'currentColor'],
                            fontWeight: [400, 800, 800, 400],
                            scale: [1, 1.3, 1.3, 1],
                            textShadow: ['0 0 0px transparent', '0 0 8px rgba(239, 68, 68, 0.7)', '0 0 8px rgba(239, 68, 68, 0.7)', '0 0 0px transparent']
                          }: {}}
                          transition={{
                            duration: 3,
                            times: [0, 0.1, 0.9, 1]
                          }}
                        >
                          {rankingMap.get(entry.entry_name) || '\u00A0'}
                        </motion.div>
                        <span className="text-green-600 text-[10px] sm:text-xs md:text-sm text-right tabular-nums leading-none shrink-0 min-w-0">
                          {(payouts.get(entry.entry_name) || 0) > 0
                            ? `$${payouts.get(entry.entry_name)}`
                            : ''}
                        </span>
                        <h3 className="font-semibold text-xs sm:text-sm md:text-lg min-w-0 truncate">
                          {entry.entry_name} 
                        </h3>
                        <TopFiveScoreStrip golfers={entry.golfers} />
                        <motion.span 
                          className={`${archivo.className} text-sm sm:text-base md:text-2xl text-muted-foreground text-right tabular-nums min-w-0 ${
                            typeof entry.display_score === 'number' && entry.display_score < 0 
                              ? '!text-red-600' 
                              : ''
                          }`}
                          animate={isHighlighted && !isMovingUp && !isMovingDown ? {
                            scale: [1, 1.15, 1],
                            fontWeight: [400, 800, 400],
                          } : {}}
                          transition={{
                            duration: 3, 
                            times: [0, 0.5, 1]
                          }}
                        >
                          {formatDisplayScore(entry.display_score)}
                        </motion.span>
                      </div>
                      
                      <AnimatePresence mode="wait" initial={false}>
                        {expandedEntries.has(entry.entry_name) && (
                          <ExpandedGolfersTable
                            golfers={entry.golfers}
                            currentRound={tournament?.current_round}
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExpandedGolfersTable({
  golfers,
  currentRound,
}: {
  golfers: EntryGolfer[];
  currentRound?: number;
}) {
  return (
    <div className="rounded-md border overflow-x-auto -mx-0.5 sm:mx-0">
      <Table className="text-xs sm:text-sm min-w-[min(100%,18rem)]">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[5.5rem] sm:min-w-[8rem] md:min-w-[10rem] h-8 sm:h-10 px-1.5 sm:px-2 md:px-3">
              Golfer
            </TableHead>
            <TableHead className="text-center w-9 sm:w-10 md:min-w-[2rem] px-0.5 sm:px-2 md:px-5 h-8 sm:h-10">
              Total
            </TableHead>
            <TableHead className="text-center w-8 sm:w-9 px-0.5 sm:px-2 md:px-5 whitespace-nowrap h-8 sm:h-10">
              R{currentRound}
            </TableHead>
            <TableHead className="text-center w-10 sm:w-11 px-0.5 sm:px-2 md:px-5 h-8 sm:h-10">
              Thru
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {golfers.map((golfer, absoluteIndex) => (
            <TableRow key={golfer.player_id}>
              <TableCell
                className={`px-1.5 sm:px-2 py-1.5 sm:py-2 max-w-[10rem] sm:max-w-none truncate sm:whitespace-normal ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}
                title={`${golfer.first_name} ${golfer.last_name}`}
              >
                {golfer.first_name} {golfer.last_name}
              </TableCell>
              <TableCell
                className={`text-center py-1.5 sm:py-2 px-0.5 sm:px-2 font-bold tabular-nums ${
                  absoluteIndex > 4
                    ? 'bg-muted ' +
                      (golfer.total.startsWith('-')
                        ? '!text-red-600'
                        : 'text-muted-foreground')
                    : golfer.total.startsWith('-')
                      ? '!text-red-600'
                      : ''
                }`}
              >
                {golfer.total}
              </TableCell>
              <TableCell
                className={`text-center py-1.5 sm:py-2 px-0.5 sm:px-2 tabular-nums ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}
              >
                {golfer.current_round_score === '-'
                  ? ''
                  : `${golfer.current_round_score}`}
              </TableCell>
              <TableCell
                className={`text-center py-1.5 sm:py-2 px-0.5 sm:px-2 text-[11px] sm:text-xs md:text-sm tabular-nums ${absoluteIndex > 4 ? 'text-muted-foreground bg-muted' : ''}`}
              >
                {golfer.thru === '-' &&
                !['CUT', 'WD', 'DQ'].includes(golfer.position)
                  ? golfer.tee_time
                  : golfer.thru}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Same ordering as pool total (regular scores first, then CUT/WD/DQ by stroke). */
function sortGolfersForPoolStrip(golfers: EntryGolfer[]): EntryGolfer[] {
  return [...golfers].sort((a, b) => {
    const aIsCut = ['CUT', 'WD', 'DQ'].includes(a.position);
    const bIsCut = ['CUT', 'WD', 'DQ'].includes(b.position);
    if (aIsCut && !bIsCut) return 1;
    if (!aIsCut && bIsCut) return -1;
    const scoreA = a.total === 'E' ? 0 : Number(a.total.replace('+', ''));
    const scoreB = b.total === 'E' ? 0 : Number(b.total.replace('+', ''));
    return scoreA - scoreB;
  });
}

/** Fixed-width 5+4 grid so pipes line up across every row (like spreadsheet columns). */
function TopFiveScoreStrip({ golfers }: { golfers: EntryGolfer[] }) {
  const topFive = sortGolfersForPoolStrip(golfers).slice(0, 5);
  return (
    <div
      className="hidden md:grid w-[13rem] shrink-0 justify-self-end grid-cols-[minmax(0,1fr)_10px_minmax(0,1fr)_10px_minmax(0,1fr)_10px_minmax(0,1fr)_10px_minmax(0,1fr)] items-center text-[11px] md:text-xs font-mono tabular-nums leading-none text-muted-foreground"
      aria-label="Scores counting toward pool total"
    >
      {topFive.map((golfer, i) => {
        const label = ['CUT', 'WD', 'DQ'].includes(golfer.position)
          ? golfer.position
          : golfer.total;
        const red = golfer.total.startsWith('-');
        return (
          <Fragment key={golfer.player_id}>
            {i > 0 ? (
              <span
                className="text-center text-muted-foreground/70 select-none pointer-events-none"
                aria-hidden
              >
                |
              </span>
            ) : null}
            <span
              className={`text-center min-w-0 truncate ${red ? 'text-red-600' : ''}`}
              title={label}
            >
              {label}
            </span>
          </Fragment>
        );
      })}
    </div>
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