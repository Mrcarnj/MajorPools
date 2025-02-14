import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/server';
import { 
  getSchedule, 
  getTournament, 
  getTournamentLeaderboard,
  getPlayers,
  getPlayerScorecard 
} from '@/services/pga-tour/tournaments';
import { supabase } from '@/lib/supabase';

export const pgaRouter = router({
  getSchedule: publicProcedure
    .input(z.object({
      year: z.string()
    }))
    .query(async ({ input }) => {
      return getSchedule(input.year);
    }),

  getTournament: publicProcedure
    .input(z.object({
      tournId: z.string()
    }))
    .query(async ({ input }) => {
      return getTournament(input.tournId);
    }),

  getLeaderboard: publicProcedure
    .input(z.object({
      tournId: z.string(),
      year: z.string()
    }))
    .query(async ({ input }) => {
      return getTournamentLeaderboard(input.tournId, input.year);
    }),

  getCurrentTournament: publicProcedure
    .query(async () => {
      const currentYear = new Date().getFullYear().toString();
      const schedule = await getSchedule(currentYear);
      
      const now = Date.now();
      const currentTournament = schedule.find(tournament => {
        const startDate = tournament.date.start * 1000;
        const endDate = tournament.date.end * 1000;
        return now >= startDate && now <= endDate;
      });

      if (!currentTournament) return null;

      // Get detailed tournament info
      const tournamentDetails = await getTournament(currentTournament.tournId);
      return tournamentDetails;
    }),

  syncCurrentTournament: publicProcedure
    .mutation(async () => {
      const currentYear = new Date().getFullYear().toString();
      const schedule = await getSchedule(currentYear);
      
      const now = Date.now();
      const currentTournament = schedule.find(tournament => {
        const startDate = tournament.date.start * 1000;
        const endDate = tournament.date.end * 1000;
        return now >= startDate && now <= endDate;
      });

      if (!currentTournament) return null;

      // Get detailed tournament info
      const tournamentDetails = await getTournament(currentTournament.tournId);

      // Save/update in database
      const { data: savedTournament, error } = await supabase
        .from('tournaments')
        .upsert({
          pga_tournament_id: tournamentDetails.tournId,
          name: tournamentDetails.name,
          year: parseInt(currentYear),
          start_date: new Date(tournamentDetails.date.start * 1000).toISOString(),
          end_date: new Date(tournamentDetails.date.end * 1000).toISOString(),
          is_active: true,
          course_name: tournamentDetails.courses?.[0]?.name || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Deactivate other tournaments
      await supabase
        .from('tournaments')
        .update({ is_active: false })
        .neq('id', savedTournament.id);

      return savedTournament;
    }),
}); 