'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MdOutlineEmail } from "react-icons/md";
import { getEmailTemplate } from '@/lib/email-template';
import { calculateDisplayScore, type GolferScore, calculateRankings, type Entry, calculatePrizePool } from '@/utils/scoring';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

// Set to false to disable logging
const DEBUG = false;

type WithdrawnGolferEntry = {
  entryId: string;
  entryName: string;
  email: string;
  withdrawnGolfers: {
    playerId: string;
    firstName: string;
    lastName: string;
    tier: string;
  }[];
};

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
  status?: string;
  tee_time?: string;
};

type TieredGolfers = {
  tier1: Golfer[];
  tier2: Golfer[];
  tier3: Golfer[];
  tier4: Golfer[];
  tier5: Golfer[];
};

export default function AdminDashboard() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [withdrawnGolferEntries, setWithdrawnGolferEntries] = useState<WithdrawnGolferEntry[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [initialAuthChecked, setInitialAuthChecked] = useState(false);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [golfers, setGolfers] = useState<TieredGolfers>({
    tier1: [],
    tier2: [],
    tier3: [],
    tier4: [],
    tier5: []
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TournamentEntry | null>(null);
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // One-time auth check on component mount
  useEffect(() => {
    // Only run this effect once
    if (initialAuthChecked || loading) return;

    // Check auth on first load
    if (!session) {
      if (DEBUG) console.log('No session, redirecting to home');
      setIsRedirecting(true);
      router.replace('/');
      return;
    }

    if (session.user.user_metadata?.role !== 'admin') {
      if (DEBUG) console.log('User is not admin, redirecting to home');
      setIsRedirecting(true);
      router.replace('/');
      return;
    }

    // Mark auth as checked so we don't repeat
    setInitialAuthChecked(true);
    
    // Initial data fetch
    fetchTournaments();
  }, [loading, session]);

  // Function to fetch tournaments without triggering additional auth checks
  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching tournaments:', error);
        return;
      }
      
      setTournaments(data || []);
      await checkForWithdrawnGolfers();
    } catch (error) {
      console.error('Error fetching data:', error);
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

      // Get all entries for active tournament
      const { data: entries } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          email,
          tier1_golfer1, tier1_golfer2,
          tier2_golfer1, tier2_golfer2,
          tier3_golfer1, tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1
        `)
        .eq('tournament_id', activeTournament.id);

      if (!entries) return;

      // Get all golfers in the active tournament
      const { data: activeGolfers } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name')
        .eq('tournament_id', activeTournament.id);

      if (!activeGolfers) return;

      const activeGolferIds = new Set(activeGolfers.map(g => g.player_id));

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
        .select('player_id, first_name, last_name')
        .in('player_id', Array.from(allGolferIds));

      if (!allGolfers) return;

      const golferMap = new Map(allGolfers.map(g => [g.player_id, g]));

      // Check each entry for golfers not in active tournament
      const affectedEntries: WithdrawnGolferEntry[] = entries
        .map(entry => {
          const withdrawnGolfersInEntry = [];
          
          // Check each tier
          if (!activeGolferIds.has(entry.tier1_golfer1)) {
            const golfer = golferMap.get(entry.tier1_golfer1);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier1_golfer1,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 1'
              });
            }
          }
          if (!activeGolferIds.has(entry.tier1_golfer2)) {
            const golfer = golferMap.get(entry.tier1_golfer2);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier1_golfer2,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 1'
              });
            }
          }
          if (!activeGolferIds.has(entry.tier2_golfer1)) {
            const golfer = golferMap.get(entry.tier2_golfer1);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier2_golfer1,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 2'
              });
            }
          }
          if (!activeGolferIds.has(entry.tier2_golfer2)) {
            const golfer = golferMap.get(entry.tier2_golfer2);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier2_golfer2,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 2'
              });
            }
          }
          if (!activeGolferIds.has(entry.tier3_golfer1)) {
            const golfer = golferMap.get(entry.tier3_golfer1);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier3_golfer1,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 3'
              });
            }
          }
          if (!activeGolferIds.has(entry.tier3_golfer2)) {
            const golfer = golferMap.get(entry.tier3_golfer2);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier3_golfer2,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 3'
              });
            }
          }
          if (!activeGolferIds.has(entry.tier4_golfer1)) {
            const golfer = golferMap.get(entry.tier4_golfer1);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier4_golfer1,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 4'
              });
            }
          }
          if (!activeGolferIds.has(entry.tier5_golfer1)) {
            const golfer = golferMap.get(entry.tier5_golfer1);
            if (golfer) {
              withdrawnGolfersInEntry.push({
                playerId: entry.tier5_golfer1,
                firstName: golfer.first_name,
                lastName: golfer.last_name,
                tier: 'Tier 5'
              });
            }
          }

          if (withdrawnGolfersInEntry.length > 0) {
            return {
              entryId: entry.id,
              entryName: entry.entry_name,
              email: entry.email,
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

  const handleSendWithdrawnGolferEmail = async (entry: WithdrawnGolferEntry) => {
    const tournament = tournaments.find(t => t.is_active);
    if (!tournament) return;

    const golferList = entry.withdrawnGolfers
      .map(g => `${g.firstName} ${g.lastName} (${g.tier})`)
      .join(', ');

    const emailBody = `Hello,

We noticed that your entry "${entry.entryName}" for ${tournament.name} ${tournament.year} has the following golfers who are no longer in the tournament:

${golferList}

Please visit ${window.location.origin}/create-team to update your entry with replacement golfers.

Best regards,
Major Pools Team`;

    const mailtoLink = `mailto:${encodeURIComponent(entry.email)}?subject=${encodeURIComponent(`Action Required: Update Your ${tournament.name} ${tournament.year} Entry`)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
  };

  const handleActivateTournament = async (id: string, currentStatus: boolean) => {
    await supabase
      .from('tournaments')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    
    // Fetch tournaments without triggering auth checks
    fetchTournaments();
  };

  const handleSendInvite = async (tournamentName: string, tournamentYear: number) => {
    // Get all emails from email_list instead of entries
    const { data: emailData } = await supabase
      .from('email_list')
      .select('email');
    
    const uniqueEmails = Array.from(new Set(emailData?.map(entry => entry.email) || []));
    
    const createTeamUrl = `${window.location.origin}/create-team`;
    const emailBody = getEmailTemplate(tournamentName, createTeamUrl, tournamentYear);
    const emailSubject = `${tournamentName} ${tournamentYear} - Welcome & Submission Form`;
    
    // Use default mail client (mailto link)
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(uniqueEmails.join(','))}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
  };

  const handleEmailAllEntries = async () => {
    try {
      // Get active tournament
      const activeTournament = tournaments.find(t => t.is_active);
      if (!activeTournament) return;

      // Get all entries for active tournament
      const { data: entriesData } = await supabase
        .from('entries')
        .select('email')
        .eq('tournament_id', activeTournament.id);

      if (entriesData) {
        // Get unique emails
        const uniqueEmails = Array.from(new Set(entriesData.map(entry => entry.email)));

        // Create email content
        const emailSubject = `${activeTournament.name} ${activeTournament.year} - Tournament Update`;
        const emailBody = `Hello Major Pools Players,

Thank you for participating in the ${activeTournament.name} ${activeTournament.year} pool.

You can view the current leaderboard at ${window.location.origin}/leaderboard

Best regards,
Major Pools Team`;

        // Create Gmail URL with BCC to all entries
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(uniqueEmails.join(','))}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(gmailUrl, '_blank');
      }
    } catch (error) {
      console.error('Error emailing entries:', error);
    }
  };

  const handleEmailAllWithdrawnGolfers = async () => {
    const tournament = tournaments.find(t => t.is_active);
    if (!tournament) return;

    // Get emails only from entries in this tournament
    const { data: entriesData } = await supabase
      .from('entries')
      .select('email')
      .eq('tournament_id', tournament.id);
    
    const uniqueEmails = Array.from(new Set(entriesData?.map(entry => entry.email) || []));

    // Create email content
    const emailSubject = `Action Required: Update Your ${tournament.name} ${tournament.year} Entry`;
    const emailBody = `Hello Major Pools Players,

We noticed that some entries for ${tournament.name} ${tournament.year} have golfers who are no longer in the tournament.

Please visit ${window.location.origin}/create-team to update your entry with replacement golfers.

Best regards,
Major Pools Team`;

    // Create mailto link with BCC to all affected entries
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(uniqueEmails.join(','))}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
  };

  const fetchEntries = async () => {
    try {
      const { data: activeTournament } = await supabase
        .from('tournaments')
        .select('id')
        .eq('is_active', true)
        .single();

      if (!activeTournament) return;

      const { data: entriesData } = await supabase
        .from('entries')
        .select('*')
        .eq('tournament_id', activeTournament.id);

      if (entriesData) {
        setEntries(entriesData);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
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
        .select('player_id, first_name, last_name, is_amateur, odds, status, tee_time')
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

  useEffect(() => {
    fetchEntries();
    fetchGolfers();
  }, []);

  const handleGolferClick = (entry: TournamentEntry, golferId: string, tier: string) => {
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
      fetchEntries();
      setShowEditDialog(false);
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  };

  const getGolferName = (golferId: string) => {
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

  const handleCompleteTournament = async (tournamentId: string) => {
    try {
      console.log('Starting tournament completion for ID:', tournamentId);
      
      // 1. Get all entries for this tournament with calculated_score and display_score
      const { data: entries, error: entriesError } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          calculated_score,
          entry_total,
          tier1_golfer1, tier1_golfer2,
          tier2_golfer1, tier2_golfer2,
          tier3_golfer1, tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1
        `)
        .eq('tournament_id', tournamentId)
        .order('calculated_score', { ascending: true });

      if (entriesError) {
        console.error('Error fetching entries:', {
          error: entriesError,
          tournamentId,
          timestamp: new Date().toISOString()
        });
        throw entriesError;
      }

      if (!entries || entries.length === 0) {
        console.error('No entries found for tournament:', {
          tournamentId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 2. Calculate final rankings and positions
      const entriesForRankings = entries.map(entry => ({
        entry_name: entry.entry_name,
        calculated_score: entry.calculated_score,
        display_score: 0,
        topFiveGolfers: []
      }));

      // Create a map of entry name to ranking, but keep T for all tied positions
      const rankingMap = new Map();
      let currentRank = 1;
      let currentScore = entries[0]?.calculated_score;
      let tiedEntries = [entries[0]];

      entries.forEach((entry, index) => {
        if (index === 0) return; // Skip first entry as it's already handled

        if (entry.calculated_score === currentScore) {
          // It's a tie
          tiedEntries.push(entry);
        } else {
          // New score - handle previous group
          if (tiedEntries.length > 1) {
            // Was a tie - mark all with T
            tiedEntries.forEach(e => {
              rankingMap.set(e.id, `T${currentRank}`);
            });
          } else {
            // Single entry
            rankingMap.set(tiedEntries[0].id, currentRank.toString());
          }
          
          // Start new group
          currentRank = index + 1;
          currentScore = entry.calculated_score;
          tiedEntries = [entry];
        }
      });

      // Handle last group
      if (tiedEntries.length > 1) {
        tiedEntries.forEach(e => {
          rankingMap.set(e.id, `T${currentRank}`);
        });
      } else if (tiedEntries.length === 1) {
        rankingMap.set(tiedEntries[0].id, currentRank.toString());
      }

      // 3. Get all golfer scores with the same fields as leaderboard
      const { data: scores, error: scoresError } = await supabase
        .from('golfer_scores')
        .select('player_id, first_name, last_name, total, current_round_score, thru, position, status, tee_time');

      if (scoresError) throw scoresError;

      // Create scores map for quick lookup - same as leaderboard
      const scoreMap = new Map(scores.map(score => [score.player_id, score]));

      // 4. Calculate payouts
      const { payouts } = calculatePrizePool(entriesForRankings);

      // 5. Update each entry with scores, ranking, and payout
      for (const entry of entries) {
        // Transform entry data exactly like leaderboard does
        const golfers = [
          entry.tier1_golfer1, entry.tier1_golfer2,
          entry.tier2_golfer1, entry.tier2_golfer2,
          entry.tier3_golfer1, entry.tier3_golfer2,
          entry.tier4_golfer1,
          entry.tier5_golfer1
        ].map(id => {
          const score = scoreMap.get(id);
          return {
            player_id: id,
            first_name: score?.first_name || 'Unknown',
            last_name: score?.last_name || 'Golfer',
            total: score?.total || 'N/A',
            current_round_score: score?.current_round_score || '-',
            thru: score?.thru === '-' && ['CUT', 'WD', 'DQ'].includes((score?.position || '') as string) 
              ? score?.position 
              : score?.thru || '-',
            position: score?.position || '-',
            status: score?.status || '-',
            tee_time: score?.tee_time || '-'
          };
        });

        // Calculate display score using the same function as quick leaderboard
        const displayScore = calculateDisplayScore(golfers);

        const updateData = {
          t1g1_score: scoreMap.get(entry.tier1_golfer1)?.total,
          t1g2_score: scoreMap.get(entry.tier1_golfer2)?.total,
          t2g1_score: scoreMap.get(entry.tier2_golfer1)?.total,
          t2g2_score: scoreMap.get(entry.tier2_golfer2)?.total,
          t3g1_score: scoreMap.get(entry.tier3_golfer1)?.total,
          t3g2_score: scoreMap.get(entry.tier3_golfer2)?.total,
          t4g1_score: scoreMap.get(entry.tier4_golfer1)?.total,
          t5g1_score: scoreMap.get(entry.tier5_golfer1)?.total,
          entry_total: displayScore.toString(),
          entry_position: rankingMap.get(entry.id),
          payout: payouts.get(entry.entry_name) || 0
        };

        await supabase.from('entries').update(updateData).eq('id', entry.id);
      }

      // 6. Get tournament info for email
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('name, year')
        .eq('id', tournamentId)
        .single();

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // 7. Get updated entries with their saved totals
      const { data: updatedEntries } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          entry_total,
          entry_position,
          payout,
          calculated_score,
          tier1_golfer1, tier1_golfer2,
          tier2_golfer1, tier2_golfer2,
          tier3_golfer1, tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1
        `)
        .eq('tournament_id', tournamentId)
        .order('calculated_score', { ascending: true });

      // 8. Prepare and send results email
      const topEntries = updatedEntries?.slice(0, 10).map(entry => {
        const allGolfers = [
          { id: entry.tier1_golfer1, score: scoreMap.get(entry.tier1_golfer1)?.total, status: scoreMap.get(entry.tier1_golfer1)?.status },
          { id: entry.tier1_golfer2, score: scoreMap.get(entry.tier1_golfer2)?.total, status: scoreMap.get(entry.tier1_golfer2)?.status },
          { id: entry.tier2_golfer1, score: scoreMap.get(entry.tier2_golfer1)?.total, status: scoreMap.get(entry.tier2_golfer1)?.status },
          { id: entry.tier2_golfer2, score: scoreMap.get(entry.tier2_golfer2)?.total, status: scoreMap.get(entry.tier2_golfer2)?.status },
          { id: entry.tier3_golfer1, score: scoreMap.get(entry.tier3_golfer1)?.total, status: scoreMap.get(entry.tier3_golfer1)?.status },
          { id: entry.tier3_golfer2, score: scoreMap.get(entry.tier3_golfer2)?.total, status: scoreMap.get(entry.tier3_golfer2)?.status },
          { id: entry.tier4_golfer1, score: scoreMap.get(entry.tier4_golfer1)?.total, status: scoreMap.get(entry.tier4_golfer1)?.status },
          { id: entry.tier5_golfer1, score: scoreMap.get(entry.tier5_golfer1)?.total, status: scoreMap.get(entry.tier5_golfer1)?.status }
        ]
          .map(g => ({
            name: `${scoreMap.get(g.id)?.first_name || 'Unknown'} ${scoreMap.get(g.id)?.last_name || 'Golfer'}`,
            score: g.status?.toLowerCase() === 'cut' ? 'CUT' : (g.score || 'N/A'),
            status: g.status
          }))
          .sort((a, b) => {
            // Always put CUT golfers at the end
            if (a.score === 'CUT' && b.score !== 'CUT') return 1;
            if (a.score !== 'CUT' && b.score === 'CUT') return -1;
            if (a.score === 'CUT' && b.score === 'CUT') return 0;
            
            // For non-CUT golfers, sort by score (lowest to highest)
            const getScoreValue = (score: string) => {
              if (score === 'CUT') return 999;
              if (score === 'N/A') return 998;
              if (score === 'E') return 0;
              return Number(score);
            };
            
            const scoreA = getScoreValue(a.score);
            const scoreB = getScoreValue(b.score);
            return scoreA - scoreB;
          });

        return {
          position: entry.entry_position || 'N/A',
          entry_name: entry.entry_name,
          entry_total: entry.entry_total,
          payout: entry.payout || 0,
          golfers: allGolfers
        };
      }) || [];

      // Convert position numbers to ordinal format (1st, 2nd, 3rd, etc.)
      const getOrdinal = (n: string) => {
        if (n.startsWith('T')) {
          const num = parseInt(n.slice(1));
          return `T${num}${num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'}`;
        }
        const num = parseInt(n);
        return `${num}${num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'}`;
      };

      const emailBody = `Hi All,

The ${tournament.name} ${tournament.year} has been completed! Here are the final top 10 finishers with payout amounts:

${topEntries.map(entry => 
  `${getOrdinal(entry.position)} - ${entry.entry_name} (${entry.entry_total}) - ${entry.golfers.map(g => `${g.name} (${g.score})`).join(', ')} - $${entry.payout}`
).join('\n')}

Thank you for participating in the Major SZN Pools!

Cheers,
Mike`;

      // Get emails only from entries in this tournament
      const { data: entriesData } = await supabase
        .from('entries')
        .select('email')
        .eq('tournament_id', tournamentId);
      
      const uniqueEmails = Array.from(new Set(entriesData?.map(entry => entry.email) || []));
      
      // Create Gmail URL
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(uniqueEmails.join(','))}&su=${encodeURIComponent(`${tournament.name} ${tournament.year} - Major SZN Pools Final Results`)}&body=${encodeURIComponent(emailBody)}`;
      window.open(gmailUrl, '_blank');

      // 9. Set tournament status to Official
      await supabase
        .from('tournaments')
        .update({ status: 'Official' })
        .eq('id', tournamentId);

      // 10. Refresh tournaments list
      fetchTournaments();

    } catch (error) {
      console.error('Error completing tournament:', error);
    }
  };

  // If still loading or redirecting, show minimal UI
  if (loading || isRedirecting) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => {
          fetchTournaments();
          fetchEntries();
          fetchGolfers();
        }} 
        className="mb-4"
      >
        Refresh Data
      </Button>

      <Tabs defaultValue="tournaments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
          <TabsTrigger value="entries">Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments">
          {withdrawnGolferEntries.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Entries with Withdrawn Golfers</AlertTitle>
              <AlertDescription className="flex justify-between items-center">
                <span>
                  {withdrawnGolferEntries.length} {withdrawnGolferEntries.length === 1 ? 'entry has' : 'entries have'} golfers who are no longer in the tournament:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmailAllWithdrawnGolfers}
                  className="ml-4"
                >
                  <MdOutlineEmail className="mr-2 h-4 w-4" />
                  Email All Affected Entries
                </Button>
              </AlertDescription>
              <div className="mt-4 space-y-4">
                {withdrawnGolferEntries.map(entry => (
                  <Card key={entry.entryId} className="bg-destructive/10">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{entry.entryName}</h3>
                          <p className="text-sm text-muted-foreground">{entry.email}</p>
                          <ul className="mt-2 space-y-1">
                            {entry.withdrawnGolfers.map(golfer => (
                              <li key={golfer.playerId} className="text-sm">
                                {golfer.firstName} {golfer.lastName} ({golfer.tier})
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendWithdrawnGolferEmail(entry)}
                        >
                          <MdOutlineEmail className="mr-2 h-4 w-4" />
                          Send Email
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Alert>
          )}
          
          <Card className="md:rounded-lg rounded-none">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0 pb-2 md:pb-6">
              <CardTitle className="text-lg md:text-xl">Tournament Management</CardTitle>
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <Button 
                  variant="outline"
                  onClick={() => {
                    const activeTournament = tournaments.find(t => t.is_active);
                    if (activeTournament) {
                      handleSendInvite(activeTournament.name, activeTournament.year);
                    }
                  }}
                  className="flex items-center gap-2 w-full md:w-auto text-sm md:text-base"
                  disabled={!tournaments.some(t => t.is_active)}
                >
                  <MdOutlineEmail className="h-4 w-4" />
                  Send Tournament Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:space-y-4">
                {tournaments.map(tournament => (
                  <div 
                    key={tournament.id} 
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 md:p-4 border rounded-lg space-y-2 md:space-y-0"
                  >
                    <div>
                      <h3 className="font-medium">{tournament.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Status: {tournament.status}
                      </p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <Button
                        variant={tournament.is_active ? "secondary" : "default"}
                        onClick={() => handleActivateTournament(tournament.id, tournament.is_active)}
                        className="flex-1 md:flex-none"
                      >
                        {tournament.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      {tournament.is_active && tournament.status !== 'Official' && (
                        <Button
                          variant="destructive"
                          onClick={() => handleCompleteTournament(tournament.id)}
                          className="flex-1 md:flex-none"
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <div className="mb-4 flex justify-between items-center">
            <input
              type="text"
              placeholder="Search by entry name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 w-full max-w-md"
            />
            <Button 
              variant="outline"
              onClick={handleEmailAllEntries}
              className="flex items-center gap-2"
              disabled={!tournaments.some(t => t.is_active)}
            >
              <MdOutlineEmail className="h-4 w-4" />
              Email All Entries
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Active Tournament Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {entries
                  .filter(entry =>
                    entry.entry_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    entry.email.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(entry => (
                    <Card key={entry.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="font-semibold">{entry.entry_name}</h3>
                            <p className="text-sm text-muted-foreground">{entry.email}</p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Tier 1</h4>
                              <div className="space-y-2">
                                <div 
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
                                  onClick={() => handleGolferClick(entry, entry.tier1_golfer1, 'tier1')}
                                >
                                  {getGolferName(entry.tier1_golfer1)}
                                </div>
                                <div 
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
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
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
                                  onClick={() => handleGolferClick(entry, entry.tier2_golfer1, 'tier2')}
                                >
                                  {getGolferName(entry.tier2_golfer1)}
                                </div>
                                <div 
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
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
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
                                  onClick={() => handleGolferClick(entry, entry.tier3_golfer1, 'tier3')}
                                >
                                  {getGolferName(entry.tier3_golfer1)}
                                </div>
                                <div 
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
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
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
                                  onClick={() => handleGolferClick(entry, entry.tier4_golfer1, 'tier4')}
                                >
                                  {getGolferName(entry.tier4_golfer1)}
                                </div>
                                <div 
                                  className="p-2 border rounded cursor-pointer hover:bg-muted"
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
      </Tabs>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Golfer in {selectedTier?.replace('tier', 'Tier ')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a new golfer from the same tier to replace {selectedGolferId && getGolferName(selectedGolferId)}
            </p>
            <div className="max-h-[600px] overflow-y-auto grid grid-cols-2 gap-4">
              {selectedTier && selectedEntry && golfers[selectedTier as keyof TieredGolfers].map(golfer => {
                // Get the other golfer in the same tier
                const otherGolferId = selectedGolferId === selectedEntry[`${selectedTier}_golfer1` as keyof TournamentEntry] 
                  ? selectedEntry[`${selectedTier}_golfer2` as keyof TournamentEntry]
                  : selectedEntry[`${selectedTier}_golfer1` as keyof TournamentEntry];
                
                // Skip if this is the other golfer already selected in this tier
                const isOtherGolfer = golfer.player_id === otherGolferId;
                const hasNotStarted = golfer.status === 'not started';
                
                return (
                  <div 
                    key={golfer.player_id}
                    className={`flex items-center space-x-2 p-2 border rounded cursor-pointer ${
                      isOtherGolfer ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'
                    }`}
                    onClick={() => !isOtherGolfer && handleGolferReplace(golfer.player_id)}
                  >
                    <Checkbox 
                      id={golfer.player_id}
                      checked={golfer.player_id === selectedGolferId}
                      onCheckedChange={() => !isOtherGolfer && handleGolferReplace(golfer.player_id)}
                      disabled={isOtherGolfer}
                    />
                    <label 
                      htmlFor={golfer.player_id} 
                      className={`text-sm ${isOtherGolfer ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {golfer.first_name} {golfer.last_name}{golfer.is_amateur ? ' (A)' : ''}
                      {isOtherGolfer && ' (Already selected)'}
                      <span className="block text-xs text-muted-foreground">
                        {hasNotStarted && golfer.tee_time ? (
                          <>Tee Time: {golfer.tee_time}</>
                        ) : (
                          <>Status: {golfer.status || 'Unknown'}</>
                        )}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 