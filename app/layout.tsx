'use client';

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TrpcProvider } from '@/components/providers/trpc-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Header } from '@/components/header';

const inter = Inter({ subsets: ['latin'] });

// Remove the metadata export since it's not supported in Client Components
// export const metadata: Metadata = {
//   title: 'PGA Tour Fantasy Golf',
//   description: 'Fantasy golf scoring and leaderboards for PGA Tour tournaments',
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
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
            </ThemeProvider>
          </TrpcProvider>
        </AuthProvider>
      </body>
    </html>
  );
}