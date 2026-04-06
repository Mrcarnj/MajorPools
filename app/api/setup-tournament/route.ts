import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { setTournament } from '../../../scripts/set-tournament';
import { updateOdds } from '../../../scripts/update-odds';
import { updateRankings } from '../../../scripts/update-rankings';
import { updateTournament } from '../../../scripts/update-tournament';

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore,
  });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || session.user.user_metadata?.role !== 'admin') {
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
