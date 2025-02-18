'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MdOutlineEmail } from "react-icons/md";
import { getEmailTemplate } from '@/lib/email-template';

export default function AdminDashboard() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {

      if (!loading) {
        if (!session) {
          console.log('No session, redirecting');
          router.replace('/');
        } else {
          console.log('Session found, fetching tournaments');
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
    if (currentStatus) {
      // If currently active, just deactivate this tournament
      await supabase
        .from('tournaments')
        .update({ is_active: false })
        .eq('id', id);
    } else {
      // If not active, deactivate all then activate this one
      await supabase
        .from('tournaments')
        .update({ is_active: false })
        .neq('id', 'placeholder');

      await supabase
        .from('tournaments')
        .update({ is_active: true })
        .eq('id', id);
    }

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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tournament Management</CardTitle>
          <Button 
            variant="outline"
            onClick={() => {
              const activeTournament = tournaments.find(t => t.is_active);
              if (activeTournament) {
                handleSendInvite(activeTournament.name, activeTournament.year);
              }
            }}
            className="flex items-center gap-2"
            disabled={!tournaments.some(t => t.is_active)}
          >
            <MdOutlineEmail className="h-4 w-4" />
            Send Tournament Invite
          </Button>
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
                  onClick={() => handleActivateTournament(tournament.id, tournament.is_active)}
                  disabled={false}
                >
                  {tournament.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 