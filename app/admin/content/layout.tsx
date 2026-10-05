import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'CMS Content Manager',
  description: 'Manage trips, gym guides, rankings, and merch drops.',
};

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
