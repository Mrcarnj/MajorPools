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

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 