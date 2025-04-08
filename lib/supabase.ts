import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
// Load env variables before other imports
config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Disable verbose logging
const DEBUG = false; 

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use singleton pattern for server-side client
let supabaseInstance: ReturnType<typeof createClient> | null = null;

<<<<<<< HEAD
// Create a basic Supabase client without auth features for server-side rendering
export const supabase = (() => {
  if (supabaseInstance) return supabaseInstance;
  
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  
  return supabaseInstance;
})();

// No auth listeners in the server-side client 
=======
// Only add auth state change listener if debugging is enabled
if (DEBUG) {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', {
      event,
      hasSession: !!session,
      user: session?.user?.email,
      role: session?.user?.user_metadata?.role,
      timestamp: new Date().toISOString()
    });
  });
} 
>>>>>>> 1560f24088ca14c260fef5b337ec63a4e31a0578
