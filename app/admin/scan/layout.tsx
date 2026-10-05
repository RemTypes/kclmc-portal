import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Pass Scanner',
  description: 'Live mobile QR and card scanner for climbing wall check-ins.',
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
