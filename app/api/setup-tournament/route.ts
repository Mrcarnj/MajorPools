import { createClient } from '@supabase/supabase-js';
import { setTournament } from '../../../scripts/set-tournament';
import { updateOdds } from '../../../scripts/update-odds';
import { updateRankings } from '../../../scripts/update-rankings';
import { updateTournament } from '../../../scripts/update-tournament';

// These scripts use Node-only APIs (dotenv, nodemailer) and do a lot of
// sequential DB/API work, so force the Node runtime and give them headroom
// before the platform kills the request.
export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type StepResult = { success: boolean; message: string };

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

    // The setup scripts use the service-role client (lib/supabase-admin), which
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

    // Run the setup pipeline sequentially. Each step returns { success, message },
    // so a failure is reported with the exact step that failed and why. Odds and
    // rankings are scoped to the active field to match the IDE/CLI flow.
    const steps: { name: string; run: () => Promise<StepResult> }[] = [
      { name: 'set-tournament', run: () => setTournament() },
      { name: 'update-odds', run: () => updateOdds({ onlyActiveTournamentField: true }) },
      { name: 'update-rankings', run: () => updateRankings({ onlyActiveTournamentField: true }) },
      { name: 'update-tournament', run: () => updateTournament() },
    ];

    for (const s of steps) {
      step = s.name;
      const result = await s.run();
      if (!result?.success) {
        console.error(`[setup-tournament ${requestId}] step "${s.name}" failed:`, result?.message);
        return Response.json(
          {
            error: `Tournament setup failed during "${s.name}"`,
            step: s.name,
            requestId,
            details: result?.message || 'Step returned no result',
          },
          { status: 500 }
        );
      }
    }

    return Response.json({ success: true, message: 'Tournament setup complete', requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[setup-tournament ${requestId}] threw at step "${step}":`, error);
    return Response.json(
      {
        error: `Tournament setup failed during "${step}"`,
        step,
        requestId,
        details: message,
      },
      { status: 500 }
    );
  }
}
