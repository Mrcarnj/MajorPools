import { config } from 'dotenv';
import { getWorldRankings } from '../services/pga-tour/tournaments';
import { supabase } from '../lib/supabase';

config({ path: '.env.local' });

async function updateRankings() {
  try {
    console.log('🎯 Updating world rankings...\n');

    // Get world rankings
    const rankings = await getWorldRankings();
    
    // Process each ranking
    for (const player of rankings) {
      // First check if player exists in golfer_scores
      const { data, error: checkError } = await supabase
        .from('golfer_scores')
        .select('player_id')
        .eq('player_id', player.playerId)
        .single();

      if (checkError || !data) {
        // Skip players not in golfer_scores
        continue;
      }

      // Update ranking for existing player
      const { error } = await supabase
        .from('golfer_scores')
        .update({ 
          ranking: Number(player.rank.$numberInt)
        })
        .eq('player_id', player.playerId);

      if (error) {
        console.error(`Error updating ranking for player ${player.playerId}:`, error.message);
      } else {
        console.log(`Updated ranking for ${player.firstName} ${player.lastName}: ${player.rank.$numberInt}`);
      }
    }

    console.log('✅ Rankings update complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateRankings(); 