import { supabase } from '@/lib/supabase';
import { calculateEntryScore } from '@/utils/scoring';
import type { GolferScore } from '@/utils/scoring';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Get all entries
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('*');

    if (entriesError) throw entriesError;

    // Get all current scores
    const { data: scores, error: scoresError } = await supabase
      .from('golfer_scores')
      .select('player_id, total, position');

    if (scoresError) throw scoresError;

    // Create scores map for quick lookup
    const scoresMap = new Map(scores.map(s => [s.player_id, s]));

    // Calculate score for each entry
    for (const entry of entries) {
      const golferScores = [
        entry.tier1_golfer1, entry.tier1_golfer2,
        entry.tier2_golfer1, entry.tier2_golfer2,
        entry.tier3_golfer1, entry.tier3_golfer2,
        entry.tier4_golfer1, entry.tier4_golfer2,
        entry.tier5_golfer1, entry.tier5_golfer2
      ].map(id => scoresMap.get(id))
        .filter((score): score is GolferScore => {
          if (!score) return false;
          return 'total' in score && 'position' in score && 'player_id' in score;
        });

      const entryScore = calculateEntryScore(golferScores);

      // Update entry score in database
      const { error: updateError } = await supabase
        .from('entries')
        .update({ calculated_score: entryScore })
        .eq('id', entry.id);

      if (updateError) throw updateError;
    }

    return new Response('Scores calculated successfully', { status: 200 });
  } catch (error) {
    console.error('Error calculating scores:', error);
    return new Response('Error calculating scores', { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || session.user.user_metadata?.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  // Rest of your calculate scores logic
}