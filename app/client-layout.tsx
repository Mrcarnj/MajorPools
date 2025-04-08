'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TrpcProvider } from '@/components/providers/trpc-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Header } from '@/components/header';
import { Analytics } from '@vercel/analytics/react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TrpcProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </TrpcProvider>
    </AuthProvider>
  );
} 