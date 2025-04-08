'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
<<<<<<< HEAD
import { supabaseBrowser } from '@/lib/supabase-browser';
=======
import { incrementAuthRequestCount, getAuthRequestCount } from './auth-stats';

// Set this to false to disable all auth-related logging
const DEBUG_AUTH = false;
>>>>>>> 1560f24088ca14c260fef5b337ec63a4e31a0578

type AuthContextType = {
  session: Session | null;
  loading: boolean;
<<<<<<< HEAD
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
=======
  requestCount: number;
  refreshSession: () => Promise<void>;
>>>>>>> 1560f24088ca14c260fef5b337ec63a4e31a0578
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
<<<<<<< HEAD
  refreshSession: async () => {},
  logout: async () => {},
=======
  requestCount: 0,
  refreshSession: async () => {},
>>>>>>> 1560f24088ca14c260fef5b337ec63a4e31a0578
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
<<<<<<< HEAD
  const [mounted, setMounted] = useState(false);
  // Use a ref to track the current session ID to prevent unnecessary updates
  const sessionIdRef = useRef<string | null>(null);

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
        const newSessionId = data.session?.user?.id || null;
        if (newSessionId !== sessionIdRef.current) {
          sessionIdRef.current = newSessionId;
          setSession(data.session);
        }
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
        sessionIdRef.current = null;
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
          const newSessionId = data.session?.user?.id || null;
          sessionIdRef.current = newSessionId;
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
=======
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
>>>>>>> 1560f24088ca14c260fef5b337ec63a4e31a0578

    initializeAuth();

    // Create only one auth state change listener throughout the app
    incrementAuthCallCount(); // Count setting up the listener as an auth call
    const {
      data: { subscription },
<<<<<<< HEAD
    } = supabaseBrowser.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth state changed:', { 
        event, 
        hasSession: !!newSession,
        userId: newSession?.user?.id,
        count: incrementAuthCallCount() // Count this auth event
      });
      
      // Only update session if it actually changed - compare by user ID
      const newSessionId = newSession?.user?.id || null;
      if (newSessionId !== sessionIdRef.current) {
        sessionIdRef.current = newSessionId;
        setSession(newSession);
        
        // Update refresh timestamp on login/logout events
        if (event === 'SIGNED_IN') {
          localStorage.setItem(SESSION_REFRESH_KEY, Date.now().toString());
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(SESSION_REFRESH_KEY);
        }
      }
      
=======
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
>>>>>>> 1560f24088ca14c260fef5b337ec63a4e31a0578
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // Remove session from dependencies to prevent infinite loop

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  const value = {
    session,
    loading,
<<<<<<< HEAD
    refreshSession,
    logout,
=======
    requestCount,
    refreshSession,
>>>>>>> 1560f24088ca14c260fef5b337ec63a4e31a0578
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 