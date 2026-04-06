import { getTournament } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';

type TournamentPlayer = {
  playerId?: string;
  firstName?: string;
  lastName?: string;
  isAmateur?: boolean;
  player?: {
    playerId?: string;
    firstName?: string;
    lastName?: string;
    isAmateur?: boolean;
  };
};

function readNumberInt(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === 'object' && '$numberInt' in (value as Record<string, unknown>)) {
    const parsed = Number((value as { $numberInt?: string }).$numberInt);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function normalizePlayer(player: TournamentPlayer) {
  const source = player.player ?? player;
  return {
    playerId: String(source.playerId ?? '').trim(),
    firstName: String(source.firstName ?? '').trim(),
    lastName: String(source.lastName ?? '').trim(),
    isAmateur: Boolean(source.isAmateur),
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function setupTournamentField() {
  try {
    const { data: activeTournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, pga_tournament_id, year')
      .eq('is_active', true)
      .single();

    if (tournamentError || !activeTournament) {
      throw new Error('No active tournament found');
    }

    const year = String(activeTournament.year || new Date().getFullYear());
    const tournamentData = await getTournament(String(activeTournament.pga_tournament_id), year);

    const purse = readNumberInt(tournamentData.purse);
    const status = tournamentData.status ?? 'Not Started';
    const currentRound = readNumberInt(tournamentData.currentRound);
    const playersRaw: TournamentPlayer[] = Array.isArray(tournamentData.players) ? tournamentData.players : [];
    const players = playersRaw
      .map(normalizePlayer)
      .filter((p) => p.playerId.length > 0 && (p.firstName.length > 0 || p.lastName.length > 0));

    console.log('=== Active Tournament Basics ===');
    console.log(`Tournament: ${activeTournament.name}`);
    console.log(`Purse: ${purse ?? 'N/A'}`);
    console.log(`Status: ${status}`);
    console.log(`Current Round: ${currentRound ?? 'N/A'}`);

    const { error: tournamentUpdateError } = await supabaseAdmin
      .from('tournaments')
      .update({
        purse,
        status,
        current_round: currentRound,
      })
      .eq('id', activeTournament.id);

    if (tournamentUpdateError) {
      throw tournamentUpdateError;
    }

    const fieldPlayerIds = players.map((p) => p.playerId);
    const fieldPlayerSet = new Set(fieldPlayerIds);

    const { data: currentFieldPlayers, error: currentFieldError } = await supabaseAdmin
      .from('golfer_scores')
      .select('player_id')
      .eq('tournament_id', activeTournament.id);

    if (currentFieldError) {
      throw currentFieldError;
    }

    const playersToRemove = (currentFieldPlayers ?? [])
      .map((p) => p.player_id)
      .filter((playerId) => !fieldPlayerSet.has(playerId));

    if (playersToRemove.length > 0) {
      const { error: removeError } = await supabaseAdmin
        .from('golfer_scores')
        .update({ tournament_id: null })
        .in('player_id', playersToRemove);

      if (removeError) {
        throw removeError;
      }
    }

    for (const player of players) {
      const playerData = {
        player_id: player.playerId,
        first_name: player.firstName,
        last_name: player.lastName,
        is_amateur: player.isAmateur,
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
        tee_time: null,
      };

      const { error: upsertError } = await supabaseAdmin
        .from('golfer_scores')
        .upsert(playerData, { onConflict: 'player_id' });

      if (upsertError) {
        console.error(`Failed to upsert ${player.firstName} ${player.lastName} (${player.playerId})`, upsertError);
        throw upsertError;
      }
    }

    return {
      success: true,
      message: `Field setup complete. ${players.length} players assigned to active tournament.`,
      playerIds: fieldPlayerIds,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error: ${formatError(error)}`,
      playerIds: [] as string[],
    };
  }
}

if (require.main === module) {
  setupTournamentField().then((result) => {
    if (result.success) {
      console.log(result.message);
      process.exit(0);
    }

    console.error(result.message);
    process.exit(1);
  });
}

export { setupTournamentField };
