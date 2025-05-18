'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MdOutlineEmail } from "react-icons/md";
import { getEmailTemplate } from '@/lib/email-template';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { calculatePrizePool } from '@/utils/scoring';

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

export default function NewAdminPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [withdrawnGolferEntries, setWithdrawnGolferEntries] = useState<WithdrawnGolferEntry[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [mounted, setMounted] = useState(false);

  const checkForWithdrawnGolfers = async () => {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('is_active', true)
      .single();

    if (!tournament) return;

    const { data: entries } = await supabase
      .from('entries')
      .select(`
        id,
        entry_name,
        email,
        golfers (
          player_id,
          first_name,
          last_name,
          tier
        )
      `)
      .eq('tournament_id', tournament.id as any);

    if (!entries) return;

    const withdrawnEntries: WithdrawnGolferEntry[] = [];

    for (const entry of entries as any[]) {
      const withdrawnGolfers = (entry.golfers as any[]).filter((golfer: any) => !golfer.player_id);
      if (withdrawnGolfers.length > 0) {
        withdrawnEntries.push({
          entryId: entry.id as string,
          entryName: entry.entry_name as string,
          email: entry.email as string,
          withdrawnGolfers: withdrawnGolfers.map((golfer: any) => ({
            playerId: golfer.player_id,
            firstName: golfer.first_name,
            lastName: golfer.last_name,
            tier: golfer.tier
          }))
        });
      }
    }

    setWithdrawnGolferEntries(withdrawnEntries);
  };

  useEffect(() => {
    console.log('New Admin page mounted:', {
      loading,
      hasSession: !!session,
      user: session?.user?.email,
      timestamp: new Date().toISOString(),
      path: window.location.pathname,
      isInitialLoad,
      mounted,
      isClient: typeof window !== 'undefined'
    });

    setMounted(true);

    const checkAuth = async () => {
      if (!loading) {
        if (!session) {
          console.log('No session, redirecting to home');
          setIsRedirecting(true);
          router.push('/');
          return;
        }

        // Check if user's email is in authorized_emails table with admin=true
        const { data: authorizedEmail } = await supabase
          .from('authorized_emails')
          .select('admin')
          .eq('email', session.user.email!)
          .single();

        if (!authorizedEmail?.admin) {
          console.log('User is not admin, redirecting to home');
          setIsRedirecting(true);
          router.push('/');
          return;
        }

        console.log('Admin session confirmed, fetching tournaments');
        try {
          console.log('Fetching tournaments from Supabase...');
          const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('start_date', { ascending: true });
          
          if (error) {
            console.error('Error fetching tournaments:', {
              error,
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          console.log('Successfully fetched tournaments:', {
            count: data?.length || 0,
            timestamp: new Date().toISOString()
          });
          
          setTournaments(data || []);
          await checkForWithdrawnGolfers();
        } catch (error) {
          console.error('Error in admin page:', {
            error,
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    checkAuth();
    setIsInitialLoad(false);

    // Subscribe to tournament changes
    const channel = supabase
      .channel('tournament_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments'
        },
        () => {
          checkAuth(); // Refetch tournaments when changes occur
        }
      )
      .subscribe();

    return () => {
      console.log('New Admin page unmounting');
      setMounted(false);
      channel.unsubscribe();
    };
  }, [session, loading, router, isInitialLoad, mounted]);

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

    // Refresh tournaments
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: true });
    setTournaments(data || []);
  };

  const handleSendInvite = async (tournamentName: string, tournamentYear: number) => {
    // Get all emails from email_list instead of entries
    const { data: emailData } = await supabase
      .from('email_list')
      .select('email');
    
    const uniqueEmails = Array.from(new Set(emailData?.map(entry => entry.email) || []));
    
    const createTeamUrl = `${window.location.origin}/create-team`;
    const emailBody = getEmailTemplate(tournamentName, createTeamUrl, tournamentYear);
    
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(uniqueEmails.join(','))}&subject=${encodeURIComponent(`${tournamentName} ${tournamentYear} - Welcome & Submission Form`)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
  };

  async function handleCompleteTournament(tournamentId: string) {
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

      console.log('Successfully fetched entries:', {
        count: entries.length,
        tournamentId,
        timestamp: new Date().toISOString()
      });

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

        const displayScore = golfers
          .map(g => g.total === 'N/A' ? 0 : Number(g.total))
          .sort((a, b) => a - b)
          .slice(0, 5)
          .reduce((sum, score) => sum + score, 0);

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

      // 7. Prepare and send results email
      const topEntries = entries.slice(0, 10).map(entry => {
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
            score: g.status === 'CUT' ? 'CUT' : (g.score || 'N/A'),
            status: g.status
          }))
          .sort((a, b) => {
            // Sort CUT golfers to the end
            if (a.score === 'CUT' && b.score !== 'CUT') return 1;
            if (a.score !== 'CUT' && b.score === 'CUT') return -1;
            if (a.score === 'CUT' && b.score === 'CUT') return 0;
            
            const scoreA = a.score === 'N/A' ? 99 : Number(a.score);
            const scoreB = b.score === 'N/A' ? 99 : Number(b.score);
            return scoreA - scoreB;
          });

        return {
          position: rankingMap.get(entry.id) || 'N/A',
          entry_name: entry.entry_name,
          entry_total: entry.entry_total || 'N/A',
          payout: payouts.get(entry.entry_name) || 0,
          golfers: allGolfers
        };
      });

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
  `$${entry.payout} - ${getOrdinal(entry.position)} - ${entry.entry_name} (${entry.entry_total}) - ${entry.golfers.map(g => `${g.name} (${g.score})`).join(', ')}`
).join('\n')}

Thank you for participating in the Major SZN Pools!

Cheers,
Mike`;

      // Get all emails from email_list
      const { data: emailData } = await supabase
        .from('email_list')
        .select('email');
      
      const uniqueEmails = Array.from(new Set(emailData?.map(entry => entry.email) || []));
      
      // Create mailto link
      const mailtoLink = `mailto:?bcc=${encodeURIComponent(uniqueEmails.join(','))}&subject=${encodeURIComponent(`${tournament.name} ${tournament.year} - Final Results`)}&body=${encodeURIComponent(emailBody)}`;
      window.location.href = mailtoLink;

      // 8. Set tournament status to Official
      await supabase
        .from('tournaments')
        .update({ status: 'Official' })
        .eq('id', tournamentId);

      // 9. Refresh tournaments list
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: true });
      setTournaments(data || []);

    } catch (error) {
      console.error('Error completing tournament:', error);
      // You might want to add toast notification here
    }
  }

  // Show loading state
  if (loading || isInitialLoad || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (isRedirecting) {
    return null;
  }

  // Show nothing if no session
  if (!session) {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <h1 className="text-xl md:text-2xl font-bold">Tournament Management</h1>
      
      {withdrawnGolferEntries.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Entries with Withdrawn Golfers</AlertTitle>
          <AlertDescription>
            The following entries have golfers who are no longer in the tournament:
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
                  {tournament.is_active && (
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
    </div>
  );
} 