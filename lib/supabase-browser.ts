import { createClient } from '@supabase/supabase-js';

// This file should only be imported in browser components
// It contains the Supabase client with localStorage access

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use a singleton pattern to ensure only one client exists
let supabaseBrowserInstance: ReturnType<typeof createClient> | null = null;

// Create a browser-specific Supabase client with auth features
export const supabaseBrowser = (() => {
  if (supabaseBrowserInstance) return supabaseBrowserInstance;
  
  supabaseBrowserInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'supabase.auth.token',
      storage: {
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
      }
    }
  });
  
  return supabaseBrowserInstance;
})();

// No onAuthStateChange listener here - handled in AuthContext 