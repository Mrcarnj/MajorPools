import { getSchedule } from '../services/pga-tour/tournaments';

/** Parse API number: either a number or MongoDB-style { $numberLong: "..." } */
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (value && typeof value === 'object' && '$numberLong' in value) {
    const n = Number((value as { $numberLong: string }).$numberLong);
    return Number.isNaN(n) ? null : n;
  }
  if (value != null && typeof value === 'object' && '$numberInt' in value) {
    const n = Number((value as { $numberInt: string }).$numberInt);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

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
      const startMs = Number(event.date?.start?.$date?.$numberLong ?? event.date?.start);
      const endMs = Number(event.date?.end?.$date?.$numberLong ?? event.date?.end);
      const startDate = new Date(startMs);
      const endDate = new Date(endMs);
      console.log(`Start: ${startDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);
      console.log(`End: ${endDate.toUTCString().split(' ').slice(0, 4).join(' ')}`);

      console.log(`Week: ${event.date?.weekNumber ?? '—'}`);
      console.log('\nStatus:');
      console.log(`Format: ${event.format ?? '—'}`);

      const purse = parseNumber((event as Record<string, unknown>).purse);
      const winnersShare = parseNumber((event as Record<string, unknown>).winnersShare);
      const fedexCupPoints = parseNumber((event as Record<string, unknown>).fedexCupPoints);

      console.log(`Purse: ${purse != null ? `$${purse.toLocaleString()}` : '—'}`);
      console.log(`Winner's Share: ${winnersShare != null ? `$${winnersShare.toLocaleString()}` : '—'}`);
      console.log(`FedEx Cup Points: ${fedexCupPoints != null ? fedexCupPoints.toLocaleString() : '—'}`);
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSchedule('2026');
