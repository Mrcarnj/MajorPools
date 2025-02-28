// This is a stub file that provides a dummy trpc object
// It's used to satisfy imports without actually implementing tRPC
import React from 'react';

// Define a type for our dummy client
type DummyTrpcClient = {
  createClient: () => any;
  Provider: React.FC<any>;
  useQuery: () => { data: null; isLoading: boolean; error: null };
  useMutation: () => { mutate: () => void; isLoading: boolean; error: null };
};

// Create a proxy object that returns empty data for any property access
const createDummyProxy = () => {
  return new Proxy({}, {
    get: (_, prop) => {
      // For methods like useQuery, useMutation, etc.
      if (typeof prop === 'string') {
        return () => ({ 
          data: null, 
          isLoading: false, 
          error: null,
          mutate: () => {},
        });
      }
      return undefined;
    }
  });
};

// Export a dummy trpc object
export const trpc = {
  createClient: () => ({}),
  Provider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useQuery: () => ({ data: null, isLoading: false, error: null }),
  useMutation: () => ({ mutate: () => {}, isLoading: false, error: null }),
  // Add a proxy for any other accessed properties
  ...createDummyProxy()
} as DummyTrpcClient & Record<string, any>;