import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cagbmvwgqnbeafgpchym.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZ2JtdndncW5iZWFmZ3BjaHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1NTcyMzYsImV4cCI6MjA1NTEzMzIzNn0.Xt1StjFqz-EjHyX-GyArtojX76qdC50vQmvh4tRFwv0';

// Add debug logs
console.log('Supabase initialization:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a regular Supabase client for scripts
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, !!session);
  if (event === 'SIGNED_IN') {
    // Update localStorage
    localStorage.setItem('supabase.auth.token', JSON.stringify(session));
  }
  if (event === 'SIGNED_OUT') {
    localStorage.removeItem('supabase.auth.token');
  }
}); 