import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Trips & Meets Calendar',
  description: 'Upcoming mountaineering, trad, and winter climbing trips with KCLMC.',
};

export default function TripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
