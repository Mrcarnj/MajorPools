import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/server';
import { supabase } from '@/lib/supabase';

export const golfersRouter = router({
  getByTier: publicProcedure
    .input(z.number().min(1).max(5))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('golfers')
        .select('*')
        .eq('tier', input)
        .order('world_ranking');

      if (error) throw error;
      return data;
    }),

  getAll: publicProcedure.query(async () => {
    const { data, error } = await supabase
      .from('golfers')
      .select('*')
      .order('tier, world_ranking');

    if (error) throw error;
    return data;
  }),
}); 