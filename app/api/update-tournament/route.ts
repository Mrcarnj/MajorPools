import { createClient } from '@supabase/supabase-js';
import { updateTournament } from '../../../scripts/update-tournament';

// updateTournament() uses Node-only APIs (node-fetch, nodemailer) and does a lot
// of sequential PGA-API + DB work (a SELECT + INSERT/UPDATE per leaderboard
// player, then a pass over every entry). Force the Node runtime and give it
// headroom, otherwise the platform's default ~10s timeout kills the request
// mid-run and the "Refresh Data" button always fails with an opaque 504.
export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  // Tracks which phase we're in so any thrown error can be attributed to a step.
  let step = 'init';

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json(
        {
          error: 'Server configuration error',
          step,
          requestId,
          details: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY on the server',
        },
        { status: 500 }
      );
    }

    // updateTournament() uses the service-role client (lib/supabase-admin), which
    // throws at import if this is missing. Surface it clearly instead of as a
    // generic 500.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
          error: 'Server configuration error',
          step,
          requestId,
          details: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server',
        },
        { status: 500 }
      );
    }

    step = 'auth';
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

    if (!accessToken) {
      return Response.json(
        { error: 'Unauthorized', step, requestId, details: 'Missing bearer token' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return Response.json(
        {
          error: 'Unauthorized',
          step,
          requestId,
          details: userError?.message || 'Could not resolve a user for the provided token',
        },
        { status: 401 }
      );
    }

    if (user.user_metadata?.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden', step, requestId, details: 'Signed-in user is not an admin' },
        { status: 403 }
      );
    }

    step = 'update-tournament';
    const result = await updateTournament();

    if (!result.success) {
      const failedStage = result.stage || step;
      console.error(`[update-tournament ${requestId}] failed at stage "${failedStage}":`, result.message);
      return Response.json(
        {
          error: `Refresh failed during "${failedStage}"`,
          step: failedStage,
          requestId,
          details: result.details || result.message,
        },
        { status: 500 }
      );
    }

    return Response.json({ success: true, message: result.message, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[update-tournament ${requestId}] threw at step "${step}":`, error);
    return Response.json(
      {
        error: `Refresh failed during "${step}"`,
        step,
        requestId,
        details: message,
      },
      { status: 500 }
    );
  }
}
