import { getTournamentLeaderboard, getTournament } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';
import { calculateEntryScore } from '../utils/scoring';
import type { GolferScore } from '../utils/scoring';

async function updateTournament() {
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

    // 1. Update tournament status and current round
    const tournamentData = await getTournament(activeTournament.pga_tournament_id);
    
    // 2. Get leaderboard data (moved up to combine with tournament status update)
    const leaderboard = await getTournamentLeaderboard(activeTournament.pga_tournament_id);
    
    // Extract cut score from cutLines array
    const cutScore = leaderboard.cutLines?.[0]?.cutScore;
    
    // Update tournament status, current round, and cut score in a single database call
    const { error: updateTournamentError } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: tournamentData.status,
        current_round: tournamentData.currentRound.$numberInt || tournamentData.currentRound,
        cut_score: cutScore || null // Include cut score in the same update
      })
      .eq('id', activeTournament.id);

    if (updateTournamentError) {
      throw updateTournamentError;
    }

    if (!leaderboard.leaderboardRows?.length) {
      throw new Error('No players found in leaderboard');
    }

    // Get all current golfers in the database for this tournament
    const { data: existingGolfers, error: existingGolfersError } = await supabaseAdmin
      .from('golfer_scores')
      .select('player_id')
      .eq('tournament_id', activeTournament.id);

    if (existingGolfersError) {
      throw existingGolfersError;
    }

    // Create a set of player IDs from the API response for quick lookup
    const activePlayerIds = new Set(leaderboard.leaderboardRows.map((player: { playerId: string }) => player.playerId));

    // Set tournament_id to NULL for any golfers who are no longer in the tournament
    const golfersToRemove = existingGolfers.filter(golfer => !activePlayerIds.has(golfer.player_id));
    if (golfersToRemove.length > 0) {
      const { error: removeError } = await supabaseAdmin
        .from('golfer_scores')
        .update({ tournament_id: null })
        .in('player_id', golfersToRemove.map(g => g.player_id));

      if (removeError) {
        throw removeError;
      }
    }

    // Process each player in the leaderboard
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
        const { error: insertError } = await supabaseAdmin
          .from('golfer_scores')
          .insert(playerData);

        if (insertError) {
          throw insertError;
        }
      } else {
        const { error: updateError } = await supabaseAdmin
          .from('golfer_scores')
          .update(playerData)
          .eq('player_id', player.playerId);

        if (updateError) {
          throw updateError;
        }
      }
    }

    // 3. Calculate scores for all entries
    // Get all entries for this tournament
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('tournament_id', activeTournament.id);

    if (entriesError) {
      throw entriesError;
    }

    // Get all current scores
    const { data: scores, error: scoresError } = await supabaseAdmin
      .from('golfer_scores')
      .select('player_id, total, position')
      .eq('tournament_id', activeTournament.id);

    if (scoresError) {
      throw scoresError;
    }

    // Create scores map for quick lookup
    const scoresMap = new Map(scores.map(s => [s.player_id, s]));

    // Calculate score for each entry
    for (const entry of entries) {
      const golferScores = [
        entry.tier1_golfer1, entry.tier1_golfer2,
        entry.tier2_golfer1, entry.tier2_golfer2,
        entry.tier3_golfer1, entry.tier3_golfer2,
        entry.tier4_golfer1, entry.tier4_golfer2,
        entry.tier5_golfer1, entry.tier5_golfer2
      ].map(id => scoresMap.get(id))
        .filter((score): score is GolferScore => {
          if (!score) return false;
          return 'total' in score && 'position' in score && 'player_id' in score;
        });

      const entryScore = calculateEntryScore(golferScores);

      // Update entry score in database
      const { error: updateError } = await supabaseAdmin
        .from('entries')
        .update({ calculated_score: entryScore })
        .eq('id', entry.id);

      if (updateError) {
        throw updateError;
      }
    }

    return { success: true, message: 'Tournament updated successfully' };
  } catch (error) {
    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  updateTournament()
    .then(result => {
      if (result.success) {
        console.log(result.message);
      } else {
        console.error(result.message);
        process.exit(1);
      }
    });
}

// Export for use in other modules
export { updateTournament }; 