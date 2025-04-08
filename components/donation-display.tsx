'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculatePrizePool } from '@/utils/scoring';
import type { Entry } from '@/utils/scoring';

export function DonationDisplay() {
  const [donation, setDonation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDonationAmount() {
      try {
        // First get active tournament
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('id')
          .eq('is_active', true)
          .single();

        if (!tournament) {
          setIsLoading(false);
          return;
        }

        // Get entries for active tournament
        const { data: entriesData } = await supabase
          .from('entries')
          .select('entry_name, calculated_score')
          .eq('tournament_id', tournament.id);

        if (entriesData && entriesData.length > 0) {
          const entries = entriesData.map(entry => ({
            entry_name: entry.entry_name,
            calculated_score: entry.calculated_score,
            display_score: 0,
            topFiveGolfers: []
          })) as Entry[];
          
          const { donation } = calculatePrizePool(entries);
          setDonation(donation);
        }
      } catch (error) {
        console.error('Error fetching donation amount:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDonationAmount();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartIcon className="h-5 w-5 text-red-500" />
          </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading donation information...</p>
        ) : (
          <div className="space-y-2">
            <h3 className="text-lg font-medium">John & Matt Gaudreau Foundations</h3>
            <p className="text-sm text-muted-foreground">
              10% of all entry fees goes directly to support the John & Matt Gaudreau Foundations.
            </p>
            <p className="text-xl font-bold text-red-500">
              Current Donation: ${donation}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 