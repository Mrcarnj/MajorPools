import { getTournamentLeaderboard } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';

async function testLeaderboard(tournId: string) {
  try {
    console.log(`🏌️ Testing PGA Tour API leaderboard for tournament ID ${tournId}...\n`);

    const leaderboard = await getTournamentLeaderboard(tournId);
    
    // Debug log to see the structure
    console.log('Leaderboard cutLines:', JSON.stringify(leaderboard.cutLines, null, 2));
    
    // Extract cut score from cutLines array
    const cutScore = leaderboard.cutLines?.[0]?.cutScore;
    if (cutScore) {
      console.log(`Cut Score: ${cutScore}`);

      // Update tournament with cut score as-is
      const { error } = await supabaseAdmin
        .from('tournaments')
        .update({ cut_score: cutScore })
        .eq('pga_tournament_id', tournId);

      if (error) {
        console.error('Error updating cut score:', error);
      } else {
        console.log('Cut score updated successfully');
      }
    } else {
      console.log('Cut Score: Not available');
    }

    // if (!leaderboard.leaderboardRows?.length) {
    //   console.log('No players found in leaderboard');
    //   return;
    // }

    // console.log(`Found ${leaderboard.leaderboardRows.length} players to process...`);

    // for (const player of leaderboard.leaderboardRows) {
    //   const playerData = {
    //     last_name: player.lastName,
    //     first_name: player.firstName,
    //     player_id: player.playerId,
    //     is_amateur: player.isAmateur || false,
    //     course_id: player.courseId,
    //     status: player.status,
    //     position: player.position,
    //     total: player.total,
    //     current_round_score: player.currentRoundScore || null,
    //     current_hole: player.currentHole?.$numberInt ? Number(player.currentHole.$numberInt) : null,
    //     starting_hole: player.startingHole?.$numberInt ? Number(player.startingHole.$numberInt) : null,
    //     round_complete: player.roundComplete,
    //     thru: player.thru,
    //     current_round: player.currentRound?.$numberInt ? Number(player.currentRound.$numberInt) : null,
    //     tee_time: player.teeTime || null
    //   };

    //   const { error } = await supabase
    //     .from('golfer_scores')
    //     .upsert(playerData, {
    //       onConflict: 'player_id'
    //     });

    //   if (error) {
    //     console.error(`Error processing ${player.firstName} ${player.lastName}:`, error.message);
    //   }
    // }

    console.log('✅ Leaderboard processing complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLeaderboard('007'); 