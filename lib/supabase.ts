import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
// Load env variables before other imports
config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Add debug logs
console.log('Supabase initialization:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a basic Supabase client without auth features for server-side rendering
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// Only set up auth state change listener in browser
if (typeof window !== 'undefined') {
  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', {
      event,
      hasSession: !!session,
      user: session?.user?.email,
      timestamp: new Date().toISOString()
    });
  });
} 