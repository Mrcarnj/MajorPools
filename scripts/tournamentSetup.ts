import { setTournament } from './set-tournament';
import { updateOdds } from './update-odds';
import { updateRankings } from './update-rankings';
import { updateTournament } from './update-tournament';

async function tournamentSetup() {
  const result = await setTournament();
  await updateOdds();
  await updateRankings();
  await updateTournament();
}

tournamentSetup().then(() => {
  console.log('Tournament setup complete');
  process.exit(0);
}).catch((error) => {
  console.error('Tournament setup failed:', error);
  process.exit(1);
});