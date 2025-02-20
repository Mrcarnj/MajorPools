import { config } from 'dotenv';
import { getTournament, getSchedule } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';


async function testTournament(tournId: string) {
  try {
    console.log(`🏌️ Testing PGA Tour API for tournament ID ${tournId}...\n`);

    const tournament = await getTournament(tournId);
    

    // Extract just the numbers from MongoDB format
    const startMs = Number(tournament.date.start.$date.$numberLong);
    const endMs = Number(tournament.date.end.$date.$numberLong);

    // Now we can create proper dates
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    const course = tournament.courses[0];


    // Check if the tournament already exists
    const { data: existingTournament, error: fetchError } = await supabaseAdmin
      .from('tournaments')
      .select('id')
      .eq('pga_tournament_id', tournId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw fetchError;
    }

    if (existingTournament) {
      // Update the existing tournament
      const { data, error } = await supabaseAdmin
        .from('tournaments')
        .update({
          name: tournament.name,
          year: tournament.year,
          start_date: startDate,
          end_date: endDate,
          is_active: false,
          pga_tournament_id: tournament.tournId,
          pga_year: tournament.year,
          course_name: course.courseName,
          purse: tournament.purse.$numberInt || tournament.purse,
          status: tournament.status,
          current_round: tournament.currentRound.$numberInt || tournament.currentRound,
          par_total: course.parTotal
        })
        .eq('pga_tournament_id', tournId);

      if (error) {
        throw error;
      }

      console.log('Database updated successfully:', data);
    } else {
      // Insert a new tournament
      const { data, error } = await supabaseAdmin
        .from('tournaments')
        .insert({
          name: tournament.name,
          year: tournament.year,
          start_date: startDate,
          end_date: endDate,
          is_active: false,
          pga_tournament_id: tournament.tournId,
          pga_year: tournament.year,
          course_name: course.courseName,
          purse: tournament.purse.$numberInt || tournament.purse,
          status: tournament.status,
          current_round: tournament.currentRound.$numberInt || tournament.currentRound,
          par_total: course.parTotal
        });

      if (error) {
        throw error;
      }

      console.log('Database inserted successfully:', data);
    }

  } catch (error) {
    console.error(`❌ Error processing tournament ${tournId}:`, error);
  }
}

async function testAllTournaments() {
  try {
    // Get the schedule first
    const schedule = await getSchedule('2025');
    
    console.log('Schedule response:', JSON.stringify(schedule, null, 2));
    
    if (!Array.isArray(schedule)) {
      throw new Error(`Invalid schedule format: ${typeof schedule}`);
    }
    
    // Process each tournament in the schedule
    for (const tournament of schedule) {
      await testTournament(tournament.tournId);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ All tournaments processed');
  } catch (error) {
    console.error('❌ Error getting schedule:', error);
  }
}

testAllTournaments();