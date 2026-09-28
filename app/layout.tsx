import './globals.css';
import React from 'react';
import Navigation from '@/components/Navigation';
import { Barlow_Condensed, Inter, Space_Mono } from 'next/font/google';

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: "King's College London Mountaineering & Climbing Club (KCLMC)",
  description: "Official student climbing and mountaineering society at King's College London. KCLSU Accredited.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${barlowCondensed.variable} ${inter.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-[#FFBD59] selection:text-[#052322] flex flex-col font-sans">
        <Navigation />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
