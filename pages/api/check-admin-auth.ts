import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Create authenticated Supabase client
  const supabase = createServerSupabaseClient({ req, res });

  // Get the user's session
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  // Return auth details
  return res.status(200).json({
    authenticated: !!session,
    session: session ? {
      user: {
        email: session.user.email,
        id: session.user.id,
        metadata: session.user.user_metadata,
      },
      expires_at: session.expires_at,
    } : null,
    cookies: req.cookies,
    error: error ? error.message : null,
  });
} 