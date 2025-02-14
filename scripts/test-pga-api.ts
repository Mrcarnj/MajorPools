import { config } from 'dotenv';
import { getTournament } from '../services/pga-tour/tournaments';

// Load environment variables
config({ path: '.env.local' });

async function testTournament() {
  try {
    console.log('🏌️ Testing PGA Tour API for Genesis Invitational...\n');

    const tournament = await getTournament('007');
    
    console.log('Tournament Details:');
    console.log('------------------');
    console.log(`ID: ${tournament._id}`);
    console.log(`Org ID: ${tournament.orgId}`);
    console.log(`Year: ${tournament.year}`);
    console.log(`Tournament ID: ${tournament.tournId}`);
    console.log(`Name: ${tournament.name}`);
    console.log(`Purse: $${tournament.purse}`);
    console.log(`FedEx Cup Points: ${tournament.fedexCupPoints}`);
    console.log('\nDates:');
    // Extract just the numbers from MongoDB format
    const startMs = Number(tournament.date.start.$date.$numberLong);
    const endMs = Number(tournament.date.end.$date.$numberLong);

    // Now we can create proper dates
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    // Get just the date part from UTC string
    console.log(`Start: ${startDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);
    console.log(`End: ${endDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);

    console.log(`Week: ${tournament.date.weekNumber}`);
    console.log('\nStatus:');
    console.log(`Format: ${tournament.format}`);
    console.log(`Status: ${tournament.status}`);
    console.log(`Current Round: ${tournament.currentRound}`);
    console.log(`Time Zone: ${tournament.timeZone}`);
    console.log('\nCourse:');
    const course = tournament.courses[0];
    console.log(`ID: ${course.courseId}`);
    console.log(`Name: ${course.courseName}`);
    console.log(`Host: ${course.host}`);
    console.log(`Par Front Nine: ${course.parFrontNine}`);
    console.log(`Par Back Nine: ${course.parBackNine}`);
    console.log(`Par Total: ${course.parTotal}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTournament(); 