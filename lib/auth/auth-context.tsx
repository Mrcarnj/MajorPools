'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { incrementAuthRequestCount, getAuthRequestCount } from './auth-stats';

// Set this to false to disable all auth-related logging
const DEBUG_AUTH = false;

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  requestCount: number;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  requestCount: 0,
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestCount, setRequestCount] = useState(0);

  // Function to explicitly refresh the session
  const refreshSession = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        if (DEBUG_AUTH) console.error('Error refreshing session:', error);
        return;
      }
      
      // Increment counter and update state
      const newCount = incrementAuthRequestCount();
      setRequestCount(newCount);
      
      if (DEBUG_AUTH) {
        console.log('Manual session refresh:', {
          hasSession: !!currentSession,
          user: currentSession?.user?.email,
          role: currentSession?.user?.user_metadata?.role,
          metadata: JSON.stringify(currentSession?.user?.user_metadata || {}),
          timestamp: new Date().toISOString(),
          requestCount: newCount
        });
      }
      
      setSession(currentSession);
    } catch (e) {
      if (DEBUG_AUTH) console.error('Error during manual session refresh:', e);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      // Increment auth request counter
      const newCount = incrementAuthRequestCount();
      setRequestCount(newCount);
      
      if (DEBUG_AUTH) {
        console.log('Initial session check:', {
          hasSession: !!initialSession,
          user: initialSession?.user?.email,
          role: initialSession?.user?.user_metadata?.role,
          metadata: JSON.stringify(initialSession?.user?.user_metadata || {}),
          error: error?.message,
          timestamp: new Date().toISOString(),
          requestCount: newCount
        });
      }
      
      setSession(initialSession);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Increment auth request counter
      const newCount = incrementAuthRequestCount();
      setRequestCount(newCount);
      
      if (DEBUG_AUTH) {
        console.log('Auth state change:', {
          event,
          hasSession: !!newSession,
          user: newSession?.user?.email,
          role: newSession?.user?.user_metadata?.role,
          metadata: JSON.stringify(newSession?.user?.user_metadata || {}),
          timestamp: new Date().toISOString(),
          requestCount: newCount
        });
      }
      
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    loading,
    requestCount,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 