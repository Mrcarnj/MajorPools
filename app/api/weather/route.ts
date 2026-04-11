import { NextResponse } from 'next/server';
import { fetchVenueWeatherToday } from '@/lib/weather/open-meteo';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city')?.trim() || null;
  const state = searchParams.get('state')?.trim() || null;
  const country = searchParams.get('country')?.trim() || null;
  const forDay = searchParams.get('for')?.trim() ?? '';
  const calendarDay = ISO_DAY.test(forDay)
    ? forDay
    : new Date().toISOString().slice(0, 10);

  if (!city && !country) {
    return NextResponse.json(
      { error: 'Provide at least city or country' },
      { status: 400 }
    );
  }

  const result = await fetchVenueWeatherToday({ city, state, country, calendarDay });
  if ('error' in result) {
    const status = result.error === 'Location not found' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  // `for` in the request URL partitions caches per calendar day so a new local day fetches fresh data.
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
