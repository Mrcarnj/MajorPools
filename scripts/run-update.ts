import { updateTournament } from './update-tournament';

// This script is designed to be run by a scheduler (like cron)
// It will update the tournament data, leaderboard, and calculate scores

async function runUpdate() {
  const result = await updateTournament();
  
  if (result.success) {
    console.log(`[${new Date().toISOString()}] ${result.message}`);
    process.exit(0);
  } else {
    console.error(`[${new Date().toISOString()}] ${result.message}`);
    process.exit(1);
  }
}

runUpdate(); 