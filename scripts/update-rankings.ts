import { getWorldRankings } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';

type UpdateRankingsOptions = {
  playerIds?: string[];
  onlyActiveTournamentField?: boolean;
};

async function updateRankings(options: UpdateRankingsOptions = {}) {
  try {
    console.log('🎯 Updating world rankings...\n');

    let targetPlayerIds = options.playerIds ?? null;

    if (options.onlyActiveTournamentField) {
      const { data: activeTournament, error: activeTournamentError } = await supabaseAdmin
        .from('tournaments')
        .select('id')
        .eq('is_active', true)
        .single();

      if (activeTournamentError || !activeTournament) {
        throw new Error('No active tournament found while building rankings scope');
      }

      const { data: fieldPlayers, error: fieldPlayersError } = await supabaseAdmin
        .from('golfer_scores')
        .select('player_id')
        .eq('tournament_id', activeTournament.id);

      if (fieldPlayersError) {
        throw fieldPlayersError;
      }

      targetPlayerIds = (fieldPlayers ?? []).map((player) => player.player_id);
      console.log(`Scoping rankings update to active field: ${targetPlayerIds.length} players`);
    }

    const targetPlayerSet = targetPlayerIds ? new Set(targetPlayerIds) : null;

    // Get world rankings
    const rankings = await getWorldRankings();
    
    let updatedCount = 0;

    // Process each ranking
    for (const player of rankings) {
      if (targetPlayerSet && !targetPlayerSet.has(player.playerId)) {
        continue;
      }

      // Update ranking for existing player
      const { error } = await supabaseAdmin
        .from('golfer_scores')
        .update({ 
          ranking: Number(player.rank.$numberInt)
        })
        .eq('player_id', player.playerId);

      if (error) {
        console.error(`Error updating ranking for player ${player.playerId}:`, error.message);
      } else {
        updatedCount++;
        console.log(`Updated ranking for ${player.firstName} ${player.lastName}: ${player.rank.$numberInt}`);
      }
    }

    console.log(`✅ Rankings update complete (${updatedCount} players updated)`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

export { updateRankings }; 

if (require.main === module) {
  console.log('Running rankings update for active tournament field only...');
  updateRankings({ onlyActiveTournamentField: true })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed to run update-rankings script:', error);
      process.exit(1);
    });
}