import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Try refreshing the session
  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    console.error('Error refreshing session:', e);
  }

  // Get session data
  const { data: { session }, error } = await supabase.auth.getSession();
  
  // Get all cookies
  const allCookies = cookies().getAll().map(c => ({
    name: c.name,
    value: c.value.substring(0, 5) + '...',
  }));
  
  // Return debug info
  return NextResponse.json({
    authenticated: !!session,
    session: session ? {
      user: {
        email: session.user.email,
        id: session.user.id,
        userMetadata: session.user.user_metadata,
        appMetadata: session.user.app_metadata,
      },
      expires_at: session.expires_at,
    } : null,
    cookies: allCookies,
    error: error ? error.message : null,
    timestamp: new Date().toISOString(),
  });
} 