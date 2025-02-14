'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useSession, SessionProvider } from 'next-auth/react';

const AuthContext = createContext<{
  isAuthenticated: boolean;
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
}>({
  isAuthenticated: false,
  user: null,
});

// This is the provider that wraps our app
export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <SessionProvider>
      <AuthContextProvider>{children}</AuthContextProvider>
    </SessionProvider>
  );
}

// This is the internal provider that uses the session
function AuthContextProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        user: session?.user ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 