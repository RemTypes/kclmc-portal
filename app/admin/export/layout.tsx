import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Manufacturer Export',
  description: 'Export sizing matrices and printer specification sheets.',
};

export default function ExportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
