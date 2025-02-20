'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';


type UserEntry = {
  entry_name: string;
  tournament_name: string;
  tournament_start_date: string;
  calculated_score: number;
  tournament_status: string;
  is_active: boolean;
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
  tournaments: {
    name: string;
    start_date: string;
    status: string;
    is_active: boolean;
  };
  [key: string]: any; // for golfer fields
};

export default function UserDashboard() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchUserEntries() {
      if (!session?.user?.email) return;

      // Get entries for this user
      const { data: entriesData } = await supabase
        .from('entries')
        .select(`
          entry_name,
          calculated_score,
          tournament_id,
          tier1_golfer1, tier1_golfer2,
          tier2_golfer1, tier2_golfer2,
          tier3_golfer1, tier3_golfer2,
          tier4_golfer1,
          tier5_golfer1,
          tournaments!inner (
            name,
            start_date,
            status,
            is_active
          )
        `)
        .eq('email', session.user.email) as { data: DbEntry[] | null };

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

      // Transform entries data to include golfer details
      const formattedEntries = entriesData?.map(entry => {
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
            player_id: id,
            first_name: score?.first_name || 'Unknown',
            last_name: score?.last_name || 'Golfer',
            total: score?.total || 'N/A',
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
          golfers
        };
      }) || [];

      setEntries(formattedEntries);
      setLoading(false);
    }

    fetchUserEntries();
  }, [session?.user?.email]);

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/');
    }
  }, [session, loading, router]);

  const activeEntries = entries.filter(entry => entry.is_active);
  const historicalEntries = entries.filter(entry => !entry.is_active);

  if (loading) {
    return <div>Loading your entries...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="px-0 md:container md:mx-auto md:py-8 space-y-4 md:space-y-8 md:rounded-lg rounded-lg">
      <h1 className="text-2xl md:text-3xl font-bold px-1 md:px-0">My Dashboard</h1>
      
      {activeEntries.length > 0 && (
        <Card className="md:rounded-lg rounded-none px-0 md:px-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg md:text-xl">Current Tournament Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4 px-0 md:px-1">
              {activeEntries.map((entry) => (
                <div 
                  key={entry.entry_name}
                  className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 border rounded-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between md:justify-start md:gap-4">
                      <h3 className="font-semibold">{entry.entry_name}</h3>
                      <p className="text-sm text-muted-foreground md:hidden">{entry.tournament_status}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.tournament_name}</p>
                    <div className="flex flex-wrap gap-1.5 md:gap-2 text-[11px] md:text-xs">
                      {entry.golfers.map(golfer => (
                        <span 
                          key={golfer.player_id} 
                          className="bg-muted px-1.5 md:px-2 py-0.5 md:py-1 rounded whitespace-nowrap"
                        >
                          {golfer.position} {golfer.first_name} {golfer.last_name} ({golfer.total})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-sm text-muted-foreground">{entry.tournament_status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <div className="space-y-1">
                    <h3 className="font-semibold">{entry.entry_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {entry.tournament_name} - {new Date(entry.tournament_start_date).getFullYear()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              You haven't created any entries yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 