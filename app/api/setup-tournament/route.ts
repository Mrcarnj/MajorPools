import { createClient } from '@supabase/supabase-js';
import { setTournament } from '../../../scripts/set-tournament';
import { updateOdds } from '../../../scripts/update-odds';
import { updateRankings } from '../../../scripts/update-rankings';
import { updateTournament } from '../../../scripts/update-tournament';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

    if (!accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user || user.user_metadata?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await setTournament();
    await updateOdds();
    await updateRankings();
    await updateTournament();

    return Response.json({ success: true, message: 'Tournament setup complete' });
  } catch (error) {
    console.error('Tournament setup failed:', error);
    return Response.json(
      {
        error: 'Tournament setup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
