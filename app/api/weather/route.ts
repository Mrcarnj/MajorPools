import { NextResponse } from 'next/server';
import { fetchVenueWeatherToday } from '@/lib/weather/open-meteo';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city')?.trim() || null;
  const state = searchParams.get('state')?.trim() || null;
  const country = searchParams.get('country')?.trim() || null;

  if (!city && !country) {
    return NextResponse.json(
      { error: 'Provide at least city or country' },
      { status: 400 }
    );
  }

  const result = await fetchVenueWeatherToday({ city, state, country });
  if ('error' in result) {
    const status = result.error === 'Location not found' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
}
