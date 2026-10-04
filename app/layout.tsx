import './globals.css';
import React from 'react';
import type { Metadata, Viewport } from 'next';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
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

export const viewport: Viewport = {
  themeColor: '#052322',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://kclmc.org'),
  title: {
    default: "King's College London Mountaineering & Climbing Club (KCLMC)",
    template: "%s | KCLMC",
  },
  description: "Official student climbing and mountaineering society at King's College London. KCLSU Accredited society founded in 1928.",
  keywords: [
    "KCLMC",
    "King's College London Mountaineering Club",
    "KCL Climbing",
    "KCLSU",
    "London University Bouldering",
    "Student Mountaineering UK",
  ],
  authors: [{ name: "KCLMC Committee" }],
  openGraph: {
    title: "King's College London Mountaineering & Climbing Club (KCLMC)",
    description: "Official student climbing and mountaineering society at King's College London. Digital membership passes, trips, and London wall discounts.",
    url: 'https://kclmc.org',
    siteName: 'KCLMC',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "King's College London Mountaineering & Climbing Club (KCLMC)",
    description: "Official student climbing and mountaineering society at King's College London. KCLSU Accredited.",
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
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
        <Footer />
      </body>
    </html>
  );
}
