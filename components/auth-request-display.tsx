'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

// Set to false to disable logging
const DEBUG = false;

export function AuthRequestDisplay() {
  const { requestCount: clientRequestCount, session, refreshSession } = useAuth();
  const [serverRequestCount, setServerRequestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [serverCheckResult, setServerCheckResult] = useState<string | null>(null);

  const isAdmin = session?.user?.user_metadata?.role === 'admin';
  const userEmail = session?.user?.email;
  const userMetadata = session?.user?.user_metadata;

  useEffect(() => {
    // Function to fetch server-side count
    const fetchServerCount = async () => {
      try {
        const response = await fetch('/api/auth-stats');
        if (response.ok) {
          const data = await response.json();
          setServerRequestCount(data.count);
        }
      } catch (error) {
        if (DEBUG) console.error('Error fetching auth stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchServerCount();
    
    // Set up interval to refresh the count less frequently (20 seconds instead of 5)
    const interval = setInterval(fetchServerCount, 20000);
    
    return () => clearInterval(interval);
  }, []);

  // Test server-side authentication
  const testServerAuth = async () => {
    try {
      // First refresh the session
      await refreshSession();
      
      // Try to make a fetch request to debug auth endpoint
      const response = await fetch('/api/debug-auth');
      const data = await response.json();
      
      setServerCheckResult(JSON.stringify(data, null, 2));
      if (DEBUG) console.log('Server auth check result:', data);
    } catch (error) {
      if (DEBUG) console.error('Error testing server auth:', error);
      setServerCheckResult(JSON.stringify({ error: String(error) }, null, 2));
    }
  };

  const totalRequests = clientRequestCount + serverRequestCount;

  return (
    <div className="text-center text-xs text-muted-foreground mt-2">
      {isLoading ? (
        <span>Loading auth stats...</span>
      ) : (
        <div className="space-y-2">
          <div>Auth Requests: {totalRequests} (Client: {clientRequestCount} | Server: {serverRequestCount})</div>
          <div>{session ? `Logged in as: ${userEmail}` : 'Not logged in'}</div>
          {session && (
            <div>
              Role: {isAdmin ? 'Admin' : 'User'} 
              {userMetadata ? ` (${JSON.stringify(userMetadata)})` : ' (No metadata)'}
            </div>
          )}
          
          <div className="mt-2 text-green-500">
            Middleware Removed: Using client-side auth only
          </div>
          
          <div className="mt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={testServerAuth}
              className="text-xs px-2 py-1 h-auto"
            >
              Test Server Auth
            </Button>
          </div>
          
          {serverCheckResult && (
            <pre className="mt-2 text-left bg-secondary p-2 rounded-md text-xs overflow-auto max-h-40">
              {serverCheckResult}
            </pre>
          )}
        </div>
      )}
    </div>
  );
} 