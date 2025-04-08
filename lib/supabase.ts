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

// Use singleton pattern for server-side client
let supabaseInstance: ReturnType<typeof createClient> | null = null;

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