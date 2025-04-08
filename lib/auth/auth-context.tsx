'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase-browser';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);

  const refreshSession = async () => {
    // Prevent refreshing more than once every 5 seconds
    const now = Date.now();
    if (now - lastRefresh < 5000) {
      return;
    }
    setLastRefresh(now);

    try {
      const { data, error } = await supabaseBrowser.auth.getSession();
      if (error) {
        console.error('Error refreshing session:', error);
      } else {
        setSession(data.session);
      }
    } catch (error) {
      console.error('Error in refreshSession:', error);
    }
  };

  useEffect(() => {
    setMounted(true);
    
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabaseBrowser.auth.getSession();
        if (error) {
          console.error('Error getting initial session:', error);
        } else {
          setSession(data.session);
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  const value = {
    session,
    loading,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 