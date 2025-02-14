import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/server';
import { supabase } from '@/lib/supabase';

export const entriesRouter = router({
  create: publicProcedure
    .input(z.object({
      entryName: z.string(),
      email: z.string().email(),
      selections: z.record(z.string(), z.array(z.string())),
    }))
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from('entries')
        .insert([input])
        .select();

      if (error) throw error;
      return data[0];
    }),
}); 