import { config } from 'dotenv';
import { getWorldRankings } from '../services/pga-tour/tournaments';

config({ path: '.env.local' });

async function testWorldRankings() {
  try {
    console.log('🌎 Testing World Rankings API...\n');

    const rankings = await getWorldRankings();
    
    // Show first player's ranking data
    if (rankings?.[0]) {
      console.log('First Player Ranking Data:');
      console.log(JSON.stringify(rankings[0], null, 2));
    } else {
      console.log('No ranking data found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWorldRankings(); 