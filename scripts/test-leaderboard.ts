import { config } from 'dotenv';
import { getTournamentLeaderboard } from '../services/pga-tour/tournaments';
import { supabase } from '../lib/supabase';

config({ path: '.env.local' });

async function testLeaderboard() {
  try {
    console.log('🏌️ Processing leaderboard data...');

    const leaderboard = await getTournamentLeaderboard('007');
    
    if (!leaderboard.leaderboardRows?.length) {
      console.log('No players found in leaderboard');
      return;
    }

    console.log(`Found ${leaderboard.leaderboardRows.length} players to process...`);

    for (const player of leaderboard.leaderboardRows) {
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
        tee_time: player.teeTime || null
      };

      const { error } = await supabase
        .from('golfer_scores')
        .upsert(playerData, {
          onConflict: 'player_id'
        });

      if (error) {
        console.error(`Error processing ${player.firstName} ${player.lastName}:`, error.message);
      }
    }

    console.log('✅ Leaderboard processing complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLeaderboard(); 