import './globals.css';
import React from 'react';
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'KCLMC & LUBE Platform',
  description: 'King\'s College London Mountaineering Club & London University Bouldering Events',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0B0F17] text-slate-100 antialiased selection:bg-[#FFBD59] selection:text-[#052322] flex flex-col font-mono">
        <Navigation />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
