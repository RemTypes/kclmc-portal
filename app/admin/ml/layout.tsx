import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'ML Telemetry & Analytics',
  description: 'SuperAdmin demand elasticity and inventory optimization models.',
};

export default function MlLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
