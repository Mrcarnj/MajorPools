import { supabaseAdmin } from '../lib/supabase-admin';

interface DataGolfPlayer {
  dg_id: number;
  name: string;
}

async function createDataGolfId() {
  try {
    console.log('🎯 Checking DataGolf players against our database...\n');

    // Fetch all golfers from our database
    const { data: ourGolfers, error: ourGolfersError } = await supabaseAdmin
      .from('golfer_scores')
      .select('player_id, first_name, last_name, dg_id');

    if (ourGolfersError) {
      throw ourGolfersError;
    }

    // Create a map of our golfers for easy lookup
    const ourGolfersMap = new Map(
      ourGolfers.map(golfer => [
        `${golfer.last_name}, ${golfer.first_name}`.toLowerCase(),
        { player_id: golfer.player_id, dg_id: golfer.dg_id }
      ])
    );

    // Fetch DataGolf data
    const url = "https://feeds.datagolf.com/betting-tools/outrights";
    const params = new URLSearchParams({
      tour: "pga",
      market: "win",
      odds_format: "american",
      key: "f699a70c027aa740baffa1afcd2b"
    });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    const missingPlayers: { name: string; dg_id: number }[] = [];
    const matchedPlayers: { name: string; dg_id: number }[] = [];

    // Check each DataGolf player against our database
    for (const player of data.odds) {
      const fullName = player.player_name.toLowerCase();
      const ourGolfer = ourGolfersMap.get(fullName);

      if (ourGolfer) {
        matchedPlayers.push({ name: player.player_name, dg_id: player.dg_id });
      } else {
        missingPlayers.push({ name: player.player_name, dg_id: player.dg_id });
      }
    }

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Total DataGolf players: ${data.odds.length}`);
    console.log(`Players in our database: ${matchedPlayers.length}`);
    console.log(`Players missing from our database: ${missingPlayers.length}`);

    if (missingPlayers.length > 0) {
      console.log('\nMissing players:');
      missingPlayers.forEach(player => console.log(`- ${player.name} (DG ID: ${player.dg_id})`));
    }

    console.log('\n✅ DataGolf player check complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

export { createDataGolfId };

// Execute the function
createDataGolfId(); 