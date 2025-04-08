import { config } from 'dotenv';
import { getTournament, getSchedule } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';

async function updateActiveTournament() {
  try {
    console.log('🏌️ Updating active tournament...\n');

    // Get the active tournament first
    const { data: activeTournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, pga_tournament_id')
      .eq('is_active', true)
      .single();

    if (tournamentError || !activeTournament) {
      console.error('❌ No active tournament found');
      return;
    }

    console.log(`Active Tournament: ${activeTournament.name} (ID: ${activeTournament.id})`);

    // Get tournament data
    const tournament = await getTournament(activeTournament.pga_tournament_id);
    
    // Skip tournaments without course data
    if (!tournament.courses?.length) {
      console.log(`⚠️ Skipping tournament ${activeTournament.pga_tournament_id} (${tournament.name}): No course data\n`);
      return;
    }

    // Handle different date formats
    let startDate, endDate;
    
    if (tournament.date?.start?.$date?.$numberLong) {
      // MongoDB format
      const startMs = Number(tournament.date.start.$date.$numberLong);
      const endMs = Number(tournament.date.end.$date.$numberLong);
      startDate = new Date(startMs);
      endDate = new Date(endMs);
    } else if (tournament.date?.start) {
      // Direct ISO string format
      startDate = new Date(tournament.date.start);
      endDate = new Date(tournament.date.end);
    } else {
      console.error('❌ Unrecognized date format in tournament data');
      return;
    }
    
    const course = tournament.courses[0];
    
    // Handle different number formats
    const purse = typeof tournament.purse === 'object' && tournament.purse?.$numberInt 
      ? Number(tournament.purse.$numberInt) 
      : tournament.purse;
      
    const currentRound = typeof tournament.currentRound === 'object' && tournament.currentRound?.$numberInt
      ? Number(tournament.currentRound.$numberInt)
      : tournament.currentRound;
      
    const parTotal = course.parTotal;

    // Update tournament data
    const { error: updateError } = await supabaseAdmin
      .from('tournaments')
      .update({
        name: tournament.name,
        year: tournament.year,
        start_date: startDate,
        end_date: endDate,
        pga_tournament_id: tournament.tournId,
        pga_year: tournament.year,
        course_name: course.courseName,
        purse: purse,
        status: tournament.status,
        current_round: currentRound,
        par_total: parTotal
      })
      .eq('id', activeTournament.id);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Tournament data updated successfully');

    // Process players from the tournament data
    if (!tournament.players?.length) {
      console.log('⚠️ No players found in tournament data');
      return;
    }

    console.log(`Processing ${tournament.players.length} players from tournament data...`);

    // Get all existing players in the database
    const { data: allExistingPlayers, error: allExistingPlayersError } = await supabaseAdmin
      .from('golfer_scores')
      .select('player_id');

    if (allExistingPlayersError) {
      throw allExistingPlayersError;
    }

    const existingPlayerIds = new Set(allExistingPlayers?.map(p => p.player_id) || []);
    const playersToInsert = [];
    const playersToUpdate = [];

    // Process each player
    for (const player of tournament.players) {
      const playerData = {
        last_name: player.lastName,
        first_name: player.firstName,
        player_id: player.playerId,
        is_amateur: player.isAmateur || false,
        status: player.status || 'Active',
        tournament_id: activeTournament.id
      };

      if (existingPlayerIds.has(player.playerId)) {
        // Player exists, just update their tournament_id
        playersToUpdate.push({
          player_id: player.playerId,
          tournament_id: activeTournament.id
        });
      } else {
        // New player, insert them
        playersToInsert.push(playerData);
      }
    }

    // Insert new players
    if (playersToInsert.length > 0) {
      console.log(`Inserting ${playersToInsert.length} new players...`);
      const { error: insertError } = await supabaseAdmin
        .from('golfer_scores')
        .insert(playersToInsert);

      if (insertError) {
        throw insertError;
      }
      console.log('✅ New players inserted successfully');
    }

    // Update existing players with the active tournament ID
    if (playersToUpdate.length > 0) {
      console.log(`Updating ${playersToUpdate.length} existing players with active tournament ID...`);
      
      // Process in batches to avoid overwhelming the database
      const batchSize = 20;
      for (let i = 0; i < playersToUpdate.length; i += batchSize) {
        const batch = playersToUpdate.slice(i, i + batchSize);
        
        for (const player of batch) {
          const { error: updateError } = await supabaseAdmin
            .from('golfer_scores')
            .update({ tournament_id: player.tournament_id })
            .eq('player_id', player.player_id);

          if (updateError) {
            console.error(`Error updating player ${player.player_id}:`, updateError);
          }
        }
        
        console.log(`Processed batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(playersToUpdate.length/batchSize)}`);
      }
      
      console.log('✅ Existing players updated successfully');
    }

    console.log('✅ Tournament and player data update complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the update
updateActiveTournament();