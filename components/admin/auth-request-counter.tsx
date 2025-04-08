'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthRequestCount } from '@/lib/auth/auth-stats';

export function AuthRequestCounter() {
  const { requestCount: contextRequestCount } = useAuth();
  const [serverRequestCount, setServerRequestCount] = useState(0);

  // This will fetch the server-side count periodically
  useEffect(() => {
    // Initial fetch
    setServerRequestCount(getAuthRequestCount());
    
    // Set up interval to refresh the count every 5 seconds
    const interval = setInterval(() => {
      setServerRequestCount(getAuthRequestCount());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Auth Request Counter</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Client Auth Requests:</span>
            <span className="font-medium">{contextRequestCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Server Auth Requests:</span>
            <span className="font-medium">{serverRequestCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Auth Requests:</span>
            <span className="font-medium">{contextRequestCount + serverRequestCount}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 