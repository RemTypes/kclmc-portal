import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Modules & Permissions',
  description: 'Toggle club features, routes, and role-based clearance.',
};

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
