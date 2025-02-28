# Tournament Update Scripts

This directory contains scripts for updating tournament data, leaderboard information, and calculating scores for entries.

## Scripts

### `update-tournament.ts`

This script combines the functionality of:
- Updating tournament status and current round
- Fetching and updating the leaderboard data
- Calculating scores for all entries

It performs the following operations:
1. Fetches the active tournament from the database
2. Updates the tournament status and current round from the PGA Tour API
3. Fetches the leaderboard data and updates golfer scores
4. Updates the cut score if available
5. Calculates scores for all entries based on the updated golfer scores

### `run-update.ts`

A simple wrapper script that runs the `updateTournament` function and handles logging and exit codes.

## Usage

You can run the update script using:

```bash
npm run update-tournament
```

Or directly with:

```bash
npx tsx scripts/run-update.ts
```

## Scheduling Updates

For production use, you should set up a cron job or similar scheduler to run this script at regular intervals.

Example cron job (runs every 5 minutes):

```
*/5 * * * * cd /path/to/your/app && npm run update-tournament >> /path/to/logs/update.log 2>&1
```

## Error Handling

The script includes error handling and will:
- Log errors to the console
- Exit with code 1 on failure
- Exit with code 0 on success 