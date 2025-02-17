import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/server';
import { supabase } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';

export const entriesRouter = router({
  create: publicProcedure
    .input(z.object({
      tournament_id: z.string().uuid(),
      entry_name: z.string().min(1, "Entry name is required"),
      email: z.string().email("Valid email is required"),
      tier1_golfer1: z.string(),
      tier1_golfer2: z.string(),
      tier2_golfer1: z.string(),
      tier2_golfer2: z.string(),
      tier3_golfer1: z.string(),
      tier3_golfer2: z.string(),
      tier4_golfer1: z.string(),
      tier5_golfer1: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Normalize the entry name for comparison (remove extra spaces, lowercase)
      const normalizedEntryName = input.entry_name.toLowerCase().replace(/\s+/g, ' ').trim();

      // Check for existing entries with normalized name
      const { data: existing } = await supabase
        .from('entries')
        .select('id')
        .eq('tournament_id', input.tournament_id)
        .filter('entry_name', 'ilike', normalizedEntryName) // case-insensitive match
        .single();

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An entry with this name already exists for this tournament',
        });
      }

      const { data, error } = await supabase
        .from('entries')
        .insert([input])
        .select();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An entry with this name already exists for this tournament',
          });
        }
        throw error;
      }

      return data[0];
    }),

  // Get entries by email and tournament
  getByEmailAndTournament: publicProcedure
    .input(z.object({
      email: z.string().email(),
      tournament_id: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('entries')
        .select(`
          *,
          tournament:tournaments(*)
        `)
        .eq('email', input.email)
        .eq('tournament_id', input.tournament_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }),

  // Get active tournament
  getActiveTournament: publicProcedure
    .query(async () => {
      console.log('Getting active tournament...');
      
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .single();

      // Add more detailed logging
      console.log('Supabase query:', {
        sql: 'SELECT * FROM tournaments WHERE is_active = true LIMIT 1',
        result: data,
        error,
        hasData: !!data,
        dataFields: data ? Object.keys(data) : [],
      });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      return data;
    }),

  // Get entries by tournament
  getEntriesByTournament: publicProcedure
    .input(z.object({
      tournament_id: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')  // This will get all fields including the golfer IDs
        .eq('tournament_id', input.tournament_id)
        .order('entry_name', { ascending: true });

      if (error) throw error;
      return data;
    }),
}); 