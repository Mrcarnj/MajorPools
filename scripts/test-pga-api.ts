import { config } from 'dotenv';
import { getTournament } from '../services/pga-tour/tournaments';
import { supabase } from '../lib/supabase';

// Load environment variables
config({ path: '.env.local' });

async function testTournament(tournId: string) {
  try {
    console.log(`🏌️ Testing PGA Tour API for tournament ID ${tournId}...\n`);

    const tournament = await getTournament(tournId);
    
    console.log('Tournament Details:');
    console.log('------------------');
    console.log(`ID: ${tournament._id.$oid || tournament._id}`);
    console.log(`Org ID: ${tournament.orgId}`);
    console.log(`Year: ${tournament.year}`);
    console.log(`Tournament ID: ${tournament.tournId}`);
    console.log(`Name: ${tournament.name}`);
    console.log(`Purse: $${tournament.purse.$numberInt?.toLocaleString() || tournament.purse}`);
    console.log('\nDates:');
    // Extract just the numbers from MongoDB format
    const startMs = Number(tournament.date.start.$date.$numberLong);
    const endMs = Number(tournament.date.end.$date.$numberLong);

    // Now we can create proper dates
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    // Get just the date part from UTC string
    console.log(`Start: ${startDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);
    console.log(`End: ${endDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);

    console.log('\nStatus:');
    console.log(`Format: ${tournament.format}`);
    console.log(`Status: ${tournament.status}`);
    console.log(`Current Round: ${tournament.currentRound.$numberInt || tournament.currentRound}`);
    console.log('\nCourse:');
    const course = tournament.courses[0];
    console.log(`ID: ${course.courseId}`);
    console.log(`Name: ${course.courseName}`);
    console.log(`Par Total: ${course.parTotal}`);

    // Check if the tournament already exists
    const { data: existingTournament, error: fetchError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('pga_tournament_id', tournId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw fetchError;
    }

    if (existingTournament) {
      // Update the existing tournament
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
    console.error('❌ Error:', error);
  }
}

async function testAllTournaments() {
  const tournamentIds = ['007', '014', '033', '100', '026'];
  for (const tournId of tournamentIds) {
    await testTournament(tournId);
  }
}

testAllTournaments();