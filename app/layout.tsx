import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Parachute Admin',
  description: 'Internal bot fleet monitor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-neutral-950 text-neutral-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
