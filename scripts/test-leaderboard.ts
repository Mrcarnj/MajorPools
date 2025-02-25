import { getTournamentLeaderboard } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';

async function testLeaderboard() {
  try {
    console.log(`🏌️ Testing PGA Tour API leaderboard for tournament ID...\n`);

    // Get the active tournament first
    const { data: activeTournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, pga_tournament_id')  // Also get pga_tournament_id
      .eq('is_active', true)
      .single();

    if (tournamentError || !activeTournament) {
      console.error('No active tournament found');
      return;
    }

    console.log(`Active Tournament: ${activeTournament.name} (ID: ${activeTournament.id})`);

    // Use the active tournament's PGA ID
    const leaderboard = await getTournamentLeaderboard(activeTournament.pga_tournament_id);
    
    // Debug log to see the structure
    console.log('Leaderboard cutLines:', JSON.stringify(leaderboard.cutLines, null, 2));
    
    // Extract cut score from cutLines array
    const cutScore = leaderboard.cutLines?.[0]?.cutScore;
    if (cutScore) {
      console.log(`Cut Score: ${cutScore}`);

      const { error } = await supabaseAdmin
        .from('tournaments')
        .update({ cut_score: cutScore })
        .eq('id', activeTournament.id);

      if (error) {
        console.error('Error updating cut score:', error);
      } else {
        console.log('Cut score updated successfully');
      }
    } else {
      console.log('Cut Score: Not available');
    }

    if (!leaderboard.leaderboardRows?.length) {
      console.log('No players found in leaderboard');
      return;
    }

    console.log(`Found ${leaderboard.leaderboardRows.length} players to process...`);

    for (const player of leaderboard.leaderboardRows) {
      // First check if player exists
      const { data: existingPlayer } = await supabaseAdmin
        .from('golfer_scores')
        .select('player_id')
        .eq('player_id', player.playerId)
        .single();

      const playerData = {
        last_name: player.lastName,
        first_name: player.firstName,
        player_id: player.playerId,
        is_amateur: player.isAmateur || false,
        course_id: player.courseId,
        status: player.status,
        position: player.position,
        total: player.total,
        current_round_score: player.currentRoundScore || null,
        current_hole: player.currentHole?.$numberInt ? Number(player.currentHole.$numberInt) : null,
        starting_hole: player.startingHole?.$numberInt ? Number(player.startingHole.$numberInt) : null,
        round_complete: player.roundComplete,
        thru: player.thru,
        current_round: player.currentRound?.$numberInt ? Number(player.currentRound.$numberInt) : null,
        tee_time: player.teeTime || null,
        tournament_id: activeTournament.id
      };

      if (!existingPlayer) {
        console.log(`Adding new player: ${player.firstName} ${player.lastName}`);
        const { error: insertError } = await supabaseAdmin
          .from('golfer_scores')
          .insert(playerData);

        if (insertError) {
          console.error(`Error adding ${player.firstName} ${player.lastName}:`, insertError.message);
        }
      } else {
        console.log(`Updating player: ${player.firstName} ${player.lastName}`);
        const { error: updateError } = await supabaseAdmin
          .from('golfer_scores')
          .update(playerData)
          .eq('player_id', player.playerId);

        if (updateError) {
          console.error(`Error updating ${player.firstName} ${player.lastName}:`, updateError.message);
        }
      }
    }

    console.log('✅ Leaderboard processing complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Call without parameters
testLeaderboard(); 