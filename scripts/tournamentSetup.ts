import { setupTournamentField } from './setup-tournament-field';
import { updateOdds } from './update-odds';
import { updateRankings } from './update-rankings';

async function tournamentSetup() {
  const fieldSetupResult = await setupTournamentField();
  if (!fieldSetupResult.success) {
    throw new Error(fieldSetupResult.message);
  }

  await updateRankings({ playerIds: fieldSetupResult.playerIds });
  await updateOdds({ playerIds: fieldSetupResult.playerIds });
}

tournamentSetup().then(() => {
  console.log('Tournament setup complete');
  process.exit(0);
}).catch((error) => {
  console.error('Tournament setup failed:', error);
  process.exit(1);
});