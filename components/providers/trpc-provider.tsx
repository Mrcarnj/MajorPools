'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Just use QueryClientProvider without any tRPC
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}