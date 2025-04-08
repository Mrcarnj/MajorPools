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

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Create a regular Supabase client for scripts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser, // Only persist session in browser
    autoRefreshToken: isBrowser, // Only auto refresh in browser
    detectSessionInUrl: isBrowser, // Only detect session in URL in browser
    storageKey: 'supabase.auth.token',
    storage: isBrowser ? {
      getItem: (key) => {
        try {
          const itemStr = localStorage.getItem(key);
          if (!itemStr) return null;
          
          const item = JSON.parse(itemStr);
          const now = new Date();
          
          // Compare the expiry time of the item with the current time
          if (now.getTime() > item.expiry) {
            // If the item is expired, delete the item from storage
            localStorage.removeItem(key);
            return null;
          }
          return item.value;
        } catch (error) {
          console.error('Error getting auth item from storage:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          const item = {
            value: value,
            expiry: new Date().getTime() + (7 * 24 * 60 * 60 * 1000), // 7 days
          };
          localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
          console.error('Error setting auth item in storage:', error);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Error removing auth item from storage:', error);
        }
      }
    } : undefined
  }
});

// Only set up auth state change listener in browser
if (isBrowser) {
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