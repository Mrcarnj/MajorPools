'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ActiveOrNextTournament = Record<string, unknown> & {
  id?: string;
  name?: string;
  is_active?: boolean;
  status?: string;
  current_round?: number;
  start_date?: string;
  end_date?: string;
  course_name?: string | null;
  par_total?: number | null;
  purse?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export function useActiveOrNextTournament() {
  const [tournament, setTournament] = useState<ActiveOrNextTournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchTournament() {
      const { data: activeTournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .single();

      if (cancelled) return;

      if (activeTournament) {
        setTournament(activeTournament as ActiveOrNextTournament);
        setLoading(false);
        return;
      }

      const today = new Date().toISOString();
      const { data: nextTournament } = await supabase
        .from('tournaments')
        .select('*')
        .gt('start_date', today)
        .order('start_date', { ascending: true })
        .limit(1)
        .single();

      if (cancelled) return;

      setTournament((nextTournament as ActiveOrNextTournament) ?? null);
      setLoading(false);
    }

    fetchTournament();

    const channel = supabase
      .channel('tournament_status_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => {
          fetchTournament();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, []);

  return { tournament, loading };
}
