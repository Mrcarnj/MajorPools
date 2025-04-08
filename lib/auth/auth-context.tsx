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
const AUTH_CALL_COUNTER_KEY = 'supabase.auth.callCounter';

// Track auth calls counter
const incrementAuthCallCount = () => {
  try {
    const currentCount = parseInt(localStorage.getItem(AUTH_CALL_COUNTER_KEY) || '0', 10);
    const newCount = currentCount + 1;
    localStorage.setItem(AUTH_CALL_COUNTER_KEY, newCount.toString());
    console.log(`AUTH CALL COUNT: ${newCount} - ${new Date().toISOString()}`);
    return newCount;
  } catch (error) {
    console.error('Error updating auth call counter:', error);
    return 0;
  }
};

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
          console.log('Session refresh skipped - too recent');
          return;
        }
      }
    }

    try {
      incrementAuthCallCount(); // Count this auth call
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
      incrementAuthCallCount(); // Count this auth call
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
    
    // Reset counter on page load if needed
    if (typeof window !== 'undefined' && !localStorage.getItem(AUTH_CALL_COUNTER_KEY)) {
      localStorage.setItem(AUTH_CALL_COUNTER_KEY, '0');
    }
    
    // Get initial session only once when component mounts
    const initializeAuth = async () => {
      try {
        // Try to get session from localStorage first if available
        incrementAuthCallCount(); // Count this auth call
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
    incrementAuthCallCount(); // Count setting up the listener as an auth call
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth state changed:', { 
        event, 
        hasSession: !!newSession,
        count: incrementAuthCallCount() // Count this auth event
      });
      
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