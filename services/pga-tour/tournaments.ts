import { pgaFetch } from './client';
import type { Tournament, Leaderboard, Player, Scorecard } from './types';

export async function getSchedule(year: string) {
  const response = await pgaFetch('/schedule', {
    year,
  });
  return response.schedule; // Return just the schedule array
}

export async function getTournament(tournId: string, year: string = '2026') {
  return pgaFetch('/tournament', {
    tournId,
    year,
  });
}

export async function getTournamentLeaderboard(tournId: string) {
  const response = await pgaFetch('/leaderboard', {
    tournId,
    year: '2026'
  });
  
  return response; // Return all players
}

export async function getWorldRankings() {
  const response = await pgaFetch('/stats', {
    statId: '186',
    year: '2026'
  });
  
  return response.rankings; // Return just the rankings array
}

export async function getPlayers(): Promise<Player[]> {
  return pgaFetch('/players');
}

export async function getPlayerScorecard(
  tournId: string,
  year: string,
  playerId: string
): Promise<Scorecard[]> {
  return pgaFetch('/scorecard', {
    tournId,
    year,
    playerId,
  });
}