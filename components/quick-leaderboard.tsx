'use client';

import { calculateDisplayScore, calculateRankings, type Entry, type GolferScore } from '@/utils/scoring';
import { Archivo } from 'next/font/google';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrophyIcon, Star, Search, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { calculatePrizePool } from '@/utils/scoring';
import { motion, AnimatePresence } from "framer-motion";
import { Input } from '@/components/ui/input';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500'],
  style: ['italic'],
  variable: '--font-archivo',
  display: 'swap',
});

// Debug function
const debug = (message: string, data?: any) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(`[QuickLeaderboard Debug] ${message}`, data || '');
  }
};

export function QuickLeaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prevEntries, setPrevEntries] = useState<Entry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [highlightedEntries, setHighlightedEntries] = useState<Record<string, boolean>>({});
  const [movingEntries, setMovingEntries] = useState<Record<string, 'up' | 'down' | null>>({});
  const [animationComplete, setAnimationComplete] = useState(true);
  const [prevRankings, setPrevRankings] = useState<Record<string, number>>({});
  const [favoriteEntries, setFavoriteEntries] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const updateCountRef = useRef(0);
  const initialLoadRef = useRef(true);
  const favoritesInitializedRef = useRef(false);

  // Load favorites from localStorage on component mount
  useEffect(() => {
    if (favoritesInitializedRef.current) return;
    
    console.log('Attempting to load favorites from localStorage...');
    try {
      const storedFavorites = localStorage.getItem('majorsPoolFavorites');
      console.log('Raw stored favorites:', storedFavorites);
      
      if (storedFavorites) {
        const parsedFavorites = JSON.parse(storedFavorites);
        console.log('Parsed favorites:', parsedFavorites);
        
        if (Array.isArray(parsedFavorites) && parsedFavorites.length > 0) {
          const favoritesSet = new Set(parsedFavorites);
          console.log('Setting favorites state to:', Array.from(favoritesSet));
          setFavoriteEntries(favoritesSet);
        } else {
          console.log('No valid favorites found in localStorage');
        }
      } else {
        console.log('No favorites found in localStorage');
      }
    } catch (error) {
      console.error('Error loading favorites from localStorage:', error);
    }
    
    favoritesInitializedRef.current = true;
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    if (!favoritesInitializedRef.current) return;
    
    console.log('Favorites changed, current favorites:', Array.from(favoriteEntries));
    try {
      const favoritesArray = Array.from(favoriteEntries);
      console.log('Saving to localStorage:', favoritesArray);
      localStorage.setItem('majorsPoolFavorites', JSON.stringify(favoritesArray));
      console.log('Successfully saved to localStorage');
    } catch (error) {
      console.error('Error saving favorites to localStorage:', error);
    }
  }, [favoriteEntries]);

  // Toggle favorite status for an entry
  const toggleFavorite = (entryName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion when clicking star
    console.log('Toggling favorite for:', entryName);
    console.log('Current favorites before toggle:', Array.from(favoriteEntries));
    
    setFavoriteEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryName)) {
        next.delete(entryName);
        console.log(`Removed ${entryName} from favorites`);
      } else {
        next.add(entryName);
        console.log(`Added ${entryName} to favorites`);
      }
      console.log('New favorites after toggle:', Array.from(next));
      return next;
    });
  };

  // Debugging helper to compare two arrays of entries
  const compareEntries = (oldEntries: Entry[], newEntries: Entry[]) => {
    const changes: {entry: string, field: string, old: any, new: any}[] = [];
    
    // Check for entries that exist in both arrays
    newEntries.forEach(newEntry => {
      const oldEntry = oldEntries.find(e => e.entry_name === newEntry.entry_name);
      if (oldEntry) {
        // Check for score changes
        if (oldEntry.calculated_score !== newEntry.calculated_score) {
          changes.push({
            entry: newEntry.entry_name,
            field: 'calculated_score',
            old: oldEntry.calculated_score,
            new: newEntry.calculated_score
          });
        }
        
        // Check for display score changes  
        if (oldEntry.display_score !== newEntry.display_score) {
          changes.push({
            entry: newEntry.entry_name,
            field: 'display_score',
            old: oldEntry.display_score,
            new: newEntry.display_score
          });
        }
      } else {
        // New entry added
        changes.push({
          entry: newEntry.entry_name,
          field: 'new_entry',
          old: null,
          new: newEntry
        });
      }
    });
    
    // Check for entries that were removed
    oldEntries.forEach(oldEntry => {
      if (!newEntries.find(e => e.entry_name === oldEntry.entry_name)) {
        changes.push({
          entry: oldEntry.entry_name,
          field: 'removed_entry',
          old: oldEntry,
          new: null
        });
      }
    });
    
    return changes;
  };

  // Separate effect to update entries data
  useEffect(() => {
    async function fetchData() {
      debug('Fetching data...');
      // First get active tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, status')
        .eq('is_active', true)
        .single();

      if (!tournament) {
        debug('No active tournament found');
        setEntries([]);
        return;
      }

      setTournamentStarted(tournament.status !== 'Not Started');
      debug(`Tournament status: ${tournament.status}`);

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

      debug(`Retrieved ${entriesData?.length || 0} entries from database`);

      // Get current scores for all golfers
      const { data: scoresData } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name, total, position');
        
      debug(`Retrieved ${scoresData?.length || 0} golfer scores from database`);

      if (entriesData && scoresData) {
        const scoreMap = new Map(scoresData.map(score => [score.player_id, score]));
        debug('Created score map for quick lookup');

        const processedEntries = entriesData.map(entry => {
          const golferIds = [
            entry.tier1_golfer1, entry.tier1_golfer2,
            entry.tier2_golfer1, entry.tier2_golfer2,
            entry.tier3_golfer1, entry.tier3_golfer2,
            entry.tier4_golfer1,
            entry.tier5_golfer1
          ];

          const golferScores = golferIds.map(id => ({
            ...scoreMap.get(id) || { total: 'E', position: '-' },
            player_id: id
          }));

          // Sort golfers by score
          const sortedGolfers = golferScores
            .sort((a, b) => {
              const scoreA = a.total === 'E' ? 0 : Number(a.total.replace('+', ''));
              const scoreB = b.total === 'E' ? 0 : Number(b.total.replace('+', ''));
              return scoreA - scoreB;
            });

          // Create a separate array for top 5 (scored golfers)
          const topFiveGolfers = sortedGolfers.slice(0, 5);

          return {
            entry_name: entry.entry_name,
            calculated_score: entry.calculated_score === null ? 0 : entry.calculated_score,
            display_score: calculateDisplayScore(golferScores) as number,
            topFiveGolfers,
            allGolfers: sortedGolfers // Store all golfers for display
          };
        });

        // Debug: Check if there are any differences with the previous entries
        if (entries.length > 0) {
          const changes = compareEntries(entries, processedEntries);
          if (changes.length > 0) {
            debug(`Detected ${changes.length} changes in entries:`, changes);
          } else {
            debug('No changes detected in entries data');
          }
        }

        // Save previous entries for comparison BEFORE updating state
        if (entries.length > 0) {
          debug('Saving previous entries state');
          setPrevEntries([...entries]);
        } else if (initialLoadRef.current) {
          // This is the first load - just store the data without animations
          initialLoadRef.current = false;
          debug('First load - setting entries without animation');
          setEntries(processedEntries);
          return;
        }

        updateCountRef.current += 1;
        debug(`Setting entries state (update #${updateCountRef.current})`);
        
        // Use a short timeout to ensure prevEntries is set before entries state updates
        // This is a common pattern to handle state batching in React
        setTimeout(() => {
          setEntries(processedEntries);
        }, 10);
      }
    }

    fetchData();
    debug('Initial data fetch completed');

    // Subscribe to relevant changes
    debug('Setting up real-time subscriptions');
    const channel = supabase
      .channel('quick_leaderboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entries'
        },
        (payload) => {
          debug('Entries table changed, payload:', payload);
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'golfer_scores'
        },
        (payload) => {
          debug('Golfer scores table changed, payload:', payload);
          fetchData();
        }
      )
      .subscribe();

    debug('Real-time subscriptions set up');

    return () => {
      debug('Cleaning up subscriptions');
      channel.unsubscribe();
    };
  }, []);

  // When entries change, detect position changes and highlight entries
  useEffect(() => {
    debug(`Entries state changed, entries length: ${entries.length}, prevEntries length: ${prevEntries.length}`);
    
    if (entries.length === 0) {
      debug('No entries to animate');
      return;
    }
    
    if (prevEntries.length === 0) {
      debug('No previous entries for comparison - saving current as previous');
      setPrevEntries([...entries]);
      return;
    }

    debug('Starting animation processing');
    setAnimationComplete(false);
    
    const newRankings = calculateRankings(entries);
    const oldRankings = calculateRankings(prevEntries);
    
    debug('Calculated rankings:', { new: newRankings, old: oldRankings });
    
    // Create a map of entry names to their previous rankings
    const prevRankMap: Record<string, number> = {};
    prevEntries.forEach((entry, index) => {
      const rankValue = oldRankings[index] ?? index + 1;
      prevRankMap[entry.entry_name] = typeof rankValue === 'string' ? Number(rankValue) : rankValue;
    });
    
    debug('Previous rankings map:', prevRankMap);
    
    // Track which entries moved up or down
    const newMovingEntries: Record<string, 'up' | 'down' | null> = {};
    const newHighlightedEntries: Record<string, boolean> = {};
    
    entries.forEach((entry, index) => {
      const rankValue = newRankings[index] ?? index + 1;
      const currentRank = typeof rankValue === 'string' ? Number(rankValue) : rankValue;
      const previousRank = prevRankMap[entry.entry_name];
      
      debug(`Checking entry ${entry.entry_name}: currentRank=${currentRank}, previousRank=${previousRank}`);
      
      if (previousRank !== undefined) {
        if (currentRank < previousRank) {
          // Entry moved up
          debug(`Entry ${entry.entry_name} moved UP from ${previousRank} to ${currentRank}`);
          newMovingEntries[entry.entry_name] = 'up';
          newHighlightedEntries[entry.entry_name] = true;
        } else if (currentRank > previousRank) {
          // Entry moved down
          debug(`Entry ${entry.entry_name} moved DOWN from ${previousRank} to ${currentRank}`);
          newMovingEntries[entry.entry_name] = 'down';
          newHighlightedEntries[entry.entry_name] = true;
        } else {
          const prevEntryScore = prevEntries.find(e => e.entry_name === entry.entry_name)?.calculated_score;
          debug(`Entry ${entry.entry_name} ranking unchanged. Current score: ${entry.calculated_score}, Previous score: ${prevEntryScore}`);
          
          if (entry.calculated_score !== prevEntryScore) {
            // Score changed but ranking didn't
            debug(`Entry ${entry.entry_name} score changed but rank stayed the same`);
            newHighlightedEntries[entry.entry_name] = true;
          }
        }
      } else {
        debug(`Entry ${entry.entry_name} is new, no previous ranking`);
      }
    });
    
    debug('New moving entries:', newMovingEntries);
    debug('New highlighted entries:', newHighlightedEntries);
    
    setPrevRankings(prevRankMap);
    setMovingEntries(newMovingEntries);
    setHighlightedEntries(newHighlightedEntries);
    
    debug(`Applied animations to ${Object.keys(newHighlightedEntries).length} entries`);
    
    // Clear animations after 3 seconds
    debug('Setting animation cleanup timer (3 seconds)');
    const animationTimer = setTimeout(() => {
      debug('Animation timeout triggered, clearing animations');
      setHighlightedEntries({});
      setMovingEntries({});
      setAnimationComplete(true);
      
      // Create a new map with current rankings to use for future comparisons
      const currentRankMap: Record<string, number> = {};
      entries.forEach((entry, index) => {
        const rankValue = newRankings[index] ?? index + 1;
        currentRankMap[entry.entry_name] = typeof rankValue === 'string' ? Number(rankValue) : rankValue;
      });
      debug('Updating prevRankings with current rankings for next comparison:', currentRankMap);
      setPrevRankings(currentRankMap);
      
      // Also update prevEntries to match current entries
      debug('Updating prevEntries with current entries for next comparison');
      setPrevEntries([...entries]);
    }, 3000);
    
    return () => {
      debug('Cleaning up animation timer');
      clearTimeout(animationTimer);
    };
  }, [entries]);

  // Ensure entries are properly sorted by calculated_score only (no favorites sorting)
  const sortedEntries = [...entries].sort((a, b) => a.calculated_score - b.calculated_score);
  
  const rankings = calculateRankings(sortedEntries);
  const { displayPot, donation, payouts } = calculatePrizePool(sortedEntries);

  const limitedEntries = sortedEntries.slice(0, 15);

  // Filter entries based on search query
  const filteredEntries = searchQuery
    ? entries.filter(entry => 
        entry.entry_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrophyIcon className="h-5 w-5" />
            Top Teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No teams have been created for the current tournament.
          </p>
        </CardContent>
      </Card>
    );
  }

  debug(`Rendering ${limitedEntries.length} entries, with ${Object.keys(highlightedEntries).length} highlighted`);

  // If tournament hasn't started yet, just show a list of entry names
  if (!tournamentStarted) {
    const sortedEntries = [...entries].sort((a, b) => 
      a.entry_name.localeCompare(b.entry_name)
    );
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrophyIcon className="h-5 w-5" />
            Registered Teams
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1 md:p-6">
          <div className="space-y-1 max-h-[420px] overflow-y-auto pr-2">
            {sortedEntries.map((entry) => (
              <div 
                key={entry.entry_name}
                className="rounded-sm px-2 py-1 hover:bg-muted/50"
              >
                <div className="text-sm md:text-base font-medium">{entry.entry_name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2.5">
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Top Teams
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0.5 px-1 md:px-6 pb-1 md:pb-6">
        {/* Search Section */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for your team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 md:h-10 text-sm md:text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full bg-foreground/90 dark:bg-white/90"
              >
                <X className="h-3.5 w-3.5 text-background/90 dark:text-black/90" />
              </button>
            )}
          </div>
          {searchQuery && filteredEntries.length > 0 && (
            <div className="mt-2 space-y-1 max-h-[200px] md:max-h-[300px] overflow-y-auto">
              {filteredEntries.map(entry => {
                const currentRank = sortedEntries.findIndex(e => e.entry_name === entry.entry_name) + 1;
                const isFavorite = favoriteEntries.has(entry.entry_name);
                
                return (
                  <div 
                    key={entry.entry_name}
                    className="flex items-center w-full px-1 md:px-2 py-1 rounded-sm bg-muted/50"
                  >
                    <Star
                      className={`h-4 w-4 md:h-5 md:w-5 cursor-pointer transition-colors mr-1.5 md:-mr-1.5 ${
                        isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'
                      }`}
                      onClick={(e) => toggleFavorite(entry.entry_name, e)}
                    />
                    <span className={`${archivo.className} text-base md:text-lg text-foreground dark:text-muted-foreground w-6 md:w-12 text-center md:text-right`}>
                      {currentRank}
                    </span>
                    {tournamentStarted && payouts.get(entry.entry_name) !== undefined && (
                      <span className="text-green-600 w-12 md:w-16 text-center md:text-right text-sm md:text-base">
                        {(payouts.get(entry.entry_name) || 0) > 0 ? `$${payouts.get(entry.entry_name)}` : ''}
                      </span>
                    )}
                    <span className="font-medium flex-1 text-center text-sm md:text-base truncate">{entry.entry_name}</span>
                    <span className={`${archivo.className} w-10 md:w-12 text-center md:text-right text-lg ${
                      (typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) < 0 
                        ? 'text-red-600' 
                        : 'text-muted-foreground'
                    }`}>
                      {(typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) === 0 
                        ? 'E' 
                        : (typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) > 0 
                          ? `+${entry.display_score}`
                          : entry.display_score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {searchQuery && filteredEntries.length === 0 && (
            <p className="text-xs md:text-sm text-muted-foreground mt-2">No teams found matching "{searchQuery}"</p>
          )}
        </div>

        {/* Favorites Section */}
        {favoriteEntries.size > 0 && (
          <div className="mb-4 md:mb-6">
            <h3 className="text-xs md:text-sm font-medium text-muted-foreground mb-2">Favorites</h3>
            <div className="space-y-1 max-h-[200px] md:max-h-[300px] overflow-y-auto">
              {Array.from(favoriteEntries)
                .map(entryName => {
                  const entry = entries.find(e => e.entry_name === entryName);
                  if (!entry) return null;
                  const currentRank = sortedEntries.findIndex(e => e.entry_name === entryName) + 1;
                  return { entry, currentRank };
                })
                .filter((item): item is { entry: Entry; currentRank: number } => item !== null)
                .sort((a, b) => a.currentRank - b.currentRank)
                .map(({ entry, currentRank }) => {
                  const isMoving = !!movingEntries[entry.entry_name];
                  const isMovingUp = movingEntries[entry.entry_name] === 'up';
                  const isMovingDown = movingEntries[entry.entry_name] === 'down';
                  const isExpanded = expandedEntries.has(entry.entry_name);
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
                    >
                      <div 
                        className="flex items-center w-full px-1 md:px-2 py-1 rounded-sm bg-muted/50 cursor-pointer"
                        onClick={() => {
                          setExpandedEntries(prev => {
                            const next = new Set(prev);
                            if (next.has(entry.entry_name)) {
                              next.delete(entry.entry_name);
                            } else {
                              next.add(entry.entry_name);
                            }
                            return next;
                          });
                        }}
                      >
                        <Star
                          className="h-4 w-4 md:h-5 md:w-5 cursor-pointer text-yellow-400 fill-yellow-400 mr-1.5 md:-mr-1.5"
                          onClick={(e) => toggleFavorite(entry.entry_name, e)}
                        />
                        <motion.span 
                          className={`${archivo.className} text-base md:text-lg text-foreground dark:text-muted-foreground w-6 md:w-12 text-center md:text-right`}
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
                          {currentRank}
                        </motion.span>
                        {tournamentStarted && payouts.get(entry.entry_name) !== undefined && (
                          <span className="text-green-600 w-12 md:w-16 text-center md:text-right text-sm md:text-base">
                            {(payouts.get(entry.entry_name) || 0) > 0 ? `$${payouts.get(entry.entry_name)}` : ''}
                          </span>
                        )}
                        <span className="font-medium flex-1 text-center text-sm md:text-base truncate">{entry.entry_name}</span>
                        <motion.span 
                          className={`${archivo.className} w-10 md:w-12 text-center md:text-right text-lg ${
                            (typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) < 0 
                              ? 'text-red-600' 
                              : 'text-muted-foreground'
                          }`}
                          animate={isMoving ? {
                            scale: [1, 1.15, 1],
                            fontWeight: [400, 800, 400],
                          } : {}}
                          transition={{
                            duration: 3, 
                            times: [0, 0.5, 1]
                          }}
                        >
                          {(typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) === 0 
                            ? 'E' 
                            : (typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) > 0 
                              ? `+${entry.display_score}`
                              : entry.display_score}
                        </motion.span>
                      </div>
                      {/* Expanded content */}
                      <AnimatePresence mode="wait" initial={false}>
                        {isExpanded && (
                          <motion.div 
                            className="pl-6 md:pl-12 pr-2 md:pr-4 py-1 md:py-2"
                            initial={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 1, height: "auto" }}
                            style={{ 
                              position: 'relative', 
                              zIndex: 1,
                              visibility: isExpanded ? 'visible' : 'hidden'
                            }}
                          >
                            <div className="flex flex-wrap gap-x-2 md:gap-x-4 text-xs md:text-sm">
                              {[...(entry.allGolfers || [])]
                                .sort((a, b) => {
                                  const aIsCut = a.position === 'CUT';
                                  const bIsCut = b.position === 'CUT';
                                  if (aIsCut && !bIsCut) return 1;
                                  if (!aIsCut && bIsCut) return -1;
                                  // Both are not CUT or both are CUT, sort by score
                                  const scoreA = a.total === 'E' ? 0 : Number(String(a.total).replace('+', ''));
                                  const scoreB = b.total === 'E' ? 0 : Number(String(b.total).replace('+', ''));
                                  return scoreA - scoreB;
                                })
                                .map((golfer: GolferScore, golferIndex: number) => {
                                  const isCounted = golferIndex < 5;
                                  return (
                                    <div 
                                      key={golfer.player_id} 
                                      className={`flex items-center gap-1 ${!isCounted ? 'opacity-60 italic' : ''}`}
                                    >
                                      <span>
                                        {golfer.first_name} {golfer.last_name}
                                        {!isCounted && <span className="text-muted-foreground ml-1"></span>}
                                      </span>
                                      <span className={`${archivo.className} ${
                                        golfer.total.startsWith('-') ? 'text-red-600' : ''
                                      }`}>
                                        ({['CUT', 'WD', 'DQ'].includes(golfer.position) ? golfer.position : golfer.total})
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
            </div>
            <div className="h-[2px] bg-muted-foreground/30 dark:bg-muted-foreground/40 my-3 md:my-4" />
          </div>
        )}

        {/* Main Leaderboard */}
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {limitedEntries.map((entry, index) => {
              const isMoving = !!movingEntries[entry.entry_name];
              const isMovingUp = movingEntries[entry.entry_name] === 'up';
              const isMovingDown = movingEntries[entry.entry_name] === 'down';
              const isHighlighted = highlightedEntries[entry.entry_name];
              const isFavorite = favoriteEntries.has(entry.entry_name);
              
              const rowBgClass = animationComplete
                ? index % 2 === 1 ? 'dark:bg-zinc-800/90 bg-zinc-800/10' : ''
                : '';
              
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
                  className="space-y-1"
                >
                  {(() => {
                    let bgColor = undefined;
                    let borderColor = 'transparent';
                    let borderWidth = isMoving || isHighlighted ? '2px' : '0px';
                    let borderStyle = isMoving || isHighlighted ? 'solid' : 'none';
                    
                    if (isMoving) {
                      borderColor = '#fbbf24';
                      bgColor = isMovingUp
                        ? 'rgba(16, 185, 129, 0.3)'
                        : isMovingDown
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(251, 191, 36, 0.3)';
                    } else if (isHighlighted) {
                      borderColor = '#fbbf24';
                      bgColor = 'rgba(251, 191, 36, 0.1)';
                    }

                    return (
                      <div 
                        style={{ 
                          backgroundColor: bgColor,
                          borderColor,
                          borderWidth,
                          borderStyle,
                        }}
                        className={`cursor-pointer hover:bg-muted/50 rounded-sm ${rowBgClass} ${(isHighlighted || isMoving) ? 'moving-border' : ''}`}
                        onClick={() => {
                          setExpandedEntries(prev => {
                            const next = new Set(prev);
                            if (next.has(entry.entry_name)) {
                              next.delete(entry.entry_name);
                            } else {
                              next.add(entry.entry_name);
                            }
                            return next;
                          });
                        }}
                      >
                        <div className="flex items-center w-full px-1 md:px-2">
                          <Star
                            className={`h-4 w-4 md:h-5 md:w-5 cursor-pointer transition-colors mr-1.5 md:-mr-1.5 ${
                              isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'
                            }`}
                            onClick={(e) => toggleFavorite(entry.entry_name, e)}
                          />
                          <motion.span 
                            className={`${archivo.className} text-base md:text-lg text-foreground dark:text-muted-foreground w-6 md:w-12 text-center md:text-right`}
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
                            {rankings[index] || '\u00A0'}
                          </motion.span>
                          {tournamentStarted && payouts.get(entry.entry_name) !== undefined && (
                            <span className="text-green-600 w-12 md:w-16 text-center md:text-right text-sm md:text-base">
                              {(payouts.get(entry.entry_name) || 0) > 0 ? `$${payouts.get(entry.entry_name)}` : ''}
                            </span>
                          )}
                          <span className="font-medium flex-1 text-center text-sm md:text-base truncate">{entry.entry_name}</span>
                          <motion.span 
                            className={`${archivo.className} w-10 md:w-12 text-center md:text-right text-lg ${
                              (typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) < 0 
                                ? 'text-red-600' 
                                : 'text-muted-foreground'
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
                            {(typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) === 0 
                              ? 'E' 
                              : (typeof entry.display_score === 'string' ? Number(entry.display_score) : entry.display_score) > 0 
                                ? `+${entry.display_score}`
                                : entry.display_score}
                          </motion.span>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Expanded content */}
                  <AnimatePresence mode="wait" initial={false}>
                    {expandedEntries.has(entry.entry_name) && (
                      <motion.div 
                        className="pl-6 md:pl-12 pr-2 md:pr-4 py-1 md:py-2"
                        initial={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 1, height: "auto" }}
                        style={{ 
                          position: 'relative', 
                          zIndex: 1,
                          visibility: expandedEntries.has(entry.entry_name) ? 'visible' : 'hidden'
                        }}
                      >
                        <div className="flex flex-wrap gap-x-2 md:gap-x-4 text-xs md:text-sm">
                          {[...(entry.allGolfers || [])]
                            .sort((a, b) => {
                              const aIsCut = a.position === 'CUT';
                              const bIsCut = b.position === 'CUT';
                              if (aIsCut && !bIsCut) return 1;
                              if (!aIsCut && bIsCut) return -1;
                              // Both are not CUT or both are CUT, sort by score
                              const scoreA = a.total === 'E' ? 0 : Number(String(a.total).replace('+', ''));
                              const scoreB = b.total === 'E' ? 0 : Number(String(b.total).replace('+', ''));
                              return scoreA - scoreB;
                            })
                            .map((golfer: GolferScore, golferIndex: number) => {
                              const isCounted = golferIndex < 5;
                              return (
                                <div 
                                  key={golfer.player_id} 
                                  className={`flex items-center gap-1 ${!isCounted ? 'opacity-60 italic' : ''}`}
                                >
                                  <span>
                                    {golfer.first_name} {golfer.last_name}
                                    {!isCounted && <span className="text-muted-foreground ml-1"></span>}
                                  </span>
                                  <span className={`${archivo.className} ${
                                    golfer.total.startsWith('-') ? 'text-red-600' : ''
                                  }`}>
                                    ({['CUT', 'WD', 'DQ'].includes(golfer.position) ? golfer.position : golfer.total})
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}