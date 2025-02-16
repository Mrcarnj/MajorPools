import { config } from 'dotenv';
import { getSchedule } from '../services/pga-tour/tournaments';

// Load environment variables
config({ path: '.env.local' });

async function testSchedule(year: string) {
  try {
    console.log(`📅 Testing PGA Tour API for schedule of year ${year}...\n`);

    const schedule = await getSchedule(year);
    
    for (const event of schedule) {
      console.log('Event Details:');
      console.log('--------------');
      console.log(`ID: ${event.tournId}`);
      console.log(`Name: ${event.name}`);
      
      console.log('\nDates:');
      const startMs = Number(event.date.start.$date.$numberLong);
      const endMs = Number(event.date.end.$date.$numberLong);
  
      // Now we can create proper dates
      const startDate = new Date(startMs);
      const endDate = new Date(endMs);
      console.log(`Start: ${startDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);
      console.log(`End: ${endDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);

      console.log(`Week: ${event.date.weekNumber}`);
      console.log('\nStatus:');
      console.log(`Format: ${event.format}`);
      console.log(`Purse: $${event.purse.toLocaleString()}`);
      console.log(`Winner's Share: $${event.winnersShare.toLocaleString()}`);
      console.log(`FedEx Cup Points: ${event.fedexCupPoints}`);
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSchedule('2024');
