import { supabaseAdmin } from '../lib/supabase-admin';

type CreateDataGolfIdOptions = {
  playerIds?: string[];
  onlyActiveTournamentField?: boolean;
};

async function createDataGolfId(options: CreateDataGolfIdOptions = {}) {
  try {
    console.log('🎯 Syncing DataGolf IDs...\n');

    let targetPlayerIds = options.playerIds ?? null;

    if (options.onlyActiveTournamentField) {
      const { data: activeTournament, error: activeTournamentError } = await supabaseAdmin
        .from('tournaments')
        .select('id')
        .eq('is_active', true)
        .single();

      if (activeTournamentError || !activeTournament) {
        throw new Error('No active tournament found while building DataGolf ID scope');
      }

      const { data: fieldPlayers, error: fieldPlayersError } = await supabaseAdmin
        .from('golfer_scores')
        .select('player_id')
        .eq('tournament_id', activeTournament.id);

      if (fieldPlayersError) {
        throw fieldPlayersError;
      }

      targetPlayerIds = (fieldPlayers ?? []).map((player) => player.player_id);
      console.log(`Scoping DataGolf ID sync to active field: ${targetPlayerIds.length} players`);
    }

    let golfersQuery = supabaseAdmin
      .from('golfer_scores')
      .select('player_id, first_name, last_name, dg_id');

    if (targetPlayerIds) {
      golfersQuery = golfersQuery.in('player_id', targetPlayerIds);
    }

    const { data: ourGolfers, error: ourGolfersError } = await golfersQuery;

    if (ourGolfersError) {
      throw ourGolfersError;
    }

    if (!ourGolfers || ourGolfers.length === 0) {
      console.log('No golfers found for selected scope');
      return { success: true, updated: 0, missing: 0 };
    }

    // Create a map of our golfers for easy lookup
    const ourGolfersMap = new Map(
      ourGolfers.map(golfer => [
        `${golfer.last_name}, ${golfer.first_name}`.toLowerCase(),
        { player_id: golfer.player_id, dg_id: golfer.dg_id }
      ])
    );

    // Fetch DataGolf data
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
    
    const missingPlayers: { name: string; dg_id: number }[] = [];
    let matchedPlayers = 0;
    let updatedPlayers = 0;

    // Check each DataGolf player against our database
    for (const player of data.odds) {
      const fullName = player.player_name.toLowerCase();
      const ourGolfer = ourGolfersMap.get(fullName);

      if (ourGolfer) {
        matchedPlayers++;

        if (ourGolfer.dg_id !== player.dg_id) {
          const { error: updateError } = await supabaseAdmin
            .from('golfer_scores')
            .update({ dg_id: player.dg_id })
            .eq('player_id', ourGolfer.player_id);

          if (updateError) {
            console.error(`Failed to set dg_id for ${player.player_name}:`, updateError.message);
          } else {
            updatedPlayers++;
          }
        }
      } else {
        missingPlayers.push({ name: player.player_name, dg_id: player.dg_id });
      }
    }

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Total DataGolf players: ${data.odds.length}`);
    console.log(`Players in selected scope: ${ourGolfers.length}`);
    console.log(`Players matched by name: ${matchedPlayers}`);
    console.log(`Players with dg_id updated: ${updatedPlayers}`);
    console.log(`Players missing from our database: ${missingPlayers.length}`);

    if (missingPlayers.length > 0) {
      console.log('\nMissing players:');
      missingPlayers.forEach(player => console.log(`- ${player.name} (DG ID: ${player.dg_id})`));
    }

    console.log('\n✅ DataGolf ID sync complete');
    return { success: true, updated: updatedPlayers, missing: missingPlayers.length };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, updated: 0, missing: 0 };
  }
}

export { createDataGolfId };

if (require.main === module) {
  createDataGolfId({ onlyActiveTournamentField: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
