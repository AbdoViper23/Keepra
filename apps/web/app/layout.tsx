import type { Metadata } from 'next';

import './globals.css';
import { Providers } from './providers';
import { TopNav } from '@/components/keepra/TopNav';
import { Footer } from '@/components/keepra/Footer';

export const metadata: Metadata = {
  title: 'Keepra — Programmable conditional release on Sui',
  description:
    'Encrypt secrets client-side, store on Walrus, release only when on-chain conditions are met. Keepra mathematically cannot decrypt your vault.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@1,500;1,600;1,700&display=swap"
        />
      </head>
      <body className="font-display antialiased">
        <Providers>
          <div className="min-h-dvh flex flex-col bg-background text-foreground">
            <TopNav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
