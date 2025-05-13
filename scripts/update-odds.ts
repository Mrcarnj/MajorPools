import { supabaseAdmin } from '../lib/supabase-admin';

async function updateOdds() {
  try {
    console.log('🎯 Updating golf odds...\n');

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
    
    // Debug log for first player
    if (data.odds && data.odds.length > 0) {
      console.log('Sample player data:', JSON.stringify(data.odds[0], null, 2));
    }
    
    // Process each player's odds
    for (const player of data.odds) {
      // FanDuel odds are directly in the player object
      const fanduelOdds = player.fanduel;

      if (fanduelOdds) {
        // Update golfer_scores table
        const { error } = await supabaseAdmin
          .from('golfer_scores')
          .update({ odds: fanduelOdds })
          .eq('dg_id', player.dg_id);

        if (error) {
          console.error(`Error updating odds for player ${player.player_name}:`, error.message);
        } else {
          console.log(`Updated odds for ${player.player_name}: ${fanduelOdds}`);
        }
      } else {
        console.log(`No FanDuel odds found for ${player.player_name}`);
      }
    }

    console.log('✅ Odds update complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

export { updateOdds }; 

updateOdds();