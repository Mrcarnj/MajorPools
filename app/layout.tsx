import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ClientLayout from '@/app/client-layout';

const inter = Inter({ subsets: ['latin'] });

// Metadata needs to be in a separate file for Client Components
export const metadata: Metadata = {
  title: 'Major Pools | Fantasy Golf Contests',
  description: 'Fantasy golf scoring and leaderboards for major golf tournaments',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}