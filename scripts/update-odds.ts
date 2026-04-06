import { supabaseAdmin } from '../lib/supabase-admin';
import { createDataGolfId } from './create-datagolf-id';

type UpdateOddsOptions = {
  playerIds?: string[];
  onlyActiveTournamentField?: boolean;
};

async function updateOdds(options: UpdateOddsOptions = {}) {
  try {
    console.log('🎯 Updating golf odds...\n');

    await createDataGolfId({
      playerIds: options.playerIds,
      onlyActiveTournamentField: options.onlyActiveTournamentField,
    });

    const apiKey = process.env.DATA_GOLF_API_KEY;
    if (!apiKey) {
      throw new Error('DATA_GOLF_API_KEY is not set');
    }

    const url = "https://feeds.datagolf.com/betting-tools/outrights";
    const params = new URLSearchParams({
      tour: "pga",
      market: "win",
      odds_format: "american",
      key: apiKey
    });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    let targetPlayerIds = options.playerIds ?? null;

    if (options.onlyActiveTournamentField) {
      const { data: activeTournament, error: activeTournamentError } = await supabaseAdmin
        .from('tournaments')
        .select('id')
        .eq('is_active', true)
        .single();

      if (activeTournamentError || !activeTournament) {
        throw new Error('No active tournament found while building odds scope');
      }

      const { data: fieldPlayers, error: fieldPlayersError } = await supabaseAdmin
        .from('golfer_scores')
        .select('player_id')
        .eq('tournament_id', activeTournament.id);

      if (fieldPlayersError) {
        throw fieldPlayersError;
      }

      targetPlayerIds = (fieldPlayers ?? []).map((player) => player.player_id);
      console.log(`Scoping odds update to active field: ${targetPlayerIds.length} players`);
    }

    let targetDgIds: Set<number> | null = null;
    if (targetPlayerIds) {
      const { data: scopedGolfers, error: scopedGolfersError } = await supabaseAdmin
        .from('golfer_scores')
        .select('dg_id')
        .in('player_id', targetPlayerIds)
        .not('dg_id', 'is', null);

      if (scopedGolfersError) {
        throw scopedGolfersError;
      }

      targetDgIds = new Set((scopedGolfers ?? []).map((golfer) => golfer.dg_id).filter((dgId): dgId is number => typeof dgId === 'number'));
      console.log(`Found ${targetDgIds.size} scoped players with DataGolf IDs`);
    }
    
    // Debug log for first player
    if (data.odds && data.odds.length > 0) {
      console.log('Sample player data:', JSON.stringify(data.odds[0], null, 2));
    }
    
    let updatedCount = 0;

    // Process each player's odds
    for (const player of data.odds) {
      if (targetDgIds && !targetDgIds.has(player.dg_id)) {
        continue;
      }

      // FanDuel odds are directly in the player object
      const fanduelOdds = player.fanduel;

      if (fanduelOdds) {
        // Update golfer_scores table
        const { error } = await supabaseAdmin
          .from('golfer_scores')
          .update({ odds: fanduelOdds })
          .eq('dg_id', player.dg_id);

        if (error) {
          console.error(`Error updating odds for player ${player.player_name}:`, error.message);
        } else {
          updatedCount++;
          console.log(`Updated odds for ${player.player_name}: ${fanduelOdds}`);
        }
      } else {
        console.log(`No FanDuel odds found for ${player.player_name}`);
      }
    }

    console.log(`✅ Odds update complete (${updatedCount} players updated)`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

export { updateOdds }; 

if (require.main === module) {
  console.log('Running odds update for active tournament field only...');
  updateOdds({ onlyActiveTournamentField: true }).then(() => process.exit(0)).catch(() => process.exit(1));
}
