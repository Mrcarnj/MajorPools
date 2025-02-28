'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc/client';
import superjson from 'superjson';

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

  const [trpcClient] = useState(() => {
    if (process.env.NODE_ENV === 'production') {
      return trpc.createClient({
        links: [
          httpBatchLink({
            url: '/api/trpc',
          }),
        ],
      });
    }
    
    return trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    });
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (process.env.NODE_ENV === 'production') {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}