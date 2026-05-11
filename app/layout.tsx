import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import ClientLayout from '@/app/client-layout';
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['700', '800', '900'],
});

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
      <body className={`${inter.className} ${playfair.variable}`}>
        <ClientLayout>
          {children}
        </ClientLayout>
        <SpeedInsights />
      </body>
    </html>
  );
}
