import './load-env';

import { getTournament } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';
import { updateRankings } from './update-rankings';
import { updateOdds } from './update-odds';

async function setTournament() {
  try {
    // Get the active tournament first
    const { data: activeTournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, pga_tournament_id')
      .eq('is_active', true)
      .single();

    if (tournamentError || !activeTournament) {
      throw new Error('No active tournament found');
    }

    // Get tournament data from PGA API
    const tournamentData = await getTournament(activeTournament.pga_tournament_id);
    
    // Update tournament status, current round, and par total
    const { error: updateTournamentError } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: tournamentData.status,
        current_round: tournamentData.currentRound.$numberInt || tournamentData.currentRound,
        par_total: tournamentData.parTotal || null
      })
      .eq('id', activeTournament.id);

    if (updateTournamentError) {
      throw updateTournamentError;
    }

    const currentRound = tournamentData.currentRound.$numberInt || tournamentData.currentRound;
    console.log(`Updated tournament status to ${tournamentData.status}, current round to ${currentRound}, and par total to ${tournamentData.parTotal || 'null'}`);
    
    if (!tournamentData.players?.length) {
      throw new Error('No players found in tournament data');
    }

    console.log(`\nTotal players in tournament: ${tournamentData.players.length}`);
    let newPlayersCount = 0;

    // Process each player in the tournament
    for (const player of tournamentData.players) {
      // Check if player already exists in golfer_scores
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
        tournament_id: activeTournament.id,
        status: 'active',
        position: '-',
        total: '-',
        current_round_score: '-',
        current_hole: null,
        starting_hole: null,
        round_complete: false,
        thru: null,
        current_round: 0,
        tee_time: null
      };

      if (!existingPlayer) {
        // Insert new player
        const { error: insertError } = await supabaseAdmin
          .from('golfer_scores')
          .insert(playerData);

        if (insertError) {
          console.error(`Error inserting player ${player.firstName} ${player.lastName}:`, insertError);
          continue;
        }
        console.log(`Added new player: ${player.firstName} ${player.lastName}`);
        newPlayersCount++;
      } else {
        // Update existing player with all initial values
        const { error: updateError } = await supabaseAdmin
          .from('golfer_scores')
          .update(playerData)
          .eq('player_id', player.playerId);

        if (updateError) {
          console.error(`Error updating player ${player.firstName} ${player.lastName}:`, updateError);
          continue;
        }
        console.log(`Updated player: ${player.firstName} ${player.lastName}`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`Total players in tournament: ${tournamentData.players.length}`);
    console.log(`New players added to database: ${newPlayersCount}`);
    console.log(`Existing players updated: ${tournamentData.players.length - newPlayersCount}`);

    return { success: true, message: 'Tournament players set up successfully' };
  } catch (error) {
    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Execute the function if this script is run directly.
// NOTE: odds/rankings are run here (scoped to the active field) instead of at
// module scope so that importing this file (e.g. from /api/setup-tournament)
// does NOT trigger background jobs. This mirrors the API route's flow so the
// CLI and the admin "Setup Tournament" button behave identically.
if (require.main === module) {
  (async () => {
    const result = await setTournament();
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);

    await updateOdds({ onlyActiveTournamentField: true });
    await updateRankings({ onlyActiveTournamentField: true });
    process.exit(0);
  })();
}

// Export for use in other modules
export { setTournament };