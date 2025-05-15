'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { calculateDisplayScore, type GolferScore, calculateRankings, type Entry } from '@/utils/scoring';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type TournamentEntry = {
  id: string;
  entry_name: string;
  email: string;
  tier1_golfer1: string;
  tier1_golfer2: string;
  tier2_golfer1: string;
  tier2_golfer2: string;
  tier3_golfer1: string;
  tier3_golfer2: string;
  tier4_golfer1: string;
  tier5_golfer1: string;
  calculated_score?: number;
  display_score?: number;
  topFiveGolfers?: any[];
};

type Golfer = {
  player_id: string;
  first_name: string;
  last_name: string;
  is_amateur: boolean;
};

type TieredGolfers = {
  tier1: Golfer[];
  tier2: Golfer[];
  tier3: Golfer[];
  tier4: Golfer[];
  tier5: Golfer[];
};

type HistoricalEntry = {
  entry_name: string;
  tournament_name: string;
  tournament_start_date: string;
  calculated_score: number;
  tournament_status: string;
  is_active: boolean;
  entry_position?: string;
  entry_total?: string;
  golfers: Array<{
    player_id: string;
    first_name: string;
    last_name: string;
    total: string;
    position: string;
  }>;
};

type DbEntry = {
  entry_name: string;
  calculated_score: number;
  entry_position: string;
  entry_total: string;
  t1g1_score?: string;
  t1g2_score?: string;
  t2g1_score?: string;
  t2g2_score?: string;
  t3g1_score?: string;
  t3g2_score?: string;
  t4g1_score?: string;
  t5g1_score?: string;
  tournaments: {
    name: string;
    start_date: string;
    status: string;
    is_active: boolean;
  };
  [key: string]: any;
};

type WithdrawnGolferEntry = {
  entryId: string;
  entryName: string;
  withdrawnGolfers: {
    playerId: string;
    firstName: string;
    lastName: string;
    tier: string;
  }[];
};

export default function UserDashboard() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [historicalEntries, setHistoricalEntries] = useState<HistoricalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TournamentEntry | null>(null);
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [golfers, setGolfers] = useState<TieredGolfers>({
    tier1: [],
    tier2: [],
    tier3: [],
    tier4: [],
    tier5: []
  });
  const [withdrawnGolferEntries, setWithdrawnGolferEntries] = useState<WithdrawnGolferEntry[]>([]);
  const [tournamentStatus, setTournamentStatus] = useState<string>('');

  // Update navigation badge when withdrawn golfers change
  useEffect(() => {
    const dashboardLink = document.querySelector('a[href="/dashboard"]');
    if (dashboardLink) {
      const existingBadge = dashboardLink.querySelector('.withdrawn-badge');
      if (withdrawnGolferEntries.length > 0) {
        if (!existingBadge) {
          const badge = document.createElement('div');
          badge.className = 'withdrawn-badge absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full';
          (dashboardLink as HTMLElement).style.position = 'relative';
          dashboardLink.appendChild(badge);
        }
      } else {
        existingBadge?.remove();
      }
    }
  }, [withdrawnGolferEntries]);

  // Helper function to add ordinal suffix to position numbers
  const getOrdinalSuffix = (position: string) => {
    // Handle tied positions that start with T
    const cleanPos = position.startsWith('T') ? position.substring(1) : position;
    const num = parseInt(cleanPos);
    
    if (isNaN(num)) return position; // Return original if not a number
    
    if (num % 100 >= 11 && num % 100 <= 13) {
      return `${position}th`;
    }
    
    switch (num % 10) {
      case 1: return `${position}st`;
      case 2: return `${position}nd`;
      case 3: return `${position}rd`;
      default: return `${position}th`;
    }
  };

  const fetchEntries = async () => {
    try {
      // First get the active tournament
      const { data: activeTournament } = await supabase
        .from('tournaments')
        .select('id, status')
        .eq('is_active', true)
        .single();

      if (!activeTournament) {
        setLoading(false);
        return;
      }

      setTournamentStatus(activeTournament.status);

      // Fetch all entries for the user
      const { data: entriesData } = await supabase
        .from('entries')
        .select(`
          *,
          tournaments!inner(
            name,
            start_date,
            status,
            is_active
          )
        `)
        .eq('email', session?.user?.email);

      if (entriesData) {
        // Split entries into active and historical
        const activeEntries = entriesData.filter(entry => entry.tournament_id === activeTournament.id);
        setEntries(activeEntries);

        // Get current scores for all golfers
        const { data: scoresData, error: scoresError } = await supabase
          .from('golfer_scores')
          .select('player_id, first_name, last_name, total, position');

        if (scoresError) {
          console.error('Error fetching scores:', scoresError);
          return;
        }

        // Create a map of player_id to their current score info
        const scoreMap = new Map(
          scoresData.map(score => [score.player_id, score])
        );

        // Transform historical entries data to include golfer details
        const formattedHistoricalEntries = entriesData
          .filter(entry => !entry.tournaments.is_active)
          .map(entry => {
            const golferIds = [
              entry.tier1_golfer1, entry.tier1_golfer2,
              entry.tier2_golfer1, entry.tier2_golfer2,
              entry.tier3_golfer1, entry.tier3_golfer2,
              entry.tier4_golfer1,
              entry.tier5_golfer1
            ];

            // For historical entries, we use the stored scores
            const storedScores = [
              entry.t1g1_score, entry.t1g2_score,
              entry.t2g1_score, entry.t2g2_score,
              entry.t3g1_score, entry.t3g2_score,
              entry.t4g1_score,
              entry.t5g1_score
            ];

            const golfers = golferIds.map((id, index) => {
              const score = scoreMap.get(id);
              
              // For historical entries, use the stored score if available
              const total = storedScores && storedScores[index] 
                ? storedScores[index] || 'N/A'
                : score?.total || 'N/A';
              
              return {
                player_id: id,
                first_name: score?.first_name || 'Unknown',
                last_name: score?.last_name || 'Golfer',
                total: total,
                position: score?.position || '-'
              };
            });

            return {
              entry_name: entry.entry_name,
              tournament_name: entry.tournaments.name,
              tournament_start_date: entry.tournaments.start_date,
              calculated_score: entry.calculated_score,
              tournament_status: entry.tournaments.status,
              is_active: entry.tournaments.is_active,
              entry_position: entry.entry_position,
              entry_total: entry.entry_total,
              golfers
            };
          });

        setHistoricalEntries(formattedHistoricalEntries);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching entries:', error);
      setLoading(false);
    }
  };

  const fetchGolfers = async () => {
    try {
      const { data: activeTournament } = await supabase
        .from('tournaments')
        .select('id')
        .eq('is_active', true)
        .single();

      if (!activeTournament) return;

      const { data: golfersData } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name, is_amateur, odds')
        .eq('tournament_id', activeTournament.id);

      if (!golfersData) return;

      // Sort golfers by odds
      const sortedGolfers = golfersData.sort((a, b) => {
        if (!a.odds && !b.odds) return 0;
        if (!a.odds) return 1;
        if (!b.odds) return -1;
        return parseInt(a.odds) - parseInt(b.odds);
      });

      // Organize golfers into tiers
      const tieredGolfers = {
        tier1: sortedGolfers.slice(0, 8),
        tier2: sortedGolfers.slice(8, 30),
        tier3: sortedGolfers.slice(30, 59),
        tier4: sortedGolfers.slice(59, 95),
        tier5: sortedGolfers.slice(95)
      };

      setGolfers(tieredGolfers);
    } catch (error) {
      console.error('Error fetching golfers:', error);
    }
  };

  const checkForWithdrawnGolfers = async () => {
    try {
      // Get active tournament
      const { data: activeTournament } = await supabase
        .from('tournaments')
        .select('id')
        .eq('is_active', true)
        .single();

      if (!activeTournament) return;

      // Get only the logged-in user's entries for active tournament
      const { data: entries } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          tier1_golfer1, tier1_golfer2,
          tier2_golfer1, tier2_golfer2,
          tier3_golfer1, tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1
        `)
        .eq('tournament_id', activeTournament.id)
        .eq('email', session?.user?.email);

      if (!entries) return;

      // Get all golfer details from golfer_scores for any golfer that might be in an entry
      const allGolferIds = new Set();
      entries.forEach(entry => {
        [
          entry.tier1_golfer1, entry.tier1_golfer2,
          entry.tier2_golfer1, entry.tier2_golfer2,
          entry.tier3_golfer1, entry.tier3_golfer2,
          entry.tier4_golfer1, entry.tier5_golfer1
        ].forEach(id => {
          if (id) allGolferIds.add(id);
        });
      });

      const { data: allGolfers } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name, tournament_id')
        .in('player_id', Array.from(allGolferIds));

      if (!allGolfers) return;

      const golferMap = new Map(allGolfers.map(g => [g.player_id, g]));

      // Check each entry for golfers not in active tournament
      const affectedEntries: WithdrawnGolferEntry[] = entries
        .map(entry => {
          const withdrawnGolfersInEntry: {
            playerId: string;
            firstName: string;
            lastName: string;
            tier: string;
          }[] = [];
          
          // Check each tier
          const checkGolfer = (golferId: string, tier: string) => {
            const golfer = golferMap.get(golferId);
            if (golfer && golfer.tournament_id !== activeTournament.id) {
              withdrawnGolfersInEntry.push({
                playerId: golferId,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: tier
              });
            }
          };

          checkGolfer(entry.tier1_golfer1, 'Tier 1');
          checkGolfer(entry.tier1_golfer2, 'Tier 1');
          checkGolfer(entry.tier2_golfer1, 'Tier 2');
          checkGolfer(entry.tier2_golfer2, 'Tier 2');
          checkGolfer(entry.tier3_golfer1, 'Tier 3');
          checkGolfer(entry.tier3_golfer2, 'Tier 3');
          checkGolfer(entry.tier4_golfer1, 'Tier 4');
          checkGolfer(entry.tier5_golfer1, 'Tier 5');

          if (withdrawnGolfersInEntry.length > 0) {
            return {
              entryId: entry.id,
              entryName: entry.entry_name,
              withdrawnGolfers: withdrawnGolfersInEntry
            };
          }
          return null;
        })
        .filter((entry): entry is WithdrawnGolferEntry => entry !== null);

      setWithdrawnGolferEntries(affectedEntries);
    } catch (error) {
      console.error('Error checking for withdrawn golfers:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchEntries(), fetchGolfers()]);
      await checkForWithdrawnGolfers();
    };
    loadData();
  }, [session?.user?.email]);

  const handleGolferClick = (entry: TournamentEntry, golferId: string, tier: string) => {
    if (tournamentStatus === 'In Progress' || tournamentStatus === 'Complete') {
      return;
    }
    setSelectedEntry(entry);
    setSelectedGolferId(golferId);
    setSelectedTier(tier);
    setShowEditDialog(true);
  };

  const handleGolferReplace = async (newGolferId: string) => {
    if (!selectedEntry || !selectedGolferId || !selectedTier) return;

    const golferField = `${selectedTier}_golfer${selectedGolferId === selectedEntry[`${selectedTier}_golfer1` as keyof TournamentEntry] ? '1' : '2'}` as keyof TournamentEntry;
    const updateData = {
      [golferField]: newGolferId
    };

    try {
      const { error } = await supabase
        .from('entries')
        .update(updateData)
        .eq('id', selectedEntry.id);

      if (error) throw error;

      // Refresh entries
      await fetchEntries();
      
      // Check if the entry still has any withdrawn golfers
      const updatedEntry = entries.find(e => e.id === selectedEntry.id);
      if (updatedEntry) {
        const hasWithdrawnGolfers = withdrawnGolferEntries.some(entry => 
          entry.entryId === selectedEntry.id && 
          entry.withdrawnGolfers.some(g => g.playerId === selectedGolferId)
        );

        if (hasWithdrawnGolfers) {
          // Remove this entry from withdrawnGolferEntries if it no longer has any withdrawn golfers
          setWithdrawnGolferEntries(prev => 
            prev.filter(entry => entry.entryId !== selectedEntry.id)
          );
        }
      }

      setShowEditDialog(false);
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  };

  const getGolferName = (golferId: string) => {
    // First check if this is a withdrawn golfer
    const withdrawnEntry = withdrawnGolferEntries.find(entry => 
      entry.withdrawnGolfers.some(g => g.playerId === golferId)
    );
    if (withdrawnEntry) {
      const withdrawnGolfer = withdrawnEntry.withdrawnGolfers.find(g => g.playerId === golferId);
      if (withdrawnGolfer) {
        return `${withdrawnGolfer.firstName} ${withdrawnGolfer.lastName}`;
      }
    }

    // If not a withdrawn golfer, check the active golfers
    const allGolfers = [
      ...golfers.tier1,
      ...golfers.tier2,
      ...golfers.tier3,
      ...golfers.tier4,
      ...golfers.tier5
    ];
    const golfer = allGolfers.find(g => g.player_id === golferId);
    return golfer ? `${golfer.first_name} ${golfer.last_name}${golfer.is_amateur ? ' (A)' : ''}` : 'Unknown Golfer';
  };

  const isGolferWithdrawn = (golferId: string) => {
    return withdrawnGolferEntries.some(entry => 
      entry.withdrawnGolfers.some(g => g.playerId === golferId)
    );
  };

  if (loading) {
    return <div>Loading your entries...</div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">My Dashboard</h1>
      
      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="current" className="flex-1 sm:flex-none">Current Tournament</TabsTrigger>
          <TabsTrigger value="historical" className="flex-1 sm:flex-none">Historical Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          {withdrawnGolferEntries.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Entries with Withdrawn Golfers</AlertTitle>
              <AlertDescription>
                {withdrawnGolferEntries.map(entry => (
                  <div key={entry.entryId} className="mt-2">
                    <p className="font-medium">{entry.entryName}</p>
                    <ul className="list-disc list-inside">
                      {entry.withdrawnGolfers.map(golfer => (
                        <li key={golfer.playerId}>
                          {golfer.firstName} {golfer.lastName} ({golfer.tier})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>My Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  You can click on any golfer's name to replace them with another golfer from the same tier. 
                  This is available until the tournament status changes to "In Progress".
                </p>
                {entries.map(entry => (
                  <Card key={entry.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold">{entry.entry_name}</h3>
                          <p className="text-sm text-muted-foreground">{entry.email}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Tier 1</h4>
                            <div className="space-y-2">
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier1_golfer1) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier1_golfer1, 'tier1')}
                              >
                                {getGolferName(entry.tier1_golfer1)}
                              </div>
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier1_golfer2) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier1_golfer2, 'tier1')}
                              >
                                {getGolferName(entry.tier1_golfer2)}
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Tier 2</h4>
                            <div className="space-y-2">
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier2_golfer1) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier2_golfer1, 'tier2')}
                              >
                                {getGolferName(entry.tier2_golfer1)}
                              </div>
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier2_golfer2) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier2_golfer2, 'tier2')}
                              >
                                {getGolferName(entry.tier2_golfer2)}
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Tier 3</h4>
                            <div className="space-y-2">
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier3_golfer1) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier3_golfer1, 'tier3')}
                              >
                                {getGolferName(entry.tier3_golfer1)}
                              </div>
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier3_golfer2) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier3_golfer2, 'tier3')}
                              >
                                {getGolferName(entry.tier3_golfer2)}
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Tier 4 & 5</h4>
                            <div className="space-y-2">
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier4_golfer1) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier4_golfer1, 'tier4')}
                              >
                                {getGolferName(entry.tier4_golfer1)}
                              </div>
                              <div 
                                className={`p-2 border rounded ${
                                  tournamentStatus === 'In Progress' || tournamentStatus === 'Complete' 
                                    ? '' 
                                    : 'cursor-pointer hover:bg-muted'
                                } ${
                                  isGolferWithdrawn(entry.tier5_golfer1) ? 'border-2 border-red-500' : ''
                                }`}
                                onClick={() => handleGolferClick(entry, entry.tier5_golfer1, 'tier5')}
                              >
                                {getGolferName(entry.tier5_golfer1)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historical">
          {historicalEntries.length > 0 && (
            <Card className="md:rounded-lg rounded-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg md:text-xl">Historical Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 md:space-y-4">
                  {historicalEntries.map((entry) => (
                    <div 
                      key={entry.entry_name}
                      className="flex flex-col md:flex-row justify-between p-3 md:p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between md:justify-start md:gap-4">
                          <h3 className="font-semibold">{entry.entry_name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.tournament_name} - {new Date(entry.tournament_start_date).getFullYear()}
                        </p>
                        <div className="flex flex-wrap gap-1.5 md:gap-2 text-[11px] md:text-xs">
                          {entry.golfers.map(golfer => (
                            <span 
                              key={golfer.player_id} 
                              className="bg-muted px-1.5 md:px-2 py-0.5 md:py-1 rounded whitespace-nowrap"
                            >
                              {golfer.first_name} {golfer.last_name} ({golfer.total})
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right mt-2 md:mt-0">
                        {entry.entry_position && (
                          <p className="font-medium">{getOrdinalSuffix(entry.entry_position)} Place</p>
                        )}
                        {entry.entry_total && (
                          <p className="text-sm text-muted-foreground">Final Score: {entry.entry_total}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Replace Golfer for {selectedTier?.replace('tier', 'Tier ')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Select a new golfer from the same tier to replace {selectedGolferId && getGolferName(selectedGolferId)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
            {selectedTier && golfers[selectedTier as keyof TieredGolfers].map(golfer => (
              <div 
                key={golfer.player_id}
                className="flex items-center space-x-2 p-1.5 border rounded cursor-pointer hover:bg-muted"
                onClick={() => handleGolferReplace(golfer.player_id)}
              >
                <Checkbox 
                  id={golfer.player_id}
                  checked={golfer.player_id === selectedGolferId}
                  onCheckedChange={() => handleGolferReplace(golfer.player_id)}
                />
                <label htmlFor={golfer.player_id} className="text-sm cursor-pointer">
                  {golfer.first_name} {golfer.last_name}{golfer.is_amateur ? ' (A)' : ''}
                </label>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 