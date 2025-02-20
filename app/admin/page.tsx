'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MdOutlineEmail } from "react-icons/md";
import { getEmailTemplate } from '@/lib/email-template';
import { calculateDisplayScore, type GolferScore, calculateRankings, type Entry } from '@/utils/scoring';

export default function AdminDashboard() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      if (!loading) {
        if (!session || session.user.user_metadata?.role !== 'admin') {
          console.log('Not admin, redirecting');
          router.replace('/');
        } else {
          console.log('Admin session found, fetching tournaments');
          const { data } = await supabase
            .from('tournaments')
            .select('*')
            .order('start_date', { ascending: true });
          setTournaments(data || []);
        }
      }
    };
    checkAuth();
  }, [session, loading, router]);

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
      // 1. Get all entries for this tournament with calculated_score and display_score
      const { data: entries, error: entriesError } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          calculated_score,
          tier1_golfer1, tier1_golfer2,
          tier2_golfer1, tier2_golfer2,
          tier3_golfer1, tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1
        `)
        .eq('tournament_id', tournamentId)
        .order('calculated_score', { ascending: true });

      if (entriesError) throw entriesError;

      // 2. Calculate final rankings and positions
      const entriesForRankings: Entry[] = entries.map(entry => ({
        entry_name: entry.entry_name,
        calculated_score: entry.calculated_score,
        display_score: 0,
        topFiveGolfers: []
      }));

      const rankings = calculateRankings(entriesForRankings);

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

      // Helper function to check if position indicates player is out
      const isPlayerOut = (position?: string) => ['CUT', 'WD', 'DQ'].includes(position || '');

      // 4. Update each entry with scores AND ranking
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
            thru: score?.thru === '-' && ['CUT', 'WD', 'DQ'].includes(score?.position || '') 
              ? score?.position 
              : score?.thru || '-',
            position: score?.position || '-',
            status: score?.status || '-',
            tee_time: score?.tee_time || '-'
          };
        });

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
          entry_position: rankingMap.get(entry.id)
        };

        await supabase.from('entries').update(updateData).eq('id', entry.id);
      }

      // 5. Set tournament status to Official (but don't change is_active)
      await supabase
        .from('tournaments')
        .update({ status: 'Official' })
        .eq('id', tournamentId);

      // 6. Refresh tournaments list
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="px-1 md:container md:mx-auto py-4 md:py-8 space-y-4 md:space-y-8">
      <h1 className="text-xl md:text-2xl font-bold px-1 md:px-0">Admin Dashboard</h1>
      
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