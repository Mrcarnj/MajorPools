'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase-browser';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  refreshSession: async () => {},
  logout: async () => {},
});

// Use local storage to store the last refresh time
const SESSION_REFRESH_KEY = 'supabase.session.lastRefresh';
const SESSION_MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Optimized refresh session function with throttling
  const refreshSession = useCallback(async (force = false) => {
    // Check if we've refreshed recently, unless force = true
    if (!force) {
      const lastRefreshStr = localStorage.getItem(SESSION_REFRESH_KEY);
      const now = Date.now();
      if (lastRefreshStr) {
        const lastRefresh = parseInt(lastRefreshStr, 10);
        if (now - lastRefresh < SESSION_MIN_INTERVAL) {
          // Skip this refresh as it's too soon after the last one
          return;
        }
      }
    }

    try {
      const { data, error } = await supabaseBrowser.auth.getSession();
      if (error) {
        console.error('Error refreshing session:', error);
      } else {
        setSession(data.session);
        // Update the refresh timestamp
        localStorage.setItem(SESSION_REFRESH_KEY, Date.now().toString());
      }
    } catch (error) {
      console.error('Error in refreshSession:', error);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      const { error } = await supabaseBrowser.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      } else {
        setSession(null);
        localStorage.removeItem(SESSION_REFRESH_KEY);
      }
    } catch (error) {
      console.error('Error in logout:', error);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    
    // Get initial session only once when component mounts
    const initializeAuth = async () => {
      try {
        // Try to get session from localStorage first if available
        const { data, error } = await supabaseBrowser.auth.getSession();
        if (error) {
          console.error('Error getting initial session:', error);
        } else {
          setSession(data.session);
          // Set initial refresh timestamp
          localStorage.setItem(SESSION_REFRESH_KEY, Date.now().toString());
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Create only one auth state change listener throughout the app
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth state changed:', { event, hasSession: !!newSession });
      
      // Only update session if it actually changed
      if ((!!session) !== (!!newSession) || 
          (session?.user?.id !== newSession?.user?.id)) {
        setSession(newSession);
        
        // Update refresh timestamp on login/logout events
        if (event === 'SIGNED_IN') {
          localStorage.setItem(SESSION_REFRESH_KEY, Date.now().toString());
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(SESSION_REFRESH_KEY);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [session]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  const value = {
    session,
    loading,
    refreshSession,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 