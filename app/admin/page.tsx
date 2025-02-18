'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboard() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('Admin page - Checking auth');
      console.log('Session:', !!session);
      console.log('Loading:', loading);

      if (!loading) {
        if (!session) {
          console.log('No session, redirecting');
          router.replace('/');
        } else {
          console.log('Session found, fetching tournaments');
          const { data } = await supabase
            .from('tournaments')
            .select('*')
            .order('start_date', { ascending: false });
          setTournaments(data || []);
        }
      }
    };

    checkAuth();
  }, [session, loading, router]);

  const handleActivateTournament = async (id: string) => {
    // First deactivate all tournaments
    await supabase
      .from('tournaments')
      .update({ is_active: false })
      .neq('id', 'placeholder');

    // Then activate the selected tournament
    await supabase
      .from('tournaments')
      .update({ is_active: true })
      .eq('id', id);

    // Refresh tournaments
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: false });
    setTournaments(data || []);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Tournament Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tournaments.map(tournament => (
              <div key={tournament.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">{tournament.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Status: {tournament.status}
                  </p>
                </div>
                <Button
                  variant={tournament.is_active ? "secondary" : "default"}
                  onClick={() => handleActivateTournament(tournament.id)}
                  disabled={tournament.is_active}
                >
                  {tournament.is_active ? 'Active' : 'Activate'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 