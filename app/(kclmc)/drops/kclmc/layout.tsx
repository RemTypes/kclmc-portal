import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Club Merch & Stash Drops',
  description: 'Official KCLMC alpine fleece, hoodies, and club apparel pre-orders.',
};

export default function DropsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
