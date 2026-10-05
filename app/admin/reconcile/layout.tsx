import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Payment Reconciliation',
  description: 'Match KCLSU payment reports against membership and merchandise orders.',
};

export default function ReconcileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
